import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { configuredWhatsAppProviderName, getWhatsAppProvider } from "@/lib/whatsapp/dispatcher";
import {
  assertWhatsAppSendConfigured,
  sendAssignmentWhatsApp,
} from "@/lib/whatsapp/meta";
import type { SendAssignmentResult } from "@/lib/whatsapp/types";

const schema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
});

const SEND_CONCURRENCY = 10;

export type PublishWhatsAppSummary = {
  sent: number;
  alreadySent: number;
  missingPhone: number;
  failed: number;
};

export type PublishWhatsAppResult =
  | { ok: true; data: PublishWhatsAppSummary }
  | { ok: false; error: string };

export async function publishMinistryScheduleWhatsApp(raw: unknown): Promise<PublishWhatsAppResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados da escala inválidos" };
  const input = parsed.data;
  const providerName = configuredWhatsAppProviderName();
  const provider = providerName === "evolution" ? getWhatsAppProvider() : null;

  try {
    if (provider) provider.assertConfigured();
    else assertWhatsAppSendConfigured();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "WhatsApp ainda não configurado",
    };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Não autenticado" };

  const [{ data: churchMember }, { data: ministryMember }, { data: event }] = await Promise.all([
    supabase.from("church_members").select("role, status").eq("church_id", input.churchId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle(),
    supabase.from("ministry_members").select("role, active").eq("church_id", input.churchId).eq("ministry_id", input.ministryId).eq("user_id", auth.user.id).eq("active", true).maybeSingle(),
    supabase.from("events").select("id, title, starts_at").eq("id", input.eventId).eq("church_id", input.churchId).maybeSingle(),
  ]);

  const canManageChurch = ["admin", "coordenador"].includes(String(churchMember?.role ?? ""));
  const canManageMinistry = ["gerente", "lider"].includes(String(ministryMember?.role ?? ""));
  if (!canManageChurch && !canManageMinistry) return { ok: false, error: "Sem permissão para publicar essa escala" };
  if (!event) return { ok: false, error: "Culto não encontrado" };

  const { data: assignments, error: assignmentsError } = await supabase
    .from("assignments")
    .select("id, user_id, role_name, status, profiles!assignments_user_id_fkey(full_name, phone)")
    .eq("church_id", input.churchId)
    .eq("event_id", input.eventId)
    .eq("ministry_id", input.ministryId)
    .neq("status", "substituido")
    .order("created_at");

  if (assignmentsError) return { ok: false, error: "Não foi possível carregar a equipe" };
  if (!assignments?.length) return { ok: false, error: "Ninguém foi escalado ainda" };

  const pendingAssignments = assignments.filter((assignment) => assignment.status === "convidado");
  const summary: PublishWhatsAppSummary = { sent: 0, alreadySent: assignments.length - pendingAssignments.length, missingPhone: 0, failed: 0 };

  for (let offset = 0; offset < pendingAssignments.length; offset += SEND_CONCURRENCY) {
    const batch = pendingAssignments.slice(offset, offset + SEND_CONCURRENCY);
    const results = await Promise.all(batch.map(async (assignment): Promise<SendAssignmentResult> => {
      const profile = assignment.profiles as unknown as { full_name: string; phone: string | null } | null;
      const sendInput = {
        churchSlug: input.churchSlug,
        churchId: input.churchId,
        eventId: input.eventId,
        ministryId: input.ministryId,
        assignmentId: assignment.id,
        userId: assignment.user_id,
        volunteerName: profile?.full_name ?? "Voluntário",
        phone: profile?.phone ?? null,
        roleName: assignment.role_name,
        eventTitle: event.title,
        startsAt: event.starts_at,
      };
      return provider ? provider.sendAssignment(sendInput) : sendAssignmentWhatsApp(sendInput);
    }));

    for (const result of results) {
      if (!result.ok) summary.failed += 1;
      else if (!result.skipped) summary.sent += 1;
      else if (result.reason === "missing_phone") summary.missingPhone += 1;
      else summary.alreadySent += 1;
    }
  }

  if (summary.sent === 0 && summary.failed > 0 && summary.alreadySent === 0) {
    return { ok: false, error: `${providerName === "evolution" ? "A Evolution" : "A Meta"} não aceitou os envios. Verifique a configuração.` };
  }
  return { ok: true, data: summary };
}
