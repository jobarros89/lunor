"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ageInMonths } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const checkinSchema = z
  .object({
    churchSlug: z.string().min(2),
    churchId: z.string().uuid(),
    ministryId: z.string().uuid(),
    sessionId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().nullable().optional(),
    childId: z.string().uuid(),
    classId: z.string().uuid().nullable().default(null),
  })
  .refine((value) => !!value.sessionId || !!value.eventId, {
    message: "Contexto da recepção ausente",
  });

/**
 * Faz o check-in dentro do contexto do campus. A criança não fica presa a uma
 * turma: a sugestão é recalculada em cada recepção usando campus + idade.
 */
export async function checkInOrReenterChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let sessionId = d.sessionId ?? null;
  let eventId = d.eventId ?? null;
  let campusId: string | null = null;

  if (sessionId) {
    const { data: session } = await supabase
      .from("kids_reception_sessions")
      .select("id, event_id, campus_id, closed_at")
      .eq("id", sessionId)
      .eq("church_id", d.churchId)
      .eq("ministry_id", d.ministryId)
      .maybeSingle();

    if (!session || session.closed_at) {
      return { ok: false, error: "Esta recepção não está mais aberta" };
    }
    eventId = eventId ?? session.event_id;
    campusId = session.campus_id;
  }

  if (!sessionId && eventId) {
    const { data: rows } = await supabase.rpc("current_kids_reception", {
      p_church: d.churchId,
      p_ministry: d.ministryId,
    });
    const current = (rows ?? []).find(
      (row: { session_id: string; event_id: string | null; campus_id: string | null }) =>
        row.event_id === eventId
    );
    sessionId = current?.session_id ?? null;
    campusId = current?.campus_id ?? null;
  }

  if (!campusId && eventId) {
    const { data: event } = await supabase
      .from("events")
      .select("campus_id")
      .eq("id", eventId)
      .eq("church_id", d.churchId)
      .maybeSingle();
    campusId = event?.campus_id ?? null;
  }

  if (!campusId) {
    return {
      ok: false,
      error: "Esta recepção está sem campus definido. Encerre e abra novamente escolhendo o campus.",
    };
  }

  const [{ data: child }, { data: classes }] = await Promise.all([
    supabase
      .from("children")
      .select("id, birth_date")
      .eq("id", d.childId)
      .eq("church_id", d.churchId)
      .eq("ministry_id", d.ministryId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("child_classes")
      .select("id, name, min_age_months, max_age_months")
      .eq("ministry_id", d.ministryId)
      .eq("campus_id", campusId)
      .order("sort_order"),
  ]);

  if (!child) return { ok: false, error: "Criança não encontrada" };

  let resolvedClassId = d.classId;
  if (resolvedClassId) {
    const valid = (classes ?? []).some((item) => item.id === resolvedClassId);
    if (!valid) {
      return { ok: false, error: "A turma escolhida não pertence ao campus desta recepção" };
    }
  } else {
    const ageMonths = ageInMonths(child.birth_date);
    resolvedClassId =
      (classes ?? []).find(
        (item) => ageMonths >= item.min_age_months && ageMonths <= item.max_age_months
      )?.id ?? null;
  }

  if (!resolvedClassId) {
    return {
      ok: false,
      error: "Nenhuma turma deste campus atende a idade da criança. Escolha uma turma manualmente ou ajuste as faixas em Configurações.",
    };
  }

  let activeQuery = supabase
    .from("child_checkins")
    .select("id")
    .eq("child_id", d.childId)
    .is("checked_out_at", null);

  activeQuery = sessionId
    ? activeQuery.eq("reception_session_id", sessionId)
    : activeQuery.eq("event_id", eventId!);

  const { data: active, error: activeError } = await activeQuery.maybeSingle();

  if (activeError) {
    return { ok: false, error: "Não foi possível verificar a presença" };
  }
  if (active) {
    return { ok: false, error: "Esta criança já está presente nesta recepção" };
  }

  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100 + Math.random() * 900));
    const { error } = await supabase.from("child_checkins").insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      reception_session_id: sessionId,
      event_id: eventId,
      child_id: d.childId,
      class_id: resolvedClassId,
      code,
      checked_in_by: user?.id ?? null,
    });

    if (!error) {
      if (sessionId) {
        revalidatePath(`/${d.churchSlug}/infantil/recepcao/${sessionId}`);
      }
      if (eventId) {
        revalidatePath(`/${d.churchSlug}/infantil/sessao/${eventId}`);
      }
      revalidatePath(`/${d.churchSlug}/infantil`);
      return { ok: true, data: undefined };
    }

    if (error.code === "23505") {
      if (
        error.message.includes("child_checkins_one_active_per_child_session") ||
        error.message.includes("child_checkins_one_active_per_child_event")
      ) {
        return { ok: false, error: "Esta criança já está presente nesta recepção" };
      }
      continue;
    }

    return { ok: false, error: "Sem permissão para fazer check-in" };
  }

  return { ok: false, error: "Não foi possível gerar um código livre" };
}
