"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const createSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  name: z.string().min(2, "Informe onde servir").max(60),
});

/** Cria uma opção de "Onde servir?" vinculada a um ministério da igreja. */
export async function createDepartment(raw: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { churchSlug, churchId, ministryId, name } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    church_id: churchId,
    ministry_id: ministryId,
    name: name.trim(),
  });
  if (error) {
    return { ok: false, error: "Sem permissão para adicionar esta opção de serviço" };
  }
  revalidatePath(`/${churchSlug}/admin`);
  revalidatePath(`/${churchSlug}/onde-servir`);
  revalidatePath(`/${churchSlug}/escalas/novo`);
  return { ok: true, data: undefined };
}

const deleteSchema = z.object({
  churchSlug: z.string().min(2),
  departmentId: z.string().uuid(),
});

export async function deleteDepartment(raw: unknown): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, departmentId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", departmentId);
  if (error) return { ok: false, error: "Sem permissão para remover esta opção" };
  revalidatePath(`/${churchSlug}/admin`);
  revalidatePath(`/${churchSlug}/onde-servir`);
  revalidatePath(`/${churchSlug}/escalas/novo`);
  return { ok: true, data: undefined };
}
