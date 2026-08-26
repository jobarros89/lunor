"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Music,
  Pencil,
  Send,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listaParaHolyrics, type SetlistItem } from "@/lib/louvor";
import { transposeChordChart } from "@/lib/music/transpose";
import {
  moveSetlistItem,
  publishSetlist,
  removeFromSetlist,
  unpublishSetlist,
  updateSetlistItemKey,
} from "@/lib/actions/louvor";

type Props = {
  churchSlug: string;
  churchId: string;
  eventId: string;
  itens: SetlistItem[];
  publicado: boolean;
  publicadoEm: string | null;
  youtubePlaylistUrl: string | null;
  youtubePlaylistError: string | null;
  /** Só o líder do louvor monta e publica. */
  podeEditar: boolean;
};

export function SetlistCard({
  churchSlug,
  churchId,
  eventId,
  itens,
  publicado,
  publicadoEm,
  youtubePlaylistUrl,
  youtubePlaylistError,
  podeEditar,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [avisoPlaylist, setAvisoPlaylist] = useState<string | null>(
    youtubePlaylistError
  );
  const [copiado, setCopiado] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [cifraAberta, setCifraAberta] = useState<string | null>(null);
  const [editandoTom, setEditandoTom] = useState<string | null>(null);

  // A mídia projeta pelo Holyrics: o que ela precisa daqui é a lista em texto.
  async function copiarLista() {
    await navigator.clipboard.writeText(listaParaHolyrics(itens));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function agir(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess?: () => void
  ) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.error ?? "Não deu certo");
      else onSuccess?.();
    });
  }

  function publicar() {
    setErro(null);
    setAvisoPlaylist(null);
    startTransition(async () => {
      const result = await publishSetlist(churchSlug, eventId);
      if (!result.ok) {
        setErro(result.error ?? "Não foi possível publicar");
        return;
      }
      setAvisoPlaylist(result.data.playlistWarning);
    });
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Music className="size-4" />
          Repertório
          {!publicado && podeEditar && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              rascunho
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {publicado
            ? `Sequência definida${publicadoEm ? ` em ${new Date(publicadoEm).toLocaleDateString("pt-BR")}` : ""}`
            : "Só o louvor enxerga até você publicar"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma música escolhida ainda.
          </p>
        )}

        {itens.map((item, i) => {
          const tom = item.key_override ?? item.songs.default_key;
          const mostrarOriginal =
            !!item.songs.default_key && item.songs.default_key !== tom;
          const temLetra = !!item.songs.lyrics;
          const cifraOriginal = item.songs.chord_chart;
          const temCifra = !!cifraOriginal;
          const cifraDoCulto = cifraOriginal && item.songs.default_key && tom
            ? transposeChordChart(
                cifraOriginal,
                item.songs.default_key,
                tom
              )
            : cifraOriginal;
          return (
            <div key={item.id} className="rounded-2xl border">
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.songs.title}</p>
                    {tom && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                        Tom do culto: {tom}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.songs.artist}
                    {item.songs.artist && (mostrarOriginal || item.songs.bpm) ? " · " : ""}
                    {mostrarOriginal ? `Original: ${item.songs.default_key}` : ""}
                    {mostrarOriginal && item.songs.bpm ? " · " : ""}
                    {item.songs.bpm ? `${item.songs.bpm} bpm` : ""}
                  </p>
                  {podeEditar && editandoTom === item.id && (
                    <form
                      action={(form) =>
                        agir(
                          () =>
                            updateSetlistItemKey({
                              churchSlug,
                              churchId,
                              eventId,
                              itemId: item.id,
                              keyOverride: String(form.get("keyOverride") ?? ""),
                            }),
                          () => setEditandoTom(null)
                        )
                      }
                      className="mt-3 flex flex-wrap items-center gap-2"
                    >
                      <Input
                        name="keyOverride"
                        defaultValue={tom ?? ""}
                        maxLength={8}
                        placeholder="Ex.: D"
                        aria-label={`Tom do culto para ${item.songs.title}`}
                        className="h-10 w-28 rounded-xl"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="icon"
                        className="size-10 rounded-full"
                        disabled={pending}
                        aria-label="Salvar tom"
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10 rounded-full"
                        disabled={pending}
                        onClick={() => setEditandoTom(null)}
                        aria-label="Cancelar edição do tom"
                      >
                        <X className="size-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Vazio usa o tom original
                      </span>
                    </form>
                  )}
                  {item.notes && (
                    <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                      {item.notes}
                    </p>
                  )}
                </div>
                {podeEditar && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => setEditandoTom(item.id)}
                      aria-label={`Editar tom de ${item.songs.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || i === 0}
                      onClick={() =>
                        agir(() => moveSetlistItem(churchSlug, eventId, item.id, "cima"))
                      }
                      aria-label="Subir"
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || i === itens.length - 1}
                      onClick={() =>
                        agir(() => moveSetlistItem(churchSlug, eventId, item.id, "baixo"))
                      }
                      aria-label="Descer"
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() =>
                        agir(() => removeFromSetlist(churchSlug, eventId, item.id))
                      }
                      aria-label="Tirar da sequência"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* A letra é para o músico ensaiar — fica recolhida para não
                  atrapalhar quem só veio conferir a ordem. */}
              {temLetra && (
                <div className="border-t px-4 py-2">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() => setAberta(aberta === item.id ? null : item.id)}
                  >
                    {aberta === item.id ? "Esconder letra" : "Ver letra"}
                  </button>
                  {aberta === item.id && (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {item.songs.lyrics}
                    </p>
                  )}
                </div>
              )}
              {temCifra && (
                <div className="border-t px-4 py-2">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline underline-offset-4"
                    onClick={() =>
                      setCifraAberta(cifraAberta === item.id ? null : item.id)
                    }
                  >
                    {cifraAberta === item.id ? "Esconder cifra" : "Ver cifra"}
                  </button>
                  {cifraAberta === item.id && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-medium">
                        {tom ? `Tom do culto: ${tom}` : "Tom do culto não informado"}
                        {mostrarOriginal && ` · Original: ${item.songs.default_key}`}
                      </p>
                      {!item.songs.default_key && (
                        <p className="text-xs text-muted-foreground">
                          Cifra original exibida sem transposição porque o tom
                          original não foi informado.
                        </p>
                      )}
                      <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {cifraDoCulto}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        {avisoPlaylist && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {avisoPlaylist}
          </p>
        )}
        {youtubePlaylistUrl && (
          <a
            href={youtubePlaylistUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4"
          >
            Abrir playlist de ensaio no YouTube
            <ExternalLink className="size-4" />
          </a>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {itens.length > 0 && (
            <Button
              variant="outline"
              className="h-11 rounded-full"
              onClick={copiarLista}
            >
              {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copiado ? "Copiado" : "Copiar lista"}
            </Button>
          )}
          {podeEditar && !publicado && (
            <Button
              className="h-11 rounded-full"
              disabled={pending || itens.length === 0}
              onClick={publicar}
            >
              <Send className="size-4" />
              Publicar e avisar a equipe
            </Button>
          )}
          {podeEditar && publicado && (
            <Button
              variant="outline"
              className="h-11 rounded-full"
              disabled={pending}
              onClick={() => agir(() => unpublishSetlist(churchSlug, eventId))}
            >
              <Undo2 className="size-4" />
              Reabrir para ajuste
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
