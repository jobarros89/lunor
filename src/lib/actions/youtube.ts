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

export type SongMusicalMetadataCandidate = {
  defaultKey: string | null;
  bpm: number | null;
  timeSignature: string | null;
  source: "TheAudioDB" | "ReccoBeats";
  confidence: "alta" | "media" | "baixa";
  matchedTitle: string;
  matchedArtist: string;
};

const searchSchema = z.object({
  churchId: z.string().uuid(),
  query: z.string().trim().min(2, "Digite ao menos 2 caracteres").max(120),
});

const metadataSchema = z.object({
  churchId: z.string().uuid(),
  title: z.string().trim().min(1, "Informe o título").max(160),
  artist: z.string().trim().min(1, "Informe o artista").max(120),
  youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
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

type AudioDbTrack = {
  strTrack?: string | null;
  strArtist?: string | null;
  intTempo?: string | null;
  strTimeSignature?: string | null;
  strKey?: string | null;
  strMusicVid?: string | null;
};

type AudioDbSearchResponse = {
  track?: AudioDbTrack[] | null;
};

type ReccoBeatsTrack = {
  id?: string;
  trackTitle?: string;
  artists?: Array<{ name?: string }>;
  popularity?: number;
};

type ReccoBeatsSearchResponse = {
  content?: ReccoBeatsTrack[];
};

type ReccoBeatsAudioFeatures = {
  key?: number;
  mode?: number;
  tempo?: number;
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

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(official|oficial|video|vídeo|audio|áudio|lyrics?|letra|live|ao vivo|clipe|topic)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cleanLookupTerms(title: string, artist: string) {
  let lookupTitle = decodeYouTubeText(title)
    .replace(/[\[(][^\])]*(official|oficial|video|vídeo|audio|áudio|lyrics?|letra|live|ao vivo|clipe)[^\])]*[\])]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  let lookupArtist = decodeYouTubeText(artist)
    .replace(/\s*(?:-\s*Topic|VEVO|Oficial|Official)\s*$/i, "")
    .trim();

  const dash = lookupTitle.split(/\s+[–—-]\s+/).map((part) => part.trim());
  if (dash.length >= 2 && dash[0] && dash[1]) {
    const channel = normalized(lookupArtist);
    const left = normalized(dash[0]);
    const right = normalized(dash[1]);
    const leftIsChannel = channel.includes(left) || left.includes(channel);
    const rightIsChannel = channel.includes(right) || right.includes(channel);

    if (rightIsChannel && !leftIsChannel) {
      lookupTitle = dash[0];
      lookupArtist = dash[1];
    } else {
      lookupArtist = dash[0];
      lookupTitle = dash[1];
    }
  } else {
    const pipe = lookupTitle.split(/\s*\|\s*/).map((part) => part.trim());
    if (pipe.length >= 2 && pipe[0] && pipe[1]) {
      lookupTitle = pipe[0];
      lookupArtist = pipe[1];
    }
  }

  return { lookupTitle, lookupArtist };
}

function normalizedKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.trim().replace(/\s+major$/i, "").replace(/\s+minor$/i, "m");
  const match = compact.match(/^([A-Ga-g])([#b]?)(m?)$/);
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2]}${match[3]}`;
}

function reccoBeatsKey(key: number | undefined, mode: number | undefined): string | null {
  const keys = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  if (!Number.isInteger(key) || key === undefined || key < 0 || key >= keys.length) {
    return null;
  }
  return `${keys[key]}${mode === 0 ? "m" : ""}`;
}

function matchScore(track: ReccoBeatsTrack, title: string, artist: string): number {
  const expectedTitle = normalized(title);
  const expectedArtist = normalized(artist);
  const candidateTitle = normalized(track.trackTitle ?? "");
  const candidateArtists = normalized(
    (track.artists ?? []).map((item) => item.name ?? "").join(" ")
  );

  const titleScore = candidateTitle === expectedTitle
    ? 6
    : candidateTitle.includes(expectedTitle) || expectedTitle.includes(candidateTitle)
      ? 3
      : 0;
  const artistScore = candidateArtists === expectedArtist
    ? 4
    : candidateArtists.includes(expectedArtist) || expectedArtist.includes(candidateArtists)
      ? 2
      : 0;
  return titleScore + artistScore;
}

async function findOnReccoBeats(
  lookupTitle: string,
  lookupArtist: string
): Promise<SongMusicalMetadataCandidate | null> {
  const params = new URLSearchParams({ searchText: lookupTitle });
  const searchResponse = await fetch(
    `https://api.reccobeats.com/v1/track/search?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    }
  );
  if (!searchResponse.ok) {
    console.error("ReccoBeats search failed", searchResponse.status);
    return null;
  }

  const searchPayload = (await searchResponse.json()) as ReccoBeatsSearchResponse;
  const ranked = (searchPayload.content ?? [])
    .map((track) => ({ track, score: matchScore(track, lookupTitle, lookupArtist) }))
    .filter(({ track, score }) => Boolean(track.id) && score >= 6)
    .sort((left, right) =>
      right.score - left.score ||
      (right.track.popularity ?? 0) - (left.track.popularity ?? 0)
    );
  const match = ranked[0];
  if (!match?.track.id) return null;

  const featuresResponse = await fetch(
    `https://api.reccobeats.com/v1/track/${encodeURIComponent(match.track.id)}/audio-features`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    }
  );
  if (!featuresResponse.ok) {
    console.error("ReccoBeats audio features failed", featuresResponse.status);
    return null;
  }

  const features = (await featuresResponse.json()) as ReccoBeatsAudioFeatures;
  const roundedTempo = Math.round(features.tempo ?? 0);
  const bpm = roundedTempo >= 20 && roundedTempo <= 300 ? roundedTempo : null;
  const defaultKey = reccoBeatsKey(features.key, features.mode);
  if (!defaultKey && !bpm) return null;

  const matchedTitle = match.track.trackTitle?.trim() || lookupTitle;
  const matchedArtist = (match.track.artists ?? [])
    .map((item) => item.name?.trim())
    .filter((name): name is string => Boolean(name))
    .join(", ") || lookupArtist;
  return {
    defaultKey,
    bpm,
    timeSignature: null,
    source: "ReccoBeats",
    confidence: match.score >= 10 ? "alta" : match.score >= 8 ? "media" : "baixa",
    matchedTitle,
    matchedArtist,
  };
}

async function canManageMusic(churchId: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ data: isLeader }, { data: isCoord }] = await Promise.all([
    supabase.rpc("is_louvor_leader", { p_church: churchId }),
    supabase.rpc("is_church_coord", { p_church: churchId }),
  ]);
  return Boolean(isLeader || isCoord);
}

export async function findSongMusicalMetadata(
  raw: unknown
): Promise<ActionResult<SongMusicalMetadataCandidate | null>> {
  const parsed = metadataSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  if (!(await canManageMusic(parsed.data.churchId))) {
    return { ok: false, error: "Sem permissão para consultar dados musicais" };
  }

  const { lookupTitle, lookupArtist } = cleanLookupTerms(
    parsed.data.title,
    parsed.data.artist
  );
  if (!lookupTitle || !lookupArtist) return { ok: true, data: null };

  const params = new URLSearchParams({ s: lookupArtist, t: lookupTitle });
  try {
    const response = await fetch(
      `https://www.theaudiodb.com/api/v1/json/123/searchtrack.php?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 86_400 },
      }
    );
    if (!response.ok) {
      console.error("TheAudioDB search failed", response.status);
    } else {
      const payload = (await response.json()) as AudioDbSearchResponse;
      const track = payload.track?.[0];
      if (track) {
        const bpmValue = Number.parseInt(track.intTempo ?? "", 10);
        const bpm = Number.isInteger(bpmValue) && bpmValue >= 20 && bpmValue <= 300
          ? bpmValue
          : null;
        const defaultKey = normalizedKey(track.strKey);
        if (defaultKey || bpm) {
          const matchedTitle = track.strTrack?.trim() ?? lookupTitle;
          const matchedArtist = track.strArtist?.trim() ?? lookupArtist;
          const sameVideo = track.strMusicVid?.includes(parsed.data.youtubeVideoId) ?? false;
          const sameTitle = normalized(matchedTitle) === normalized(lookupTitle);
          const sameArtist = normalized(matchedArtist) === normalized(lookupArtist);
          const confidence = sameVideo || (sameTitle && sameArtist)
            ? "alta"
            : sameTitle || sameArtist
              ? "media"
              : "baixa";

          return {
            ok: true,
            data: {
              defaultKey,
              bpm,
              timeSignature: track.strTimeSignature?.trim() || null,
              source: "TheAudioDB",
              confidence,
              matchedTitle,
              matchedArtist,
            },
          };
        }
      }
    }
  } catch (error) {
    console.error("TheAudioDB request failed", error);
  }

  try {
    return { ok: true, data: await findOnReccoBeats(lookupTitle, lookupArtist) };
  } catch (error) {
    console.error("ReccoBeats request failed", error);
    return { ok: false, error: "Não foi possível consultar tom e BPM agora" };
  }
}

export async function searchYouTubeSongs(
  raw: unknown
): Promise<ActionResult<YouTubeSongCandidate[]>> {
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  if (!(await canManageMusic(parsed.data.churchId))) {
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
