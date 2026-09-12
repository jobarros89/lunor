import "server-only";

import { serverEnvAsync } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushMessage } from "@/lib/push/send";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_APP_URL = "https://lunorservice.com";
const FROM = "LUNOR <notificacoes@send.lunorservice.com>";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function requestIdFromTag(tag?: string) {
  if (!tag?.startsWith("availability-")) return null;
  return tag.slice("availability-".length) || null;
}

async function resolveAvailabilityPath(requestId: string, fallbackUrl?: string) {
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("availability_requests")
    .select("ministry_id")
    .eq("id", requestId)
    .maybeSingle();

  if (!request?.ministry_id) return fallbackUrl ?? "/disponibilidade";

  const { data: ministry } = await admin
    .from("ministries")
    .select("slug")
    .eq("id", request.ministry_id)
    .maybeSingle();

  if (!ministry?.slug) return fallbackUrl ?? "/disponibilidade";

  const fallbackParts = (fallbackUrl ?? "").split("/").filter(Boolean);
  const churchSlug = fallbackParts[0];
  if (!churchSlug) return fallbackUrl ?? "/disponibilidade";

  if (ministry.slug === "louvor") return `/${churchSlug}/louvor/disponibilidade`;
  if (["kids", "infantil"].includes(ministry.slug)) return `/${churchSlug}/infantil/disponibilidade`;
  return fallbackUrl ?? `/${churchSlug}/disponibilidade`;
}

async function resolveEmails(userIds: string[]) {
  const admin = createAdminClient();
  const results = await Promise.allSettled(
    userIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error) throw error;
      return { userId, email: data.user?.email ?? null };
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
    const [recipients, path] = await Promise.all([
      resolveEmails(userIds),
      resolveAvailabilityPath(requestId, message.url),
    ]);
    if (recipients.length === 0) return;

    const appUrl = ((await serverEnvAsync("NEXT_PUBLIC_APP_URL")) ?? DEFAULT_APP_URL).replace(/\/$/, "");
    const actionUrl = `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const safeTitle = escapeHtml(message.title || "Disponibilidade solicitada");
    const safeBody = escapeHtml(message.body || "Seu líder solicitou sua disponibilidade.");

    await Promise.allSettled(
      recipients.map(async ({ userId, email }) => {
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
            subject: "LUNOR — disponibilidade solicitada",
            text: `${message.title}\n\n${message.body}\n\nResponder disponibilidade: ${actionUrl}`,
            html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f8;margin:0;padding:32px 16px;color:#171717"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px"><tr><td style="padding:32px"><p style="font-size:13px;line-height:20px;color:#737373;margin:0 0 12px">LUNOR · Presença · preparo · propósito</p><h1 style="font-size:24px;line-height:32px;color:#171717;margin:0 0 12px">${safeTitle}</h1><p style="font-size:16px;line-height:24px;color:#404040;margin:0 0 24px">${safeBody}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#171717" style="background-color:#171717;border-radius:10px"><a href="${actionUrl}" style="display:inline-block;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none">Responder disponibilidade</a></td></tr></table></td></tr></table></td></tr></table></body></html>`,
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
    ).then((results) => {
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        console.warn(`notifyAvailabilityByEmail: ${failures.length} envio(s) falharam`);
      }
    });
  } catch (error) {
    console.error("notifyAvailabilityByEmail: falha", error);
  }
}
