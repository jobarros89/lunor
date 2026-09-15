import "server-only";

import { serverEnvAsync } from "@/lib/env";
import { createAdminClientAsync } from "@/lib/supabase/admin";
import type { PushMessage } from "@/lib/push/send";
import {
  formatDatePtBr,
  renderLunorEmail,
  renderLunorText,
  type EmailDetail,
} from "@/lib/email/template";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_APP_URL = "https://lunorservice.com";
const FROM = "LUNOR <notificacoes@send.lunorservice.com>";

function requestIdFromTag(tag?: string) {
  if (!tag?.startsWith("availability-")) return null;
  return tag.slice("availability-".length) || null;
}

function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || null;
}

function availabilityPath(ministrySlug: string | null, fallbackUrl?: string) {
  const fallback = fallbackUrl ?? "/disponibilidade";
  const parts = fallback.split("/").filter(Boolean);
  const churchSlug = parts[0];
  if (!churchSlug || !ministrySlug) return fallback;

  if (ministrySlug === "louvor") return `/${churchSlug}/louvor/disponibilidade`;
  if (["kids", "infantil"].includes(ministrySlug)) {
    return `/${churchSlug}/infantil/disponibilidade`;
  }
  return fallback;
}

async function resolveRecipients(
  admin: Awaited<ReturnType<typeof createAdminClientAsync>>,
  userIds: string[]
) {
  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const [{ data: authData, error }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      ]);
      if (error) throw error;
      return {
        userId,
        email: authData.user?.email ?? null,
        fullName: profile?.full_name ?? null,
      };
    })
  );

  return results.flatMap((result) =>
    result.status === "fulfilled" && result.value.email ? [result.value] : []
  );
}

/** Envia e-mail de disponibilidade em best-effort. Nunca deve quebrar a ação principal. */
export async function notifyAvailabilityByEmail(
  userIds: string[],
  message: PushMessage
): Promise<void> {
  const requestId = requestIdFromTag(message.tag);
  if (!requestId || userIds.length === 0) return;

  const apiKey = await serverEnvAsync("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("notifyAvailabilityByEmail: RESEND_API_KEY não configurada no runtime");
    return;
  }

  try {
    const admin = await createAdminClientAsync();
    const [{ data: request }, recipients] = await Promise.all([
      admin
        .from("availability_requests")
        .select("title, respond_by, ministry_id")
        .eq("id", requestId)
        .maybeSingle(),
      resolveRecipients(admin, userIds),
    ]);
    if (recipients.length === 0) return;

    const { data: ministry } = request?.ministry_id
      ? await admin
          .from("ministries")
          .select("name, slug")
          .eq("id", request.ministry_id)
          .maybeSingle()
      : { data: null };

    const path = availabilityPath(ministry?.slug ?? null, message.url);
    const appUrl = ((await serverEnvAsync("NEXT_PUBLIC_APP_URL")) ?? DEFAULT_APP_URL).replace(
      /\/$/,
      ""
    );
    const actionUrl = `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const results = await Promise.allSettled(
      recipients.map(async ({ userId, email, fullName }) => {
        const details: EmailDetail[] = [];
        if (ministry?.name) details.push({ label: "Ministério", value: ministry.name });
        if (request?.title) details.push({ label: "Período / pedido", value: request.title });
        if (request?.respond_by) {
          details.push({ label: "Responder até", value: formatDatePtBr(request.respond_by) });
        }

        const name = firstName(fullName);
        const emailOptions = {
          title: "Sua disponibilidade foi solicitada",
          intro: `${name ? `Olá, ${name}! ` : ""}Seu líder está montando as próximas escalas e precisa saber quando você pode servir.`,
          details,
          actionLabel: "Informar disponibilidade",
          actionUrl,
          note: "Marque os dias em que pode ou não pode servir e confirme sua resposta no LUNOR.",
        };

        const response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `availability/${requestId}/${userId}`,
          },
          body: JSON.stringify({
            from: FROM,
            to: [email],
            subject: request?.title
              ? `LUNOR — disponibilidade · ${request.title}`
              : "LUNOR — disponibilidade solicitada",
            text: renderLunorText(emailOptions),
            html: renderLunorEmail(emailOptions),
            tags: [
              { name: "type", value: "availability_request" },
              { name: "request_id", value: requestId },
            ],
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
        }
      })
    );

    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      console.warn(`notifyAvailabilityByEmail: ${failures.length} envio(s) falharam`);
    }
  } catch (error) {
    console.error("notifyAvailabilityByEmail: falha", error);
  }
}
