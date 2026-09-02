"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const ministryWindowSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  ministryId: z.string().uuid(),
  arrivalAt: z.string().default(""),
  releaseAt: z.string().default(""),
  notes: z.string().max(1000).default(""),
});

async function canManageMinistry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  churchId: string,
  ministryId: string,
  userId: string
) {
  const [{ data: isMaster }, { data: churchMembership }, { data: ministryMembership }] =
    await Promise.all([
      supabase.rpc("is_platform_admin"),
      supabase
        .from("church_members")
        .select("role")
        .eq("church_id", churchId)
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("ministry_members")
        .select("role")
        .eq("church_id", churchId)
        .eq("ministry_id", ministryId)
        .eq("user_id", userId)
        .eq("active", true)
        .maybeSingle(),
    ]);

  return (
    Boolean(isMaster) ||
    churchMembership?.role === "admin" ||
    churchMembership?.role === "coordenador" ||
    ministryMembership?.role === "gerente" ||
    ministryMembership?.role === "lider"
  );
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function revalidateServiceWindowPaths(churchSlug: string, eventId: string) {
  revalidatePath(`/${churchSlug}`);
  revalidatePath(`/${churchSlug}/escalas`);
  revalidatePath(`/${churchSlug}/escalas/${eventId}`);
  revalidatePath(`/${churchSlug}/louvor/escalas`);
  revalidatePath(`/${churchSlug}/louvor/escalas/${eventId}`);
  revalidatePath(`/${churchSlug}/infantil/escalas`);
  revalidatePath(`/${churchSlug}/infantil/escalas/${eventId}`);
}

export async function saveMinistryServiceWindow(raw: unknown): Promise<ActionResult> {
  const parsed = ministryWindowSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const arrival = parseDate(d.arrivalAt);
  const release = parseDate(d.releaseAt);

  if (arrival === undefined || release === undefined) {
    return { ok: false, error: "Data ou horário inválido" };
  }
  if (arrival && release && release <= arrival) {
    return { ok: false, error: "A saída precisa ser posterior à chegada" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login novamente para continuar" };

  const [{ data: event }, { data: ministry }] = await Promise.all([
    supabase
      .from("events")
      .select("id")
      .eq("id", d.eventId)
      .eq("church_id", d.churchId)
      .maybeSingle(),
    supabase
      .from("ministries")
      .select("id")
      .eq("id", d.ministryId)
      .eq("church_id", d.churchId)
      .maybeSingle(),
  ]);
  if (!event || !ministry) return { ok: false, error: "Culto ou ministério inválido" };

  if (!(await canManageMinistry(supabase, d.churchId, d.ministryId, user.id))) {
    return { ok: false, error: "Você não tem permissão para alterar o horário desta equipe" };
  }

  if (!arrival && !release && !d.notes.trim()) {
    const { error } = await supabase
      .from("event_ministry_windows")
      .delete()
      .eq("church_id", d.churchId)
      .eq("event_id", d.eventId)
      .eq("ministry_id", d.ministryId);
    if (error) return { ok: false, error: "Não foi possível remover o horário da equipe" };
    revalidateServiceWindowPaths(d.churchSlug, d.eventId);
    return { ok: true, data: undefined };
  }

  const { error } = await supabase.from("event_ministry_windows").upsert(
    {
      church_id: d.churchId,
      event_id: d.eventId,
      ministry_id: d.ministryId,
      arrival_at: arrival?.toISOString() ?? null,
      release_at: release?.toISOString() ?? null,
      notes: d.notes.trim() || null,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "event_id,ministry_id" }
  );

  if (error) {
    console.error("saveMinistryServiceWindow:", error);
    return { ok: false, error: "Não foi possível salvar o horário da equipe" };
  }

  revalidateServiceWindowPaths(d.churchSlug, d.eventId);
  return { ok: true, data: undefined };
}
