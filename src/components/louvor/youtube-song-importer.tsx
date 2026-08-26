"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw, Search, Video } from "lucide-react";
import { createSong } from "@/lib/actions/louvor";
import {
  findSongMusicalMetadata,
  searchYouTubeSongs,
  type SongMusicalMetadataCandidate,
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
  const [defaultKey, setDefaultKey] = useState("");
  const [bpm, setBpm] = useState("");
  const [timeSignature, setTimeSignature] = useState("");
  const [metadata, setMetadata] = useState<SongMusicalMetadataCandidate | null>(null);
  const [metadataMessage, setMetadataMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [checkingMetadata, startMetadataSearch] = useTransition();
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

  function lookUpMetadata(
    candidate: YouTubeSongCandidate,
    lookupTitle: string,
    lookupArtist: string
  ) {
    setMetadata(null);
    setMetadataMessage(null);
    startMetadataSearch(async () => {
      const result = await findSongMusicalMetadata({
        churchId,
        title: lookupTitle,
        artist: lookupArtist,
        youtubeVideoId: candidate.videoId,
      });
      if (!result.ok) {
        setMetadataMessage(result.error ?? "Não foi possível consultar tom, BPM e compasso");
        return;
      }
      if (!result.data) {
        setMetadataMessage(
          "Tom, BPM e compasso não foram encontrados com segurança. Você pode informá-los manualmente."
        );
        return;
      }

      setMetadata(result.data);
      if (result.data.defaultKey) setDefaultKey(result.data.defaultKey);
      if (result.data.bpm) setBpm(String(result.data.bpm));
      if (result.data.timeSignature) setTimeSignature(result.data.timeSignature);
    });
  }

  function choose(candidate: YouTubeSongCandidate) {
    setSelected(candidate);
    setTitle(candidate.title);
    setArtist(candidate.channelTitle);
    setDefaultKey("");
    setBpm("");
    setTimeSignature("");
    setConfirmed(false);
    setError(null);
    lookUpMetadata(candidate, candidate.title, candidate.channelTitle);
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
        defaultKey,
        bpm: bpm ? Number(bpm) : undefined,
        timeSignature,
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
        <Video className="size-4" />
        Pesquisar no YouTube
      </Button>
    );
  }

  return (
    <div className="space-y-5 rounded-2xl border p-4">
      <div>
        <h3 className="font-semibold">Pesquisar no YouTube</h3>
        <p className="text-sm text-muted-foreground">
          Escolha a gravação de referência. O LUNOR tentará localizar tom, BPM
          e compasso, mas você confirma os dados antes de salvar.
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
                  <Video className="size-6" />
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
            <div className="space-y-2">
              <Label htmlFor="youtube-key">Tom</Label>
              <Input
                id="youtube-key"
                value={defaultKey}
                onChange={(event) => setDefaultKey(event.target.value)}
                maxLength={8}
                placeholder="Ex.: G ou F#m"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube-bpm">BPM</Label>
              <Input
                id="youtube-bpm"
                type="number"
                value={bpm}
                onChange={(event) => setBpm(event.target.value)}
                min={20}
                max={300}
                placeholder="20–300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="youtube-time-signature">Compasso (opcional)</Label>
              <Input
                id="youtube-time-signature"
                value={timeSignature}
                onChange={(event) => setTimeSignature(event.target.value)}
                maxLength={5}
                pattern="(?:[1-9]|[12][0-9]|3[0-2])/(?:1|2|4|8|16|32)"
                title="Informe um compasso como 4/4, 6/8 ou 12/8"
                placeholder="Ex.: 4/4 ou 6/8"
                inputMode="numeric"
              />
            </div>
          </div>

          {checkingMetadata && (
            <p className="text-sm text-muted-foreground">
              Buscando tom, BPM e compasso da gravação…
            </p>
          )}
          {metadata && !checkingMetadata && (
            <div className="rounded-xl border bg-background p-3 text-sm">
              <p className="font-medium">
                Dados sugeridos · confiança {metadata.confidence}
              </p>
              <p className="mt-1 text-muted-foreground">
                {metadata.matchedTitle} — {metadata.matchedArtist}
                {metadata.timeSignature
                  ? ` · compasso ${metadata.timeSignature}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Fonte: {metadata.source}. Confirme porque versões ao vivo podem
                usar outro tom ou andamento.
              </p>
            </div>
          )}
          {metadataMessage && !checkingMetadata && (
            <p className="text-sm text-muted-foreground">{metadataMessage}</p>
          )}

          <Button
            type="button"
            variant="outline"
            disabled={checkingMetadata || !title.trim() || !artist.trim()}
            onClick={() => lookUpMetadata(selected, title, artist)}
          >
            <RefreshCw className="size-4" />
            {checkingMetadata ? "Consultando…" : "Buscar dados musicais novamente"}
          </Button>

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
              Conferi o vídeo, o título, o artista, o tom, o BPM e o compasso. Quero criar
              esta música no acervo interno do LUNOR.
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
                setMetadata(null);
                setMetadataMessage(null);
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
          setMetadata(null);
          setMetadataMessage(null);
          setError(null);
        }}
      >
        Fechar pesquisa
      </Button>
    </div>
  );
}
