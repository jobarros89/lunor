"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const responseSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid().optional(),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  response: z.enum(["confirmar", "nao_posso", "falar_lider"]),
  note: z.string().trim().max(500).default(""),
});

export async function respondToAssignment(raw: unknown): Promise<ActionResult> {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Resposta inválida" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, church_id, user_id, leader_id, role_name, status")
    .eq("id", d.assignmentId)
    .eq("event_id", d.eventId)
    .maybeSingle();

  if (!assignment || assignment.user_id !== user.id) {
    return { ok: false, error: "Essa escala não pertence a você" };
  }
  if (d.churchId && d.churchId !== assignment.church_id) {
    return { ok: false, error: "Igreja inválida para essa escala" };
  }

  const churchId = assignment.church_id;
  const now = new Date().toISOString();
  const note = d.note || null;

  if (d.response === "confirmar") {
    const { error } = await supabase
      .from("assignments")
      .update({ status: "confirmado", responded_at: now, response_note: note })
      .eq("id", d.assignmentId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Não foi possível confirmar sua escala" };
  }

  if (d.response === "falar_lider") {
    const { error } = await supabase
      .from("assignments")
      .update({ status: "falar_lider", responded_at: now, response_note: note })
      .eq("id", d.assignmentId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Não foi possível enviar sua resposta" };

    await notifyAssignmentLeaders({
      supabase,
      churchId,
      eventId: d.eventId,
      assignmentId: d.assignmentId,
      churchSlug: d.churchSlug,
      title: "Voluntário quer falar com você",
      userId: user.id,
      roleName: assignment.role_name,
    });
  }

  if (d.response === "nao_posso") {
    const { data: existing } = await supabase
      .from("substitution_requests")
      .select("id")
      .eq("assignment_id", d.assignmentId)
      .eq("requested_by", user.id)
      .eq("status", "aberta")
      .maybeSingle();

    if (!existing) {
      const { error: requestError } = await supabase
        .from("substitution_requests")
        .insert({
          church_id: churchId,
          assignment_id: d.assignmentId,
          requested_by: user.id,
          reason: note,
        });
      if (requestError) return { ok: false, error: "Não foi possível solicitar substituição" };
    }

    const { error } = await supabase
      .from("assignments")
      .update({ status: "substituicao_solicitada", responded_at: now, response_note: note })
      .eq("id", d.assignmentId)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: "Não foi possível registrar sua indisponibilidade" };

    await notifyAssignmentLeaders({
      supabase,
      churchId,
      eventId: d.eventId,
      assignmentId: d.assignmentId,
      churchSlug: d.churchSlug,
      title: "Substituição necessária",
      userId: user.id,
      roleName: assignment.role_name,
    });
  }

  revalidatePath(`/${d.churchSlug}`);
  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

async function notifyAssignmentLeaders({
  supabase,
  churchId,
  eventId,
  assignmentId,
  churchSlug,
  title,
  userId,
  roleName,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  churchId: string;
  eventId: string;
  assignmentId: string;
  churchSlug: string;
  title: string;
  userId: string;
  roleName: string;
}) {
  const [{ data: profile }, { data: leaders }, { data: assignment }, { data: event }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase
      .from("church_members")
      .select("user_id")
      .eq("church_id", churchId)
      .in("role", ["admin", "coordenador"])
      .eq("status", "active"),
    supabase.from("assignments").select("leader_id").eq("id", assignmentId).maybeSingle(),
    supabase.from("events").select("title").eq("id", eventId).maybeSingle(),
  ]);

  const targets = [...new Set([
    ...(leaders ?? []).map((leader) => leader.user_id),
    assignment?.leader_id,
  ].filter((id): id is string => Boolean(id)))];

  await notifyUsers(targets, {
    title,
    body: `${profile?.full_name || "Um voluntário"} · ${roleName}${event?.title ? ` · ${event.title}` : ""}`,
    url: `/${churchSlug}/escalas/${eventId}`,
    tag: `assignment-response-${assignmentId}`,
  });
}
