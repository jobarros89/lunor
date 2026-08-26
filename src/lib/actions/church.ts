"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "./types";

const createChurchSchema = z.object({
  name: z.string().min(2, "Informe o nome da igreja").max(80),
});

export async function createChurch(formData: FormData): Promise<ActionResult> {
  const parsed = createChurchSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const baseSlug = slugify(parsed.data.name);
  // tenta o slug puro; em conflito, adiciona sufixo aleatório
  for (const slug of [
    baseSlug,
    `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
  ]) {
    const { data, error } = await supabase.rpc("create_church", {
      p_name: parsed.data.name,
      p_slug: slug,
    });
    if (!error && data) {
      const { data: church } = await supabase
        .from("churches")
        .select("slug")
        .eq("id", data)
        .single();
      redirect("/onboarding");
    }
    if (error && !error.message.includes("churches_slug_key")) {
      return { ok: false, error: "Não foi possível criar a igreja" };
    }
  }
  return { ok: false, error: "Nome de igreja indisponível, tente outro" };
}

const updateNameSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  name: z.string().min(2, "Nome muito curto").max(80),
});

/** Edita o nome da igreja. Só admin/master (RLS churches_update). */
export async function updateChurchName(raw: unknown): Promise<ActionResult> {
  const parsed = updateNameSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { churchSlug, churchId, name } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("churches")
    .update({ name: name.trim() })
    .eq("id", churchId)
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para editar o nome" };
  }
  revalidatePath(`/${churchSlug}`, "layout");
  return { ok: true, data: undefined };
}

const deleteChurchSchema = z.object({
  churchId: z.string().uuid(),
  confirmName: z.string().min(1),
});

/**
 * Apaga a igreja e TODOS os seus dados (cascata). Só admin/master (RLS).
 * Exige o nome exato da igreja como confirmação — proteção contra acidente.
 */
export async function deleteChurch(raw: unknown): Promise<ActionResult> {
  const parsed = deleteChurchSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchId, confirmName } = parsed.data;

  const supabase = await createClient();

  // confere o nome digitado contra o nome real (defesa extra além da UI)
  const { data: church } = await supabase
    .from("churches")
    .select("name")
    .eq("id", churchId)
    .maybeSingle();
  if (!church) return { ok: false, error: "Igreja não encontrada" };
  if (church.name.trim() !== confirmName.trim()) {
    return { ok: false, error: "O nome digitado não confere" };
  }

  const { data, error } = await supabase
    .from("churches")
    .delete()
    .eq("id", churchId)
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para apagar esta igreja" };
  }
  redirect("/");
}

export async function joinChurch(formData: FormData): Promise<ActionResult> {
  const code = z
    .string()
    .trim()
    .min(6, "Código inválido")
    .safeParse(formData.get("inviteCode"));
  if (!code.success) {
    return { ok: false, error: code.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_church", {
    p_invite_code: code.data.toLowerCase(),
  });
  if (error || !data) {
    return { ok: false, error: "Código de convite inválido" };
  }
  const { data: church } = await supabase
    .from("churches")
    .select("slug")
    .eq("id", data)
    .single();
  redirect("/onboarding");
}
