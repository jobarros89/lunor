import "server-only";

import { serverEnvAsync } from "@/lib/env";
import { createAdminClientAsync } from "@/lib/supabase/admin";
import type { PushMessage } from "@/lib/push/send";
import {
  formatDatePtBr,
  formatTimePtBr,
  renderLunorEmail,
  renderLunorText,
  type EmailDetail,
  type EmailListItem,
} from "@/lib/email/template";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_APP_URL = "https://lunorservice.com";
const FROM = "LUNOR <notificacoes@send.lunorservice.com>";

type AssignmentReference =
  | { kind: "assignment"; id: string }
  | { kind: "event"; id: string };

function assignmentReferenceFromTag(tag?: string): AssignmentReference | null {
  if (!tag || tag.startsWith("assignment-response-")) return null;
  if (tag.startsWith("assignment-")) {
    const id = tag.slice("assignment-".length);
    return id ? { kind: "assignment", id } : null;
  }
  if (tag.startsWith("assign-")) {
    const id = tag.slice("assign-".length);
    return id ? { kind: "event", id } : null;
  }
  return null;
}

function errorMessage(reason: unknown) {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || null;
}

function roleFromMessage(message: PushMessage) {
  return (message.body || "").split(" · ")[0]?.trim() || null;
}

async function resolveAssignment(
  admin: Awaited<ReturnType<typeof createAdminClientAsync>>,
  reference: AssignmentReference,
  userId: string,
  message: PushMessage
) {
  const columns =
    "id, event_id, church_id, ministry_id, department_id, role_name, arrival_time, items_to_bring";

  if (reference.kind === "assignment") {
    const { data } = await admin
      .from("assignments")
      .select(columns)
      .eq("id", reference.id)
      .eq("user_id", userId)
      .maybeSingle();
    return data;
  }

  const roleName = roleFromMessage(message);
  const base = admin
    .from("assignments")
    .select(columns)
    .eq("event_id", reference.id)
    .eq("user_id", userId);
  const query = roleName ? base.eq("role_name", roleName) : base;
  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}

async function resolveRecipient(
  admin: Awaited<ReturnType<typeof createAdminClientAsync>>,
  userId: string
) {
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
}

