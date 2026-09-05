"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
 * Faz o check-in da criança dentro da recepção viva. Se a chamada vier de uma
 * rota antiga ligada a culto, a sessão aberta é resolvida automaticamente.
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
  if (!sessionId && d.eventId) {
    const { data: rows } = await supabase.rpc("current_kids_reception", {
      p_church: d.churchId,
      p_ministry: d.ministryId,
    });
    const current = (rows ?? []).find(
      (row: { session_id: string; event_id: string | null }) => row.event_id === d.eventId
    );
    sessionId = current?.session_id ?? null;
  }

  let activeQuery = supabase
    .from("child_checkins")
    .select("id")
    .eq("child_id", d.childId)
    .is("checked_out_at", null);

  activeQuery = sessionId
    ? activeQuery.eq("reception_session_id", sessionId)
    : activeQuery.eq("event_id", d.eventId!);

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
      event_id: d.eventId ?? null,
      child_id: d.childId,
      class_id: d.classId,
      code,
      checked_in_by: user?.id ?? null,
    });

    if (!error) {
      if (sessionId) {
        revalidatePath(`/${d.churchSlug}/infantil/recepcao/${sessionId}`);
      }
      if (d.eventId) {
        revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
      }
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
