"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const schema = z.object({
  churchSlug: z.string().min(2),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  presence: z.enum(["presente", "ausente", "limpar"]),
});

export async function setEventPresence(raw: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, church_id")
    .eq("id", d.assignmentId)
    .eq("event_id", d.eventId)
    .maybeSingle();
  if (!assignment) return { ok: false, error: "Escala não encontrada" };

  const update = d.presence === "presente"
    ? { status: "presente", checked_in_at: new Date().toISOString() }
    : d.presence === "ausente"
      ? { status: "ausente", checked_in_at: null }
      : { status: "confirmado", checked_in_at: null };

  const { data, error } = await supabase
    .from("assignments")
    .update(update)
    .eq("id", d.assignmentId)
    .select("id");

  if (error || !data?.length) return { ok: false, error: "Sem permissão para registrar presença" };

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}/modo-culto`);
  return { ok: true, data: undefined };
}
