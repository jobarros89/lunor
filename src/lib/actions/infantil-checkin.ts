"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const checkinSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  childId: z.string().uuid(),
  classId: z.string().uuid().nullable().default(null),
});

/**
 * Faz o check-in da criança. Se ela já saiu deste mesmo culto,
 * reaproveita o registro existente, gera um novo código e reabre a presença.
 */
export async function checkInOrReenterChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existing, error: existingError } = await supabase
    .from("child_checkins")
    .select("id, checked_out_at")
    .eq("event_id", d.eventId)
    .eq("child_id", d.childId)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: "Não foi possível verificar a presença" };
  }

  if (existing && !existing.checked_out_at) {
    return { ok: false, error: "Esta criança já está presente neste culto" };
  }

  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100 + Math.random() * 900));

    if (existing) {
      const { error } = await supabase
        .from("child_checkins")
        .update({
          class_id: d.classId,
          code,
          checked_in_at: new Date().toISOString(),
          checked_in_by: user?.id ?? null,
          checked_out_at: null,
          checked_out_by: null,
          picked_up_by: null,
          override_reason: null,
          override_by: null,
        })
        .eq("id", existing.id);

      if (!error) {
        revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
        return { ok: true, data: undefined };
      }
      if (error.code === "23505") continue;
      return { ok: false, error: "Sem permissão para refazer o check-in" };
    }

    const { error } = await supabase.from("child_checkins").insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      event_id: d.eventId,
      child_id: d.childId,
      class_id: d.classId,
      code,
      checked_in_by: user?.id ?? null,
    });

    if (!error) {
      revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
      return { ok: true, data: undefined };
    }
    if (error.code === "23505") continue;
    return { ok: false, error: "Sem permissão para fazer check-in" };
  }

  return { ok: false, error: "Não foi possível gerar um código livre" };
}
