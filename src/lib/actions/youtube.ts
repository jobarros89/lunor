"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

export type YouTubeSongCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  publishedAt: string;
};

const searchSchema = z.object({
  churchId: z.string().uuid(),
  query: z.string().trim().min(2, "Digite ao menos 2 caracteres").max(120),
});

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        medium?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
  error?: { message?: string };
};

function decodeYouTubeText(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    quot: '"',
    lt: "<",
    gt: ">",
  };

  return value.replace(
    /&(#(?:x[0-9a-f]+|\d+)|amp|apos|quot|lt|gt);/gi,
    (entity, code: string) => {
      if (code[0] !== "#") return named[code.toLowerCase()] ?? entity;
      const numeric =
        code[1]?.toLowerCase() === "x"
          ? Number.parseInt(code.slice(2), 16)
          : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
    }
  );
}

export async function searchYouTubeSongs(
  raw: unknown
): Promise<ActionResult<YouTubeSongCandidate[]>> {
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
    return { ok: false, error: "Sem permissão para pesquisar o catálogo" };
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "A pesquisa do YouTube ainda não foi configurada nesta instalação",
    };
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: "8",
    safeSearch: "moderate",
    relevanceLanguage: "pt",
    regionCode: "BR",
    q: parsed.data.query,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }
    );
    const payload = (await response.json()) as YouTubeSearchResponse;
    if (!response.ok) {
      console.error("YouTube search failed", response.status, payload.error?.message);
      return {
        ok: false,
        error:
          response.status === 403
            ? "A cota ou a chave do YouTube precisa ser verificada"
            : "Não foi possível pesquisar no YouTube agora",
      };
    }

    const candidates = (payload.items ?? []).flatMap((item) => {
      const videoId = item.id?.videoId;
      const snippet = item.snippet;
      if (!videoId || !snippet?.title) return [];

      return [
        {
          videoId,
          title: decodeYouTubeText(snippet.title),
          channelTitle: decodeYouTubeText(snippet.channelTitle ?? ""),
          thumbnailUrl:
            snippet.thumbnails?.medium?.url ??
            snippet.thumbnails?.default?.url ??
            null,
          publishedAt: snippet.publishedAt ?? "",
        },
      ];
    });

    return { ok: true, data: candidates };
  } catch (error) {
    console.error("YouTube search request failed", error);
    return { ok: false, error: "Não foi possível conectar ao YouTube agora" };
  }
}
