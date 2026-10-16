import "server-only";

import { serverEnvAsync } from "@/lib/env";
import { createAdminClientAsync } from "@/lib/supabase/admin";
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

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || null;
}

export async function notifyServiceReminderByEmail({
  userId,
  assignmentId,
  messageId,
  path,
}: {
  userId: string;
  assignmentId: string;
  messageId: string;
  path: string;
}): Promise<boolean> {
  const apiKey = await serverEnvAsync("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("service reminder e-mail: RESEND_API_KEY não configurada");
    return false;
  }

  try {
    const admin = await createAdminClientAsync();

    const { data: assignment } = await admin
      .from("assignments")
      .select(
        "id, event_id, church_id, ministry_id, department_id, role_name, arrival_time, items_to_bring",
      )
      .eq("id", assignmentId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!assignment) return false;

    const [{ data: event }, { data: profile }, authResult] = await Promise.all([
      admin
        .from("events")
        .select("id, title, starts_at, location, campus_id, setlist_status")
        .eq("id", assignment.event_id)
        .maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      admin.auth.admin.getUserById(userId),
    ]);

    if (!event || authResult.error || !authResult.data.user?.email) return false;

    const [{ data: campus }, { data: department }, { data: ministryWindow }, setlistResult] =
      await Promise.all([
        event.campus_id
          ? admin.from("campuses").select("name").eq("id", event.campus_id).maybeSingle()
          : Promise.resolve({ data: null }),
        assignment.department_id
          ? admin.from("departments").select("name").eq("id", assignment.department_id).maybeSingle()
          : Promise.resolve({ data: null }),
        assignment.ministry_id
          ? admin
              .from("event_ministry_windows")
              .select("arrival_at")
              .eq("event_id", assignment.event_id)
              .eq("ministry_id", assignment.ministry_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        admin
          .from("setlist_items")
          .select("position, key_override, songs(title, default_key)")
          .eq("event_id", assignment.event_id)
          .eq("church_id", assignment.church_id)
          .order("position"),
      ]);

    const setlist: EmailListItem[] =
      event.setlist_status !== "publicado"
        ? []
        : (setlistResult.data ?? []).flatMap((item) => {
      const song = firstRelated(
        item.songs as unknown as
          | { title: string; default_key: string | null }
          | { title: string; default_key: string | null }[]
          | null,
      );
      if (!song?.title) return [];
      const key = item.key_override || song.default_key;
            return [{ primary: song.title, secondary: key ? `Tom ${key}` : "Tom a definir" }];
          });

    const arrivalAt =
      assignment.arrival_time ?? ministryWindow?.arrival_at ?? event.starts_at;
    const servingPosition = department?.name ?? assignment.role_name;
    const details: EmailDetail[] = [
      { label: "Culto / evento", value: event.title },
      { label: "Campus", value: campus?.name ?? event.location ?? "Não informado" },
      { label: "Data", value: formatDatePtBr(event.starts_at) },
      { label: "Início", value: formatTimePtBr(event.starts_at) },
      { label: "Chegada", value: formatTimePtBr(arrivalAt) },
      { label: "Função", value: assignment.role_name },
    ];

    if (assignment.role_name !== servingPosition) {
      details.push({ label: "Área / posição", value: servingPosition });
    }
    if (assignment.items_to_bring) {
      details.push({ label: "Levar", value: assignment.items_to_bring });
    }

    const appUrl = ((await serverEnvAsync("NEXT_PUBLIC_APP_URL")) ?? DEFAULT_APP_URL).replace(
      /\/$/,
      "",
    );
    const actionUrl = `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const name = firstName(profile?.full_name);
    const options = {
      title: "Lembrete da sua escala",
      intro: `${name ? `Olá, ${name}! ` : ""}Você está escalado para servir. Confira horário de chegada, função e repertório antes do serviço.`,
      details,
      listTitle:
        setlist.length > 0
          ? "Repertório"
          : event.setlist_status === "rascunho"
            ? "Repertório ainda não publicado"
            : undefined,
      listItems: setlist,
      actionLabel: "Abrir minha escala",
      actionUrl,
      note:
        event.setlist_status === "rascunho"
          ? "O repertório ainda está em rascunho. Consulte novamente no LUNOR quando a liderança publicar."
          : "Se houver alguma mudança, consulte a escala no LUNOR.",
    };

    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `service-reminder/${messageId}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [authResult.data.user.email],
        subject: `LUNOR — lembrete da sua escala · ${event.title}`,
        text: renderLunorText(options),
        html: renderLunorEmail(options),
        tags: [
          { name: "type", value: "service_reminder" },
          { name: "assignment_id", value: assignment.id },
          { name: "event_id", value: assignment.event_id },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("service reminder e-mail: Resend recusou", response.status, detail.slice(0, 500));
      return false;
    }

    return true;
  } catch (error) {
    console.error("service reminder e-mail: falha", error);
    return false;
  }
}
