"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { rotuloUltimaVez, type Song } from "@/lib/louvor";

export function SongLibrary({
  churchSlug,
  songs,
  lastUsed,
}: {
  churchSlug: string;
  songs: Song[];
  lastUsed: Record<string, string | null>;
}) {
  const [query, setQuery] = useState("");
  const normalized = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = useMemo(() => {
    if (!normalized) return songs;
    return songs.filter((song) =>
      `${song.title} ${song.artist ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalized)
    );
  }, [normalized, songs]);

  return (
    <div className="space-y-5">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar música ou artista…"
          className="h-14 w-full rounded-2xl border bg-background pl-12 pr-4 text-base outline-none transition focus:border-foreground/40 focus:ring-2 focus:ring-foreground/10"
          type="search"
          autoComplete="off"
        />
      </label>

      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <p className="text-sm font-medium">
          {filtered.length} {filtered.length === 1 ? "música" : "músicas"}
        </p>
        {query && filtered.length !== songs.length && (
          <button type="button" onClick={() => setQuery("")} className="text-xs text-muted-foreground underline underline-offset-4">
            Limpar busca
          </button>
        )}
      </div>

      <div className="divide-y">
        {filtered.map((song) => (
          <Link
            key={song.id}
            href={`/${churchSlug}/louvor/${song.id}`}
            className="group grid gap-2 py-4 transition hover:opacity-70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{song.title}</p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {song.artist || "Artista não informado"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:justify-end">
              {song.default_key && <span>Tom {song.default_key}</span>}
              {song.bpm && <span>{song.bpm} BPM</span>}
              {song.time_signature && <span>{song.time_signature}</span>}
              <span>{rotuloUltimaVez(lastUsed[song.id] ?? null)}</span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma música encontrada.</p>
        )}
      </div>
    </div>
  );
}
