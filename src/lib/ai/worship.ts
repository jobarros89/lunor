import { createClient } from "@/lib/supabase/server";

export type WorshipContext = {
  churchId: string;
  ministryId: string;
  ministryName: string;
};

type RelatedEvent =
  | { id: string; title: string; starts_at: string }
  | { id: string; title: string; starts_at: string }[]
  | null;

type RelatedSong =
  | {
      id: string;
      title: string;
      artist: string | null;
      default_key: string | null;
      bpm: number | null;
      time_signature: string | null;
      youtube_video_id: string | null;
      spotify_track_id: string | null;
      lyrics: string | null;
      chord_chart: string | null;
    }
  | {
      id: string;
      title: string;
      artist: string | null;
      default_key: string | null;
      bpm: number | null;
      time_signature: string | null;
      youtube_video_id: string | null;
      spotify_track_id: string | null;
      lyrics: string | null;
      chord_chart: string | null;
    }[]
  | null;

export type WorshipSequenceItem = {
  position: number;
  songId: string;
  title: string;
  artist: string | null;
  effectiveKey: string | null;
  defaultKey: string | null;
  keyOverride: string | null;
  bpm: number | null;
  timeSignature: string | null;
  notes: string | null;
  lastUsedAt: string | null;
  usesLast90Days: number;
};

export type WorshipTransition = {
  fromPosition: number;
  toPosition: number;
  fromTitle: string;
  toTitle: string;
  fromKey: string | null;
  toKey: string | null;
  keyDistance: number | null;
  keyChange: "near" | "moderate" | "far" | "unknown";
  fromBpm: number | null;
  toBpm: number | null;
  bpmDelta: number | null;
  tempoChange: "small" | "moderate" | "large" | "unknown";
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function isWorshipMinistryName(name: string) {
  const normalized = normalize(name);
  return (
    normalized.includes("louvor") ||
    normalized.includes("worship") ||
    normalized.includes("musica")
  );
}

function assertWorshipScope(context: WorshipContext) {
  if (!isWorshipMinistryName(context.ministryName)) {
    throw new Error("worship_scope_required");
  }
}

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
};

