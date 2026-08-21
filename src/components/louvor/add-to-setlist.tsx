"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Song } from "@/lib/louvor";
import { addToSetlist } from "@/lib/actions/louvor";

type SongComHistorico = Song & { ultimaVez: string | null };

type Props = {
  churchSlug: string;
  churchId: string;
  eventId: string;
  acervo: SongComHistorico[];
  /** já estão na sequência — não oferecer de novo */
  jaEscolhidas: string[];
};

export function AddToSetlist({
  churchSlug,
  churchId,
  eventId,
  acervo,
  jaEscolhidas,
}: Props) {
  const [busca, setBusca] = useState("");
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [tom, setTom] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const disponiveis = useMemo(() => {
    const escolhidas = new Set(jaEscolhidas);
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return acervo
      .filter((s) => s.active)
      .filter((s) => !escolhidas.has(s.id))
      .filter(
        (s) =>
          !termo ||
          s.title.toLocaleLowerCase("pt-BR").includes(termo) ||
          (s.artist ?? "").toLocaleLowerCase("pt-BR").includes(termo)
      )
      .slice(0, 8);
  }, [acervo, jaEscolhidas, busca]);

  function selecionar(song: Song) {
    setSelecionada(song.id);
    setTom(song.default_key ?? "");
    setErro(null);
  }

  function adicionar(songId: string) {
    setErro(null);
    startTransition(async () => {
      const r = await addToSetlist({
        churchSlug,
        churchId,
        eventId,
        songId,
        keyOverride: tom,
      });
      if (!r.ok) setErro(r.error ?? "Não deu certo");
      else {
        setBusca("");
        setSelecionada(null);
        setTom("");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar no acervo…"
        className="h-11 rounded-full"
      />
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="space-y-1">
        {disponiveis.map((s) => (
          <div key={s.id} className="rounded-2xl border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.artist || "Artista não informado"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.ultimaVez
                    ? `Última vez: ${new Date(s.ultimaVez).toLocaleDateString("pt-BR")}`
                    : "Nunca executada"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                onClick={() => selecionar(s)}
                aria-label={`Selecionar ${s.title}`}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {selecionada === s.id && (
              <div className="mt-3 flex items-end gap-2 border-t pt-3">
                <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                  Tom neste culto
                  <Input
                    value={tom}
                    onChange={(e) => setTom(e.target.value)}
                    maxLength={8}
                    placeholder="Sem tom"
                    className="mt-1 h-10 rounded-xl text-foreground"
                  />
                </label>
                <Button
                  size="icon"
                  disabled={pending}
                  onClick={() => adicionar(s.id)}
                  aria-label={`Adicionar ${s.title} ao repertório`}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  onClick={() => setSelecionada(null)}
                  aria-label="Cancelar inclusão"
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
        {disponiveis.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {acervo.length === 0
              ? "O acervo está vazio — cadastre as músicas na página do Louvor."
              : "Nenhuma música encontrada."}
          </p>
        )}
      </div>
    </div>
  );
}
