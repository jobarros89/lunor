"use client";

import Link from "next/link";
import { ArrowUpRight, Music2 } from "lucide-react";
import { useMemo, useState } from "react";
import { rotuloUltimaVez, type Song } from "@/lib/louvor";
import { SearchInput } from "@/components/ui/search-input";
import { FilterBar } from "@/components/ui/filter-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

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
      `${song.title} ${song.artist ?? ""}`
        .toLocaleLowerCase("pt-BR")
        .includes(normalized),
    );
  }, [normalized, songs]);

  return (
    <div className="space-y-5">
      <FilterBar
        result={`${filtered.length} ${filtered.length === 1 ? "música" : "músicas"}`}
      >
        <SearchInput
          label="Buscar música ou artista"
          value={query}
          onValueChange={setQuery}
          placeholder="Buscar música ou artista…"
        />
      </FilterBar>

      <div className="space-y-2">
        {filtered.map((song) => (
          <Link
            key={song.id}
            href={`/${churchSlug}/louvor/${song.id}`}
            className="group grid grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-2 rounded-xl border bg-card p-4 transition-colors hover:border-brand/40 hover:bg-muted/50"
          >
            <span
              className="flex size-10 items-center justify-center rounded-lg bg-brand-soft text-brand"
              aria-hidden="true"
            >
              <Music2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="break-words font-medium leading-snug">
                {song.title}
              </p>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {song.artist || "Artista não informado"}
              </p>
            </div>
            <ArrowUpRight
              className="size-4 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {song.default_key && (
                <span className="rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                  Tom {song.default_key}
                </span>
              )}
              {song.bpm && (
                <span className="rounded-md bg-muted px-2 py-1 tabular-nums">
                  {song.bpm} BPM
                </span>
              )}
              {song.time_signature && (
                <span
                  className="rounded-md bg-muted px-2 py-1"
                  aria-label={`Compasso ${song.time_signature}`}
                >
                  {song.time_signature}
                </span>
              )}
              <span className="py-1">
                {rotuloUltimaVez(lastUsed[song.id] ?? null)}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <EmptyState
            icon={<Music2 className="size-5" />}
            title={
              query ? "Nenhuma música encontrada" : "Seu acervo começa aqui"
            }
            description={
              query
                ? "Tente parte do título ou o nome do artista. Você também pode limpar a busca para ver todo o acervo."
                : "As músicas cadastradas pela equipe aparecerão aqui, com tom, BPM e compasso para o seu preparo."
            }
            action={
              query ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuery("")}
                >
                  Ver todo o acervo
                </Button>
              ) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