async function buildAssignmentEmailContext(
  admin: Awaited<ReturnType<typeof createAdminClientAsync>>,
  reference: AssignmentReference,
  userId: string,
  message: PushMessage
) {
  const assignment = await resolveAssignment(admin, reference, userId, message);
  if (!assignment) return null;

  const { data: event } = await admin
    .from("events")
    .select("id, title, starts_at, location, campus_id, setlist_status")
    .eq("id", assignment.event_id)
    .maybeSingle();
  if (!event) return null;

  const [{ data: campus }, { data: department }, { data: ministryWindow }, setlistResult] =
    await Promise.all([
      event.campus_id
        ? admin.from("campuses").select("name").eq("id", event.campus_id).maybeSingle()
        : Promise.resolve({ data: null }),
      assignment.department_id
        ? admin.from("departments").select("name").eq("id", assignment.department_id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("event_ministry_windows")
        .select("arrival_at")
        .eq("event_id", assignment.event_id)
        .eq("ministry_id", assignment.ministry_id)
        .maybeSingle(),
      event.setlist_status === "publicado"
        ? admin
            .from("setlist_items")
            .select("position, key_override, songs(title, default_key)")
            .eq("event_id", assignment.event_id)
            .eq("church_id", assignment.church_id)
            .order("position")
        : Promise.resolve({ data: [] }),
    ]);

  const setlist: EmailListItem[] = (setlistResult.data ?? []).flatMap((item) => {
    const song = firstRelated(
      item.songs as unknown as
        | { title: string; default_key: string | null }
        | { title: string; default_key: string | null }[]
        | null
    );
    if (!song?.title) return [];
    const key = item.key_override || song.default_key;
    return [{ primary: song.title, secondary: key ? `Tom ${key}` : "Tom a definir" }];
  });

  return {
    assignment,
    event,
    campusName: campus?.name ?? event.location ?? "Não informado",
    servingPosition: department?.name ?? assignment.role_name,
    arrivalAt: assignment.arrival_time ?? ministryWindow?.arrival_at ?? null,
    setlist,
  };
}

/** Envia e-mail de nova escala em best-effort. Nunca deve quebrar a ação principal. */
export async function notifyAssignmentByEmail(
  userIds: string[],
  message: PushMessage
): Promise<void> {
  const reference = assignmentReferenceFromTag(message.tag);
  if (!reference || userIds.length === 0) return;

  const apiKey = await serverEnvAsync("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("notifyAssignmentByEmail: RESEND_API_KEY não configurada no runtime");
    return;
  }

  try {
    const admin = await createAdminClientAsync();
    const recipients = await Promise.allSettled(
      userIds.map((userId) => resolveRecipient(admin, userId))
    );
    const emails = recipients.flatMap((result) =>
      result.status === "fulfilled" && result.value.email ? [result.value] : []
    );
    if (emails.length === 0) return;

    const appUrl = ((await serverEnvAsync("NEXT_PUBLIC_APP_URL")) ?? DEFAULT_APP_URL).replace(
      /\/$/,
      ""
    );
    const path = message.url ?? "/";
    const actionUrl = `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const results = await Promise.allSettled(
      emails.map(async ({ userId, email, fullName }) => {
        const context = await buildAssignmentEmailContext(admin, reference, userId, message);
        if (!context) throw new Error("Contexto da escala não encontrado");

        const { assignment, event, campusName, servingPosition, arrivalAt, setlist } = context;
        const details: EmailDetail[] = [
          { label: "Culto / evento", value: event.title },
          { label: "Campus", value: campusName },
          { label: "Data", value: formatDatePtBr(event.starts_at) },
          { label: "Início", value: formatTimePtBr(event.starts_at) },
          { label: "Chegada", value: arrivalAt ? formatTimePtBr(arrivalAt) : "A definir" },
          { label: "Instrumento / posição", value: servingPosition },
        ];

        if (assignment.role_name !== servingPosition) {
          details.push({ label: "Função", value: assignment.role_name });
        }
        if (assignment.items_to_bring) {
          details.push({ label: "Levar", value: assignment.items_to_bring });
        }

        const name = firstName(fullName);
        const emailOptions = {
          title: "Você foi escalado 🙌",
          intro: `${name ? `Olá, ${name}! ` : ""}Você foi escalado para servir. Confira as informações abaixo e confirme sua participação no LUNOR.`,
          details,
          listTitle: setlist.length > 0 ? "Repertório" : undefined,
          listItems: setlist,
          actionLabel: "Ver e responder minha escala",
          actionUrl,
          note: "Se alguma informação estiver incorreta ou você não puder servir, responda pela própria escala no LUNOR.",
        };

        const response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `assignment/${assignment.id}/${userId}`,
          },
          body: JSON.stringify({
            from: FROM,
            to: [email],
            subject: `LUNOR — nova escala · ${event.title}`,
            text: renderLunorText(emailOptions),
            html: renderLunorEmail(emailOptions),
            tags: [
              { name: "type", value: "assignment_created" },
              { name: "assignment_id", value: assignment.id },
              { name: "event_id", value: assignment.event_id },
            ],
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `Resend HTTP ${response.status}: ${detail.slice(0, 500) || "sem corpo de resposta"}`
          );
        }
      })
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    for (const failure of failures) {
      console.warn("notifyAssignmentByEmail: Resend rejeitou envio", {
        reference,
        error: errorMessage(failure.reason),
      });
    }
    if (failures.length > 0) {
      console.warn(`notifyAssignmentByEmail: ${failures.length} envio(s) falharam`);
    }
  } catch (error) {
    console.error("notifyAssignmentByEmail: falha", error);
  }
}
