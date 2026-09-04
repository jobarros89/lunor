"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runLunorAi } from "@/lib/ai/cloudflare";
import { getLouvorMinistry } from "@/lib/louvor-server";
import {
  ChordPageImportError,
  fetchChordPage,
  type ChordPageCandidate,
} from "@/lib/music/import/fetch-chord-page";
import { parseChordChart } from "@/lib/music/import/parse-chord-chart";
import { alignmentFixPreservesLyrics } from "@/lib/music/import/validate-ai-alignment";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import type { ActionResult } from "./types";

const MAX_REPAIR_CONTENT_LENGTH = 6_000;
const ALIGNMENT_WARNING_CODES = new Set(["UNALIGNED_CHORDS", "AMBIGUOUS_CHORD_LINE"]);

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

const urlImportSchema = z.object({
  churchSlug: z.string().min(2),
  songId: z.string().uuid(),
  url: z.string().trim().min(8).max(2048),
});

async function chooseChordCandidate(candidates: ChordPageCandidate[]): Promise<{
  candidate: ChordPageCandidate;
  aiUsed: boolean;
}> {
  const shortlist = candidates.slice(0, 6);
  const fallback = shortlist[0];
  if (!fallback) throw new Error("chord_candidate_missing");
  if (shortlist.length === 1) return { candidate: fallback, aiUsed: false };

  const previews = shortlist
    .map(
      (candidate, index) =>
        `CANDIDATO ${index + 1} (${candidate.source})\n${candidate.content.slice(0, 850)}`
    )
    .join("\n\n---\n\n");

  try {
    const answer = await runLunorAi({
      system:
        "Você seleciona qual trecho de uma página pública contém uma cifra musical. Não reescreva, não complete e não reproduza a música. Responda somente com o número do melhor candidato.",
      prompt: `Escolha o candidato que mais parece conter letra com acordes, seções de música ou uma cifra completa. Prefira conteúdo musical e ignore menus, anúncios, navegação e comentários.\n\n${previews}`,
      maxTokens: 32,
      temperature: 0,
    });
    const match = answer.match(/\b([1-6])\b/);
    const selectedIndex = match ? Number(match[1]) - 1 : -1;
    const selected = shortlist[selectedIndex];
    if (selected) return { candidate: selected, aiUsed: true };
  } catch {
    // Workers AI é um aprimoramento. A importação continua com heurística se o binding estiver indisponível.
  }

  return { candidate: fallback, aiUsed: false };
}

/**
 * A colagem de fontes diferentes (WhatsApp, PDF, outros sites) costuma
 * desalinhar acorde e sílaba porque o espaçamento original não sobrevive à
 * cópia. O parser heurístico já detecta esses casos (UNALIGNED_CHORDS,
 * AMBIGUOUS_CHORD_LINE) — quando eles aparecem, pedimos para a IA
 * reescrever só o posicionamento dos acordes em ChordPro inline.
 *
 * A IA nunca é a única autoridade aqui: o resultado só é aceito se a letra
 * extraída dele for palavra por palavra idêntica à letra extraída do
 * resultado heurístico original. Qualquer divergência (a IA "corrigindo"
 * uma palavra, pulando uma linha, completando algo) descarta a tentativa e
 * devolve o resultado determinístico de sempre — a mesma filosofia de
 * fallback já usada em chooseChordCandidate.
 */
async function repairPlainAlignment(rawContent: string): Promise<{
  content: string;
  fixed: boolean;
}> {
  const heuristic = parseChordChart({ content: rawContent });
  const noFix = { content: rawContent, fixed: false };

  if (heuristic.detectedFormat !== "PLAIN") return noFix;
  const hasAlignmentIssue = heuristic.warnings.some((warning) =>
    ALIGNMENT_WARNING_CODES.has(warning.code)
  );
  if (!hasAlignmentIssue) return noFix;
  // Cifra grande demais para caber com folga no limite de prompt da IA
  // (8.000 caracteres) — mantém o resultado heurístico em vez de truncar
  // a música no meio.
  if (rawContent.length > MAX_REPAIR_CONTENT_LENGTH) return noFix;

  try {
    const answer = await runLunorAi({
      system:
        "Você corrige o posicionamento de acordes em cifras musicais coladas de fontes com espaçamento inconsistente. " +
        "Nunca invente, remova, traduza ou altere uma palavra da letra. Nunca adicione ou remova um acorde que não " +
        "estava no texto original. Sua única tarefa é reescrever o texto em formato ChordPro, colocando cada acorde " +
        "entre colchetes imediatamente antes da sílaba onde ele deve soar, preservando títulos, seções e metadados " +
        "como estavam. Responda apenas com o texto corrigido — sem comentários, sem explicações, sem marcação markdown.",
      prompt: rawContent,
      maxTokens: 1024,
      temperature: 0,
    });

    const repaired = answer.trim();
    if (!repaired) return noFix;

    const reparsed = parseChordChart({ content: repaired });
    const stillHasAlignmentIssue = reparsed.warnings.some((warning) =>
      ALIGNMENT_WARNING_CODES.has(warning.code)
    );
    if (stillHasAlignmentIssue) return noFix;
    if (!alignmentFixPreservesLyrics(heuristic.chordProContent, reparsed.chordProContent)) {
      return noFix;
    }

    return { content: repaired, fixed: true };
  } catch {
    // Workers AI é um aprimoramento. A importação continua com o resultado
    // heurístico se o binding estiver indisponível ou a chamada falhar.
    return noFix;
  }
}

export async function fetchChordFromUrl(raw: unknown): Promise<
  ActionResult<{
    content: string;
    rawContent: string;
    sourceUrl: string;
    sourceTitle: string | null;
    hostname: string;
    aiUsed: boolean;
    alignmentFixedByAi: boolean;
  }>
> {
  const parsed = urlImportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Informe uma URL válida para importar." };
  const input = parsed.data;

  const tenant = await getTenant(input.churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) return { ok: false, error: "O ministério de Louvor não está configurado." };

  const supabase = await createClient();
  const [{ data: song }, { data: ministryMembership }] = await Promise.all([
    supabase
      .from("songs")
      .select("id")
      .eq("id", input.songId)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("ministry_members")
      .select("role")
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!song) return { ok: false, error: "Música não encontrada nesta igreja." };
  const canImport =
    tenant.isCoord || ["gerente", "lider"].includes(ministryMembership?.role ?? "");
  if (!canImport) return { ok: false, error: "Você não tem permissão para importar cifras." };

  try {
    const page = await fetchChordPage(input.url);
    const { candidate, aiUsed } = await chooseChordCandidate(page.candidates);
    const { content, fixed: alignmentFixedByAi } = await repairPlainAlignment(candidate.content);
    const resolved = new URL(page.finalUrl);

    return {
      ok: true,
      data: {
        content,
        rawContent: candidate.content,
        sourceUrl: page.finalUrl,
        sourceTitle: page.title,
        hostname: resolved.hostname,
        aiUsed,
        alignmentFixedByAi,
      },
    };
  } catch (error) {
    if (error instanceof ChordPageImportError) {
      return { ok: false, error: error.message };
    }
    console.error("fetchChordFromUrl:", error);
    return { ok: false, error: "Não foi possível importar essa página agora." };
  }
}

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
