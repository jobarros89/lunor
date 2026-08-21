"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const songSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe o nome da música").max(160),
  artist: z.string().max(120).default(""),
  defaultKey: z.string().max(8).default(""),
  bpm: z.coerce.number().int().min(20).max(300).optional(),
  lyrics: z.string().max(20000).default(""),
  link: z.string().max(500).default(""),
});

/** Cadastra a música no acervo da igreja — uma vez, para usar em todos os cultos. */
export async function createSong(
  raw: unknown
): Promise<ActionResult<{ songId: string }>> {
  const parsed = songSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: created, error } = await supabase
    .from("songs")
    .insert({
      church_id: d.churchId,
      title: d.title,
      artist: d.artist || null,
      default_key: d.defaultKey || null,
      bpm: d.bpm ?? null,
      lyrics: d.lyrics || null,
      link: d.link || null,
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") return { ok: false, error: "Essa música já está no acervo" };
    return { ok: false, error: "Sem permissão para mexer no acervo" };
  }
  revalidatePath(`/${d.churchSlug}/louvor`);
  return { ok: true, data: { songId: created.id } };
}

const updateSongSchema = songSchema.extend({ songId: z.string().uuid() });

export async function updateSong(raw: unknown): Promise<ActionResult> {
  const parsed = updateSongSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("songs")
    .update({
      title: d.title,
      artist: d.artist || null,
      default_key: d.defaultKey || null,
      bpm: d.bpm ?? null,
      lyrics: d.lyrics || null,
      link: d.link || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.songId)
    .eq("church_id", d.churchId)
    .select("id")
    .maybeSingle();
  if (error || !updated)
    return { ok: false, error: "Sem permissão para editar a música" };
  revalidatePath(`/${d.churchSlug}/louvor`);
  revalidatePath(`/${d.churchSlug}/louvor/${d.songId}`);
  return { ok: true, data: undefined };
}

/** Tira do acervo sem apagar: repertórios antigos continuam legíveis. */
export async function archiveSong(
  churchSlug: string,
  songId: string,
  active: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("songs")
    .update({ active })
    .eq("id", songId)
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: "Sem permissão" };
  revalidatePath(`/${churchSlug}/louvor`);
  revalidatePath(`/${churchSlug}/louvor/${songId}`);
  return { ok: true, data: undefined };
}

const addItemSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  songId: z.string().uuid(),
  keyOverride: z.string().max(8).default(""),
  notes: z.string().max(300).default(""),
});

