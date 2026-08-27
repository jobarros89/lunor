"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const schema = z.object({
  churchSlug: z.string().min(2), songId: z.string().uuid(),
  arrangementId: z.string().uuid().nullable(), arrangementName: z.string().max(120),
  sourceKind: z.enum(["PASTE", "FILE"]), sourceFormat: z.enum(["PLAIN", "CHORDPRO"]),
  originalFilename: z.string().max(255).nullable(), mimeType: z.string().max(120).nullable(),
  rawContent: z.string().max(20000).refine((value) => value.trim().length > 0, "A cifra está vazia"), chordProContent: z.string().trim().min(1).max(20000),
  extractedLyrics: z.string().max(20000).default(""),
  syncSongLyrics: z.boolean().default(false),
  syncSongChordChart: z.boolean().default(false),
  metadata: z.object({ title: z.string().nullable(), artist: z.string().nullable(), key: z.string().nullable(), bpm: z.number().nullable(), timeSignature: z.string().nullable() }),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), line: z.number().optional() })),
});

export async function confirmChordImport(raw: unknown): Promise<ActionResult<{ versionNumber: number }>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_chord_import", {
    p_song_id: d.songId, p_arrangement_id: d.arrangementId,
    p_arrangement_name: d.arrangementName, p_source_kind: d.sourceKind,
    p_source_format: d.sourceFormat, p_original_filename: d.originalFilename,
    p_mime_type: d.mimeType, p_raw_content: d.rawContent,
    p_chordpro_content: d.chordProContent, p_metadata: d.metadata, p_warnings: d.warnings,
  });
  if (error) return { ok: false, error: "Não foi possível confirmar a importação com segurança." };

  if (d.syncSongLyrics || d.syncSongChordChart) {
    const updates: { lyrics?: string | null; chord_chart?: string | null } = {};
    if (d.syncSongLyrics) updates.lyrics = d.extractedLyrics.trim() || null;
    if (d.syncSongChordChart) updates.chord_chart = d.chordProContent;

    const { error: songError } = await supabase
      .from("songs")
      .update(updates)
      .eq("id", d.songId);

    if (songError) {
      return {
        ok: false,
        error: "O arranjo foi salvo, mas não foi possível atualizar a letra/cifra principal da música.",
      };
    }
  }

  revalidatePath(`/${d.churchSlug}/louvor/${d.songId}`);
  revalidatePath(`/${d.churchSlug}/louvor`);
  const result = Array.isArray(data) ? data[0] : data;
  return { ok: true, data: { versionNumber: Number(result?.version_number) } };
}
