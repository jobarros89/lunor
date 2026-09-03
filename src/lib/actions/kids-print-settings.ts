"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const schema = z.object({
  churchSlug: z.string().min(2),
  ministryId: z.string().uuid(),
  printMode: z.literal("universal"),
  labelWidthMm: z.coerce.number().min(20).max(120),
  labelHeightMm: z.coerce.number().min(20).max(150),
  marginMm: z.coerce.number().min(0).max(10),
  orientation: z.enum(["horizontal", "vertical"]),
  copies: z.coerce.number().int().min(1).max(3),
  qrEnabled: z.boolean(),
});

export async function saveKidsPrintSettings(raw: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Configuração inválida" };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("kids_print_settings").upsert(
    {
      ministry_id: d.ministryId,
      print_mode: d.printMode,
      label_width_mm: d.labelWidthMm,
      label_height_mm: d.labelHeightMm,
      margin_mm: d.marginMm,
      orientation: d.orientation,
      copies: d.copies,
      qr_enabled: d.qrEnabled,
    },
    { onConflict: "ministry_id" }
  );

  if (error) {
    return { ok: false, error: "Sem permissão ou não foi possível salvar a impressão" };
  }

  revalidatePath(`/${d.churchSlug}/infantil/configuracoes`);
  revalidatePath(`/${d.churchSlug}/infantil`, "layout");
  return { ok: true, data: undefined };
}
