"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const CHECK_KEYS = [
  "production.audio-tested",
  "production.projection-ready",
  "production.track-ready",
  "kids.rooms-open",
  "kids.labels-available",
  "kids.team-complete",
  "worship.soundcheck-complete",
  "worship.everyone-in-position",
] as const;

const schema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  checkKey: z.enum(CHECK_KEYS),
  completed: z.boolean(),
});

export async function setEventCultCheck(raw: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_cult_checks")
    .upsert(
      {
        church_id: d.churchId,
        event_id: d.eventId,
        check_key: d.checkKey,
        completed: d.completed,
      },
      { onConflict: "event_id,check_key" }
    )
    .select("check_key")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, error: "Sem permissão para atualizar o checklist" };
  }

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}/modo-culto`);
  return { ok: true, data: undefined };
}