function keyRoot(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^([A-Ga-g])([#b]?)/);
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2]}`;
}

export function keySemitoneDistance(fromKey: string | null, toKey: string | null) {
  const fromRoot = keyRoot(fromKey);
  const toRoot = keyRoot(toKey);
  if (!fromRoot || !toRoot) return null;
  const from = NOTE_TO_SEMITONE[fromRoot];
  const to = NOTE_TO_SEMITONE[toRoot];
  if (from === undefined || to === undefined) return null;
  const raw = Math.abs(from - to);
  return Math.min(raw, 12 - raw);
}

export function buildWorshipTransitions(
  sequence: Array<Pick<WorshipSequenceItem, "position" | "title" | "effectiveKey" | "bpm">>
): WorshipTransition[] {
  return sequence.slice(0, -1).map((item, index) => {
    const next = sequence[index + 1];
    const keyDistance = keySemitoneDistance(item.effectiveKey, next.effectiveKey);
    const bpmDelta =
      item.bpm !== null && next.bpm !== null ? Math.abs(next.bpm - item.bpm) : null;

    return {
      fromPosition: item.position,
      toPosition: next.position,
      fromTitle: item.title,
      toTitle: next.title,
      fromKey: item.effectiveKey,
      toKey: next.effectiveKey,
      keyDistance,
      keyChange:
        keyDistance === null
          ? "unknown"
          : keyDistance <= 2
            ? "near"
            : keyDistance <= 5
              ? "moderate"
              : "far",
      fromBpm: item.bpm,
      toBpm: next.bpm,
      bpmDelta,
      tempoChange:
        bpmDelta === null
          ? "unknown"
          : bpmDelta <= 12
            ? "small"
            : bpmDelta <= 30
              ? "moderate"
              : "large",
    };
  });
}

export async function getWorshipLibraryInsights(
  context: WorshipContext,
  input: { limit?: number; historyDays?: number } = {}
) {
  assertWorshipScope(context);
  const supabase = await createClient();
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const historyDays = Math.min(Math.max(input.historyDays ?? 120, 14), 365);
  const since = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: songs, error: songsError, count } = await supabase
    .from("songs")
    .select(
      "id, title, artist, default_key, bpm, time_signature, youtube_video_id, spotify_track_id, lyrics, chord_chart",
      { count: "exact" }
    )
    .eq("church_id", context.churchId)
    .eq("active", true)
    .order("title")
    .limit(limit);

  if (songsError) throw new Error("worship_library_unavailable");

  const songIds = (songs ?? []).map((song) => song.id);
  const usageBySong = new Map<
    string,
    { count: number; lastUsedAt: string | null; recentEvents: Array<{ id: string; title: string; startsAt: string }> }
  >();

  if (songIds.length > 0) {
    const { data: usageRows, error: usageError } = await supabase
      .from("setlist_items")
      .select("song_id, key_override, events!inner(id, title, starts_at)")
      .eq("church_id", context.churchId)
      .in("song_id", songIds)
      .gte("events.starts_at", since)
      .order("starts_at", { referencedTable: "events", ascending: false })
      .limit(Math.min(limit * 25, 1000));

    if (usageError) throw new Error("worship_history_unavailable");

    for (const row of usageRows ?? []) {
      const event = firstRelated(row.events as unknown as RelatedEvent);
      if (!event) continue;
      const current = usageBySong.get(row.song_id) ?? {
        count: 0,
        lastUsedAt: null,
        recentEvents: [],
      };
      current.count += 1;
      if (!current.lastUsedAt || event.starts_at > current.lastUsedAt) {
        current.lastUsedAt = event.starts_at;
      }
      if (!current.recentEvents.some((item) => item.id === event.id) && current.recentEvents.length < 5) {
        current.recentEvents.push({ id: event.id, title: event.title, startsAt: event.starts_at });
      }
      usageBySong.set(row.song_id, current);
    }
  }

  const enriched = (songs ?? []).map((song) => {
    const usage = usageBySong.get(song.id) ?? { count: 0, lastUsedAt: null, recentEvents: [] };
    const missingMetadata = [
      !song.default_key ? "tom" : null,
      !song.bpm ? "bpm" : null,
      !song.time_signature ? "compasso" : null,
    ].filter((item): item is string => Boolean(item));

    return {
      id: song.id,
      title: song.title,
      artist: song.artist,
      defaultKey: song.default_key,
      bpm: song.bpm,
      timeSignature: song.time_signature,
      hasYouTube: Boolean(song.youtube_video_id),
      hasSpotify: Boolean(song.spotify_track_id),
      hasLyrics: Boolean(song.lyrics?.trim()),
      hasChordChart: Boolean(song.chord_chart?.trim()),
      missingMetadata,
      usageCountInWindow: usage.count,
      lastUsedAt: usage.lastUsedAt,
      recentEvents: usage.recentEvents,
    };
  });

  const missingKey = enriched.filter((song) => !song.defaultKey).length;
  const missingBpm = enriched.filter((song) => !song.bpm).length;
  const missingTimeSignature = enriched.filter((song) => !song.timeSignature).length;
  const neverUsedInWindow = enriched.filter((song) => song.usageCountInWindow === 0).length;

  return {
    kind: "worship_library_insights" as const,
    ministry: context.ministryName,
    historyDays,
    totalActiveSongs: count ?? enriched.length,
    returnedSongs: enriched.length,
    truncated: (count ?? enriched.length) > enriched.length,
    summary: {
      missingKey,
      missingBpm,
      missingTimeSignature,
      neverUsedInWindow,
    },
    songs: enriched,
  };
}

export async function analyzeWorshipSetlist(
  context: WorshipContext,
  input: { eventId: string }
) {
  assertWorshipScope(context);
  const supabase = await createClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, title, starts_at")
    .eq("church_id", context.churchId)
    .eq("id", input.eventId)
    .maybeSingle();

  if (eventError || !event) throw new Error("event_not_found");

  const { data: rows, error: setlistError } = await supabase
    .from("setlist_items")
    .select(
      "id, position, key_override, notes, songs!inner(id, title, artist, default_key, bpm, time_signature, youtube_video_id, spotify_track_id, lyrics, chord_chart)"
    )
    .eq("church_id", context.churchId)
    .eq("event_id", event.id)
    .order("position");

  if (setlistError) throw new Error("worship_setlist_unavailable");

  const songIds = (rows ?? [])
    .map((row) => firstRelated(row.songs as unknown as RelatedSong)?.id ?? null)
    .filter((id): id is string => Boolean(id));

  const historyBySong = new Map<string, { lastUsedAt: string | null; uses: number }>();
  if (songIds.length > 0) {
    const eventDate = new Date(event.starts_at);
    const since90 = new Date(eventDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: historyRows, error: historyError } = await supabase
      .from("setlist_items")
      .select("song_id, events!inner(id, title, starts_at)")
      .eq("church_id", context.churchId)
      .in("song_id", songIds)
      .neq("event_id", event.id)
      .gte("events.starts_at", since90)
      .lt("events.starts_at", event.starts_at)
      .order("starts_at", { referencedTable: "events", ascending: false })
      .limit(1000);

    if (historyError) throw new Error("worship_history_unavailable");

    for (const row of historyRows ?? []) {
      const relatedEvent = firstRelated(row.events as unknown as RelatedEvent);
      if (!relatedEvent) continue;
      const current = historyBySong.get(row.song_id) ?? { lastUsedAt: null, uses: 0 };
      current.uses += 1;
      if (!current.lastUsedAt || relatedEvent.starts_at > current.lastUsedAt) {
        current.lastUsedAt = relatedEvent.starts_at;
      }
      historyBySong.set(row.song_id, current);
    }
  }

  const sequence: WorshipSequenceItem[] = (rows ?? []).flatMap((row) => {
    const song = firstRelated(row.songs as unknown as RelatedSong);
    if (!song) return [];
    const history = historyBySong.get(song.id) ?? { lastUsedAt: null, uses: 0 };
    return [
      {
        position: row.position,
        songId: song.id,
        title: song.title,
        artist: song.artist,
        effectiveKey: row.key_override || song.default_key,
        defaultKey: song.default_key,
        keyOverride: row.key_override,
        bpm: song.bpm,
        timeSignature: song.time_signature,
        notes: row.notes,
        lastUsedAt: history.lastUsedAt,
        usesLast90Days: history.uses,
      },
    ];
  });

  const transitions = buildWorshipTransitions(sequence);
  return {
    kind: "worship_setlist_analysis" as const,
    event: { id: event.id, title: event.title, startsAt: event.starts_at },
    ministry: context.ministryName,
    summary: {
      songs: sequence.length,
      missingKey: sequence.filter((song) => !song.effectiveKey).length,
      missingBpm: sequence.filter((song) => !song.bpm).length,
      missingTimeSignature: sequence.filter((song) => !song.timeSignature).length,
      recentlyRepeated: sequence.filter((song) => song.usesLast90Days > 0).length,
      largeTempoChanges: transitions.filter((item) => item.tempoChange === "large").length,
      farKeyChanges: transitions.filter((item) => item.keyChange === "far").length,
    },
    sequence,
    transitions,
  };
}
