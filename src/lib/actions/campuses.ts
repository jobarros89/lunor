"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const createCampusSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome do campus").max(120),
});

export async function createCampus(raw: unknown): Promise<ActionResult> {
  const parsed = createCampusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("campuses").insert({
    church_id: d.churchId,
    name: d.name,
  });

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Esse campus já existe" : "Não foi possível criar o campus",
    };
  }

  revalidatePath(`/${d.churchSlug}/admin`);
  revalidatePath(`/${d.churchSlug}/escalas/novo`);
  return { ok: true, data: undefined };
}

const campusStateSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  campusId: z.string().uuid(),
  active: z.boolean(),
});

export async function setCampusActive(raw: unknown): Promise<ActionResult> {
  const parsed = campusStateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("campuses")
    .update({ active: d.active })
    .eq("id", d.campusId)
    .eq("church_id", d.churchId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: "Não foi possível atualizar o campus" };

  revalidatePath(`/${d.churchSlug}/admin`);
  revalidatePath(`/${d.churchSlug}/escalas/novo`);
  return { ok: true, data: undefined };
}
