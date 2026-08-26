"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  searchSpotifyTracks,
  type SpotifyTrackCandidate,
} from "@/lib/integrations/spotify";
import type { ActionResult } from "./types";

const searchSchema = z.object({
  churchId: z.string().uuid(),
  query: z.string().trim().min(2, "Digite ao menos 2 caracteres").max(120),
});

async function originFromRequest() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("APP_ORIGIN_UNAVAILABLE");
  return `${protocol}://${host}`;
}

export async function searchChurchSpotifyTracks(
  raw: unknown
): Promise<ActionResult<SpotifyTrackCandidate[]>> {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const [{ data: isLeader }, { data: isCoord }] = await Promise.all([
    supabase.rpc("is_louvor_leader", { p_church: parsed.data.churchId }),
    supabase.rpc("is_church_coord", { p_church: parsed.data.churchId }),
  ]);
  if (!isLeader && !isCoord) {
    return { ok: false, error: "Sem permissão para pesquisar no Spotify" };
  }

  try {
    const tracks = await searchSpotifyTracks({
      churchId: parsed.data.churchId,
      query: parsed.data.query,
      origin: await originFromRequest(),
    });
    if (!tracks) {
      return {
        ok: false,
        error: "Conecte primeiro a conta oficial do Spotify",
      };
    }
    return { ok: true, data: tracks };
  } catch (error) {
    console.error("Spotify search failed", error);
    return { ok: false, error: "Não foi possível pesquisar no Spotify agora" };
  }
}

const linkSchema = z.object({
  churchId: z.string().uuid(),
  churchSlug: z.string().min(2),
  songId: z.string().uuid(),
  spotifyTrackId: z.string().regex(/^[A-Za-z0-9]{22}$/),
});

export async function confirmSpotifyTrack(
  raw: unknown
): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Faixa do Spotify inválida" };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("songs")
    .update({
      spotify_track_id: d.spotifyTrackId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", d.songId)
    .eq("church_id", d.churchId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, error: "Sem permissão para vincular esta faixa" };
  }
  revalidatePath(`/${d.churchSlug}/louvor/${d.songId}`);
  return { ok: true, data: undefined };
}
