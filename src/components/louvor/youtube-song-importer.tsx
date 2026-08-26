"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Search, Youtube } from "lucide-react";
import { createSong } from "@/lib/actions/louvor";
import {
  searchYouTubeSongs,
  type YouTubeSongCandidate,
} from "@/lib/actions/youtube";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function YouTubeSongImporter({
  churchId,
  churchSlug,
}: {
  churchId: string;
  churchSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<YouTubeSongCandidate[]>([]);
  const [selected, setSelected] = useState<YouTubeSongCandidate | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSaving] = useTransition();

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSelected(null);
    setConfirmed(false);
    startSearch(async () => {
      const result = await searchYouTubeSongs({ churchId, query });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível pesquisar");
        setResults([]);
        return;
      }
      setResults(result.data);
      if (!result.data.length) setError("Nenhum vídeo encontrado");
    });
  }

  function choose(candidate: YouTubeSongCandidate) {
    setSelected(candidate);
    setTitle(candidate.title);
    setArtist(candidate.channelTitle);
    setConfirmed(false);
    setError(null);
  }

  function save() {
    if (!selected || !confirmed || !title.trim()) return;
    setError(null);
    startSaving(async () => {
      const result = await createSong({
        churchSlug,
        churchId,
        title,
        artist,
        defaultKey: "",
        bpm: undefined,
        lyrics: "",
        chordChart: "",
        link: `https://www.youtube.com/watch?v=${selected.videoId}`,
        youtubeVideoId: selected.videoId,
        spotifyTrackId: "",
      });
      if (!result.ok) {
        setError(result.error ?? "Não foi possível importar a música");
        return;
      }
      router.push(`/${churchSlug}/louvor/${result.data.songId}`);
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full"
        onClick={() => setOpen(true)}
      >
        <Youtube className="size-4" />
        Pesquisar no YouTube
      </Button>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border p-4">
      <div>
        <h3 className="font-semibold">Pesquisar no YouTube</h3>
        <p className="text-sm text-muted-foreground">
          Escolha a gravação de referência. Letra, cifra e arranjos continuam
          armazenados e revisados dentro do LUNOR.
        </p>
      </div>

      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          minLength={2}
          maxLength={120}
          placeholder="Ex.: Bondade de Deus Isaias Saad"
          className="h-11 rounded-xl"
          required
        />
        <Button type="submit" disabled={searching} className="h-11 rounded-xl">
          <Search className="size-4" />
          {searching ? "Pesquisando…" : "Pesquisar"}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!selected && results.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((candidate) => (
            <button
              type="button"
              key={candidate.videoId}
              onClick={() => choose(candidate)}
              className="flex min-w-0 gap-3 rounded-2xl border p-3 text-left transition-colors hover:bg-accent/40"
            >
              {candidate.thumbnailUrl ? (
                <img
                  src={candidate.thumbnailUrl}
                  alt=""
                  className="h-16 w-28 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Youtube className="size-6" />
                </div>
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-medium">
                  {candidate.title}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {candidate.channelTitle}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="space-y-4 rounded-2xl bg-muted/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Check className="size-4" />
            Revise antes de importar
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="youtube-title">Título no LUNOR</Label>
              <Input
                id="youtube-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube-artist">Artista no LUNOR</Label>
              <Input
                id="youtube-artist"
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Vídeo confirmado: youtube.com/watch?v={selected.videoId}. O YouTube
            não será usado como fonte de letra ou cifra.
          </p>
          <label className="flex items-start gap-3 rounded-xl border bg-background p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Conferi o vídeo, o título e o artista. Quero criar esta música no
              acervo interno do LUNOR.
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={save}
              disabled={!confirmed || !title.trim() || saving}
            >
              {saving ? "Importando…" : "Confirmar importação"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setSelected(null);
                setConfirmed(false);
              }}
            >
              Escolher outro vídeo
            </Button>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="ghost"
        disabled={searching || saving}
        onClick={() => {
          setOpen(false);
          setResults([]);
          setSelected(null);
          setError(null);
        }}
      >
        Fechar pesquisa
      </Button>
    </div>
  );
}
