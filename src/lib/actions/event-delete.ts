"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const deleteEventSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventTitle: z.string().max(120).optional(),
});

export async function deleteFutureEvent(raw: unknown): Promise<ActionResult> {
  const parsed = deleteEventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const [{ data: church }, { data: membership }] = await Promise.all([
    supabase
      .from("churches")
      .select("id")
      .eq("id", d.churchId)
      .eq("slug", d.churchSlug)
      .maybeSingle(),
    supabase
      .from("church_members")
      .select("role")
      .eq("church_id", d.churchId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (!church || membership?.role !== "admin") {
    return { ok: false, error: "Somente administradores podem apagar cultos" };
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, starts_at")
    .eq("id", d.eventId)
    .eq("church_id", d.churchId)
    .maybeSingle();

  if (eventError || !event) {
    return { ok: false, error: "Culto não encontrado" };
  }

  if (new Date(event.starts_at).getTime() <= Date.now()) {
    return { ok: false, error: "Por enquanto, somente cultos futuros podem ser apagados" };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("events")
    .delete()
    .eq("id", d.eventId)
    .eq("church_id", d.churchId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { ok: false, error: "Não foi possível apagar o culto" };
  }

  revalidatePath(`/${d.churchSlug}`);
  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/louvor`);
  revalidatePath(`/${d.churchSlug}/infantil`);

  return { ok: true, data: undefined };
}
