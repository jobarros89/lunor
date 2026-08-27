"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const categorySchema = z.enum([
  "VOCAL_SOPRANO",
  "VOCAL_CONTRALTO",
  "VOCAL_TENOR",
  "VOCAL_OTHER",
  "BASS",
  "GUITAR",
  "KEYS",
  "DRUMS",
  "CLICK",
  "GUIDE",
  "OTHER",
]);

const registerSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  songId: z.string().uuid(),
  arrangementVersionId: z.string().uuid().nullable().optional(),
  label: z.string().trim().min(1, "Informe o nome do material").max(120),
  category: categorySchema,
  fileName: z.string().trim().min(1).max(255),
  storageObjectPath: z.string().trim().min(1).max(1000),
  mimeType: z.string().trim().max(120).nullable().optional(),
  sizeBytes: z.number().int().min(0).max(104857600),
});

export async function registerRehearsalMaterial(
  raw: unknown
): Promise<ActionResult<{ materialId: string }>> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;

  const expectedPrefix = `${d.churchId}/${d.songId}/`;
  if (!d.storageObjectPath.startsWith(expectedPrefix)) {
    return { ok: false, error: "Caminho do arquivo inválido" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rehearsal_materials")
    .insert({
      church_id: d.churchId,
      song_id: d.songId,
      arrangement_version_id: d.arrangementVersionId ?? null,
      label: d.label,
      category: d.category,
      file_name: d.fileName,
      storage_object_path: d.storageObjectPath,
      mime_type: d.mimeType ?? null,
      size_bytes: d.sizeBytes,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Rehearsal material registration failed", error?.code, error?.message);
    return { ok: false, error: "Não foi possível registrar o material de ensaio" };
  }

  revalidatePath(`/${d.churchSlug}/louvor/${d.songId}`);
  return { ok: true, data: { materialId: data.id } };
}

const removeSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  songId: z.string().uuid(),
  materialId: z.string().uuid(),
});

export async function removeRehearsalMaterial(raw: unknown): Promise<ActionResult> {
  const parsed = removeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Material inválido" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("rehearsal_materials")
    .select("id, storage_object_path")
    .eq("id", d.materialId)
    .eq("church_id", d.churchId)
    .eq("song_id", d.songId)
    .maybeSingle();

  if (!material) return { ok: false, error: "Material não encontrado" };

  const { data: removed, error } = await supabase
    .from("rehearsal_materials")
    .delete()
    .eq("id", d.materialId)
    .eq("church_id", d.churchId)
    .eq("song_id", d.songId)
    .select("id")
    .maybeSingle();

  if (error || !removed) return { ok: false, error: "Sem permissão para remover este material" };

  const { error: storageError } = await supabase.storage
    .from("worship-materials")
    .remove([material.storage_object_path]);
  if (storageError) {
    console.error("Rehearsal material storage cleanup failed", storageError.message);
  }

  revalidatePath(`/${d.churchSlug}/louvor/${d.songId}`);
  return { ok: true, data: undefined };
}
