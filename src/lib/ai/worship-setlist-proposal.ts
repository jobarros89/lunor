import { createClient } from "@/lib/supabase/server";
import {
  buildWorshipTransitions,
  isWorshipMinistryName,
  type WorshipTransition,
} from "@/lib/ai/worship";

export type WorshipSetlistProposalSong = {
  position: number;
  songId: string;
  title: string;
  artist: string | null;
  defaultKey: string | null;
  bpm: number | null;
  timeSignature: string | null;
  usesLast120Days: number;
  lastUsedAt: string | null;
};

export type WorshipSetlistProposal = {
  kind: "worship_setlist_proposal";
  event: {
    id: string;
    title: string;
    startsAt: string;
  };
  songs: WorshipSetlistProposalSong[];
  transitions: WorshipTransition[];
  warnings: string[];
};

type WorshipProposalContext = {
  churchId: string;
  ministryId: string;
  ministryName: string;
};

type RelatedEvent =
  | { id: string; title: string; starts_at: string }
  | { id: string; title: string; starts_at: string }[]
  | null;

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function assertWorshipScope(context: WorshipProposalContext) {
  if (!isWorshipMinistryName(context.ministryName)) {
    throw new Error("worship_scope_required");
  }
}

export async function buildWorshipSetlistProposal(
  context: WorshipProposalContext,
  input: { eventId: string; songIds: string[] }
): Promise<WorshipSetlistProposal> {
  assertWorshipScope(context);

  const uniqueSongIds = [...new Set(input.songIds)];
  if (uniqueSongIds.length < 2 || uniqueSongIds.length > 6) {
    throw new Error("worship_proposal_song_count_invalid");
  }

  const supabase = await createClient();
  const [{ data: event, error: eventError }, { data: songs, error: songsError }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, starts_at")
        .eq("church_id", context.churchId)
        .eq("id", input.eventId)
        .maybeSingle(),
      supabase
        .from("songs")
        .select("id, title, artist, default_key, bpm, time_signature")
        .eq("church_id", context.churchId)
        .eq("active", true)
        .in("id", uniqueSongIds),
    ]);

  if (eventError || !event) throw new Error("event_not_found");
  if (songsError) throw new Error("worship_library_unavailable");
  if ((songs ?? []).length !== uniqueSongIds.length) {
    throw new Error("worship_proposal_song_not_found");
  }

  const eventDate = new Date(event.starts_at);
  const since120 = new Date(
    eventDate.getTime() - 120 * 24 * 60 * 60 * 1000
  ).toISOString();
  const usageBySong = new Map<string, { count: number; lastUsedAt: string | null }>();

  const { data: usageRows, error: usageError } = await supabase
    .from("setlist_items")
    .select("song_id, events!inner(id, title, starts_at)")
    .eq("church_id", context.churchId)
    .in("song_id", uniqueSongIds)
    .neq("event_id", event.id)
    .gte("events.starts_at", since120)
    .lt("events.starts_at", event.starts_at)
    .order("starts_at", { referencedTable: "events", ascending: false })
    .limit(500);

  if (usageError) throw new Error("worship_history_unavailable");

  for (const row of usageRows ?? []) {
    const relatedEvent = firstRelated(row.events as unknown as RelatedEvent);
    if (!relatedEvent) continue;
    const current = usageBySong.get(row.song_id) ?? {
      count: 0,
      lastUsedAt: null,
    };
    current.count += 1;
    if (!current.lastUsedAt || relatedEvent.starts_at > current.lastUsedAt) {
      current.lastUsedAt = relatedEvent.starts_at;
    }
    usageBySong.set(row.song_id, current);
  }

  const songsById = new Map((songs ?? []).map((song) => [song.id, song]));
  const proposalSongs: WorshipSetlistProposalSong[] = uniqueSongIds.map(
    (songId, index) => {
      const song = songsById.get(songId);
      if (!song) throw new Error("worship_proposal_song_not_found");
      const usage = usageBySong.get(songId) ?? { count: 0, lastUsedAt: null };
      return {
        position: index + 1,
        songId,
        title: song.title,
        artist: song.artist,
        defaultKey: song.default_key,
        bpm: song.bpm,
        timeSignature: song.time_signature,
        usesLast120Days: usage.count,
        lastUsedAt: usage.lastUsedAt,
      };
    }
  );

  const transitions = buildWorshipTransitions(
    proposalSongs.map((song) => ({
      position: song.position,
      title: song.title,
      effectiveKey: song.defaultKey,
      bpm: song.bpm,
    }))
  );

  const warnings: string[] = [];
  if (proposalSongs.some((song) => !song.defaultKey)) warnings.push("Há música sem tom cadastrado.");
  if (proposalSongs.some((song) => !song.bpm)) warnings.push("Há música sem BPM cadastrado.");
  if (proposalSongs.some((song) => !song.timeSignature)) warnings.push("Há música sem compasso cadastrado.");
  if (proposalSongs.some((song) => song.usesLast120Days >= 3)) {
    warnings.push("Há música com uso frequente nos últimos 120 dias.");
  }
  if (transitions.some((transition) => transition.tempoChange === "large")) {
    warnings.push("Há mudança grande de BPM entre músicas consecutivas.");
  }
  if (transitions.some((transition) => transition.keyChange === "far")) {
    warnings.push("Há mudança tonal ampla entre músicas consecutivas.");
  }

  return {
    kind: "worship_setlist_proposal",
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
    },
    songs: proposalSongs,
    transitions,
    warnings,
  };
}

export function isWorshipSetlistProposal(
  value: unknown
): value is WorshipSetlistProposal {
  if (!value || typeof value !== "object") return false;
  const proposal = value as Record<string, unknown>;
  return (
    proposal.kind === "worship_setlist_proposal" &&
    typeof proposal.event === "object" &&
    Array.isArray(proposal.songs)
  );
}
