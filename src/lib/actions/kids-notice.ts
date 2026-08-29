"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const acknowledgeSchema = z.object({
  churchSlug: z.string().min(2),
  pageId: z.string().uuid(),
});

export async function acknowledgeKidsNotice(raw: unknown): Promise<ActionResult> {
  const parsed = acknowledgeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Aviso inválido" };

  const { churchSlug, pageId } = parsed.data;
  const supabase = await createClient();
  const { data: eventId, error } = await supabase.rpc("acknowledge_child_page", {
    p_page: pageId,
  });

  if (error) {
    return { ok: false, error: "Não foi possível confirmar o aviso" };
  }

  revalidatePath(`/${churchSlug}`);
  if (eventId) {
    revalidatePath(`/${churchSlug}/infantil/sessao/${eventId}`);
  }

  return { ok: true, data: undefined };
}