/** Põe a música no fim da sequência do culto. */
export async function addToSetlist(raw: unknown): Promise<ActionResult> {
  const parsed = addItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const [{ data: song }, { data: ultimo }] = await Promise.all([
    supabase
      .from("songs")
      .select("id")
      .eq("id", d.songId)
      .eq("church_id", d.churchId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("setlist_items")
      .select("position")
      .eq("church_id", d.churchId)
      .eq("event_id", d.eventId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!song) return { ok: false, error: "Música ativa não encontrada neste acervo" };

  const { error } = await supabase.from("setlist_items").insert({
    church_id: d.churchId,
    event_id: d.eventId,
    song_id: d.songId,
    position: (ultimo?.position ?? 0) + 1,
    key_override: d.keyOverride || null,
    notes: d.notes || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Essa música já está na sequência" };
    return { ok: false, error: "Sem permissão para montar o repertório" };
  }
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

export async function removeFromSetlist(
  churchSlug: string,
  eventId: string,
  itemId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from("setlist_items")
    .delete()
    .eq("id", itemId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();
  if (error || !removed) return { ok: false, error: "Sem permissão para remover" };
  revalidatePath(`/${churchSlug}/escalas/${eventId}`);
  return { ok: true, data: undefined };
}

const updateSetlistKeySchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  itemId: z.string().uuid(),
  keyOverride: z
    .string()
    .trim()
    .max(8)
    .regex(/^(?:[A-Ga-g](?:#|b)?m?)?$/, "Informe um tom como C, Bb ou F#m")
    .transform((value) =>
      value ? `${value[0].toUpperCase()}${value.slice(1)}` : ""
    ),
});

/** Altera somente o tom usado por esta música neste culto. */
export async function updateSetlistItemKey(raw: unknown): Promise<ActionResult> {
  const parsed = updateSetlistKeySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("setlist_items")
    .update({ key_override: d.keyOverride || null })
    .eq("id", d.itemId)
    .eq("event_id", d.eventId)
    .eq("church_id", d.churchId)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, error: "Sem permissão para alterar o tom" };
  }

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

/**
 * Troca uma música de lugar na sequência.
 *
 * A unique (event_id, position) impede a troca direta — duas músicas passariam
 * pela mesma posição no meio do caminho. Por isso a vizinha estaciona numa
 * posição acima de todas as usadas; negativo não serve porque o check exige
 * position > 0.
 */
export async function moveSetlistItem(
  churchSlug: string,
  eventId: string,
  itemId: string,
  direcao: "cima" | "baixo"
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("setlist_items")
    .select("id, position")
    .eq("event_id", eventId)
    .order("position");
  if (!itens) return { ok: false, error: "Repertório não encontrado" };

  const i = itens.findIndex((x) => x.id === itemId);
  const j = direcao === "cima" ? i - 1 : i + 1;
  if (i < 0) return { ok: false, error: "Item não encontrado neste repertório" };
  if (j < 0 || j >= itens.length) return { ok: true, data: undefined };

  const atual = itens[i];
  const vizinha = itens[j];
  const estacionamento = Math.max(...itens.map((x) => x.position)) + 1;
  const { data: vizinhaEstacionada, error } = await supabase
    .from("setlist_items")
    .update({ position: estacionamento })
    .eq("id", vizinha.id)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();
  if (error || !vizinhaEstacionada)
    return { ok: false, error: "Sem permissão para reordenar" };

  const { data: atualMovido, error: atualError } = await supabase
    .from("setlist_items")
    .update({ position: vizinha.position })
    .eq("id", atual.id)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();
  if (atualError || !atualMovido) {
    await supabase
      .from("setlist_items")
      .update({ position: vizinha.position })
      .eq("id", vizinha.id)
      .eq("event_id", eventId);
    return { ok: false, error: "Não foi possível alterar a ordem" };
  }

  const { data: vizinhaMovida, error: vizinhaError } = await supabase
    .from("setlist_items")
    .update({ position: atual.position })
    .eq("id", vizinha.id)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();
  if (vizinhaError || !vizinhaMovida) {
    await supabase
      .from("setlist_items")
      .update({ position: atual.position })
      .eq("id", atual.id)
      .eq("event_id", eventId);
    await supabase
      .from("setlist_items")
      .update({ position: vizinha.position })
      .eq("id", vizinha.id)
      .eq("event_id", eventId);
    return { ok: false, error: "Não foi possível concluir a nova ordem" };
  }

  revalidatePath(`/${churchSlug}/escalas/${eventId}`);
  return { ok: true, data: undefined };
}

/**
 * Fecha o repertório e avisa a equipe.
 *
 * Este é o momento em que a escolha vira compromisso: enquanto está em
 * rascunho, o líder arrasta músicas na quinta à noite sem notificar ninguém.
 */
export async function publishSetlist(
  churchSlug: string,
  eventId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: itens } = await supabase
    .from("setlist_items")
    .select("id")
    .eq("event_id", eventId);
  if (!itens?.length) return { ok: false, error: "Escolha as músicas antes de publicar" };

  const { data: evento, error } = await supabase
    .from("events")
    .update({ setlist_status: "publicado", setlist_published_at: new Date().toISOString() })
    .eq("id", eventId)
    .select("title, starts_at")
    .single();
  if (error) return { ok: false, error: "Sem permissão para publicar o repertório" };

  // Avisa quem trabalha no culto — a mídia precisa disso para montar o Holyrics.
  const { data: escalados } = await supabase
    .from("assignments")
    .select("user_id")
    .eq("event_id", eventId);
  await notifyUsers(
    (escalados ?? []).map((a) => a.user_id),
    {
      title: "Repertório definido",
      body: `${evento.title}: ${itens.length} ${itens.length === 1 ? "música" : "músicas"} na sequência.`,
      url: `/${churchSlug}/escalas/${eventId}`,
    }
  );

  revalidatePath(`/${churchSlug}/escalas/${eventId}`);
  return { ok: true, data: undefined };
}

/** Reabre para ajuste — quem já foi avisado continua vendo a versão anterior. */
export async function unpublishSetlist(
  churchSlug: string,
  eventId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ setlist_status: "rascunho" })
    .eq("id", eventId);
  if (error) return { ok: false, error: "Sem permissão" };
  revalidatePath(`/${churchSlug}/escalas/${eventId}`);
  return { ok: true, data: undefined };
}
