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
 * Faz o check-in da criança. Se ela já saiu deste mesmo culto, cria uma nova
 * entrada e preserva o registro da retirada anterior para histórico/auditoria.
 */
export async function checkInOrReenterChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: active, error: activeError } = await supabase
    .from("child_checkins")
    .select("id")
    .eq("event_id", d.eventId)
    .eq("child_id", d.childId)
    .is("checked_out_at", null)
    .maybeSingle();

  if (activeError) {
    return { ok: false, error: "Não foi possível verificar a presença" };
  }
  if (active) {
    return { ok: false, error: "Esta criança já está presente neste culto" };
  }

  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100 + Math.random() * 900));
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

    if (error.code === "23505") {
      if (error.message.includes("child_checkins_one_active_per_child_event")) {
        return { ok: false, error: "Esta criança já está presente neste culto" };
      }
      // colisão do código de três dígitos: tenta outro.
      continue;
    }

    return { ok: false, error: "Sem permissão para fazer check-in" };
  }

  return { ok: false, error: "Não foi possível gerar um código livre" };
}
