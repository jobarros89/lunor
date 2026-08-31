"use client";

import { useMemo, useState, useTransition } from "react";
import { Globe2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  confirmChordImport,
  fetchChordFromUrl,
} from "@/lib/actions/chord-import";
import { extractLyricsFromChordPro } from "@/lib/music/import/extract-lyrics";
import { parseChordChart, type ParsedChordChart } from "@/lib/music/import/parse-chord-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_LENGTH = 20_000;
const ACCEPTED = ".txt,.cho,.crd,.pro,.chordpro";

type ImportedSource = {
  url: string;
  title: string | null;
  hostname: string;
  aiUsed: boolean;
};

export function ChordImporter({
  churchSlug,
  songId,
  arrangements,
  hasLyrics = false,
  hasChordChart = false,
}: {
  churchSlug: string;
  songId: string;
  arrangements: Array<{ id: string; name: string }>;
  hasLyrics?: boolean;
  hasChordChart?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [importedSource, setImportedSource] = useState<ImportedSource | null>(null);
  const [file, setFile] = useState<{ name: string; type: string } | null>(null);
  const [parsed, setParsed] = useState<ParsedChordChart | null>(null);
  const [arrangementId, setArrangementId] = useState("new");
  const [arrangementName, setArrangementName] = useState("Arranjo principal");
  const [confirmed, setConfirmed] = useState(false);
  const [syncLyrics, setSyncLyrics] = useState(!hasLyrics);
  const [syncChordChart, setSyncChordChart] = useState(!hasChordChart);
  const [pending, startTransition] = useTransition();
  const [urlPending, startUrlTransition] = useTransition();
  const blocking = !content.trim() || content.length > MAX_LENGTH || parsed?.warnings.some((w) => w.code === "EMPTY_CONTENT");
  const extractedLyrics = useMemo(
    () => (parsed ? extractLyricsFromChordPro(parsed.chordProContent) : ""),
    [parsed]
  );

  async function readFile(selected: File | undefined) {
    if (!selected) return;
    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "cho", "crd", "pro", "chordpro"].includes(extension)) {
      toast.error("Formato de arquivo não aceito.");
      return;
    }
    if (selected.size > MAX_LENGTH * 4) {
      toast.error("O arquivo excede o limite de 20.000 caracteres.");
      return;
    }
    const text = await selected.text();
    setContent(text);
    setFile({ name: selected.name, type: selected.type });
    setImportedSource(null);
    setParsed(null);
  }

  function importFromUrl() {
    if (!sourceUrl.trim() || urlPending) return;
    startUrlTransition(async () => {
      const result = await fetchChordFromUrl({ churchSlug, songId, url: sourceUrl });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const nextContent = result.data.content;
      setContent(nextContent);
      setFile(null);
      setImportedSource({
        url: result.data.sourceUrl,
        title: result.data.sourceTitle,
        hostname: result.data.hostname,
        aiUsed: result.data.aiUsed,
      });
      setParsed(parseChordChart({ content: nextContent }));
      setConfirmed(false);
      toast.success(`Cifra encontrada em ${result.data.hostname}. Revise antes de salvar.`);
    });
  }

  function review() {
    if (blocking) return;
    setParsed(parseChordChart({ content, filename: file?.name }));
    setConfirmed(false);
  }

  function save() {
    if (!parsed || !confirmed || blocking) return;
    startTransition(async () => {
      const result = await confirmChordImport({
        churchSlug,
        songId,
        arrangementId: arrangementId === "new" ? null : arrangementId,
        arrangementName,
        sourceKind: file ? "FILE" : "PASTE",
        sourceFormat: parsed.detectedFormat,
        originalFilename: file?.name ?? null,
        mimeType: file?.type || null,
        rawContent: parsed.originalContent,
        chordProContent: parsed.chordProContent,
        extractedLyrics,
        syncSongLyrics: syncLyrics,
        syncSongChordChart: syncChordChart,
        metadata: parsed.metadata,
        warnings: parsed.warnings,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Cifra importada como versão ${result.data.versionNumber}.`);
      setOpen(false);
      setParsed(null);
      setContent("");
      setSourceUrl("");
      setImportedSource(null);
      setConfirmed(false);
    });
  }

  if (!open) {
    return (
      <Button className="rounded-full" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Importar letra e cifra
      </Button>
    );
  }

  return (
    <Card className="w-full rounded-3xl">
      <CardHeader>
        <CardTitle className="text-base">
          Importar letra e cifra · {parsed ? "Revisão e confirmação" : "Escolher fonte"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!parsed ? (
          <>
            <section className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <Globe2 className="size-4" />
                </div>
                <div>
                  <p className="font-medium">Buscar cifra na internet</p>
                  <p className="text-xs text-muted-foreground">
                    Cole o endereço de uma página pública. O LUNOR procura o conteúdo musical, usa IA para escolher o bloco mais provável e abre a revisão automaticamente.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="chord-url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  placeholder="https://site.com/musica/cifra"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      importFromUrl();
                    }
                  }}
                />
                <Button onClick={importFromUrl} disabled={!sourceUrl.trim() || urlPending}>
                  {urlPending ? "Buscando…" : "Buscar cifra"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Funciona em páginas públicas acessíveis normalmente. Sites que exigem login, CAPTCHA, paywall ou bloqueiam automação podem não permitir a importação.
              </p>
            </section>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou cole / envie manualmente
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chord-content">Cole letra + cifra</Label>
              <textarea
                id="chord-content"
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setFile(null);
                  setImportedSource(null);
                }}
                rows={12}
                className="w-full rounded-2xl border bg-transparent p-3 font-mono text-sm"
                placeholder={"Tom: C\n\nIntrodução:\nC  G  Am  F\n\nVerso:\nC             G\nGrande é o Senhor…"}
              />
              <p className={content.length > MAX_LENGTH ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>
                {content.length.toLocaleString("pt-BR")} / {MAX_LENGTH.toLocaleString("pt-BR")} caracteres
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chord-file">Ou selecione um arquivo</Label>
              <Input id="chord-file" type="file" accept={ACCEPTED} onChange={(e) => void readFile(e.target.files?.[0])} />
              <p className="text-xs text-muted-foreground">TXT, CHO, CRD, PRO ou CHORDPRO.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={review} disabled={blocking}>Analisar conteúdo</Button>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </>
        ) : (
          <>
            {importedSource && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/40 p-4 text-sm">
                <Globe2 className="size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {importedSource.title || importedSource.hostname}
                  </p>
                  <a
                    href={importedSource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-xs text-muted-foreground underline underline-offset-4"
                  >
                    {importedSource.hostname}
                  </a>
                </div>
                {importedSource.aiUsed && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <Sparkles className="size-3" />
                    IA selecionou o conteúdo
                  </span>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-sm sm:grid-cols-3">
              <Meta label="Formato" value={parsed.detectedFormat} />
              <Meta label="Título" value={parsed.metadata.title} />
              <Meta label="Artista" value={parsed.metadata.artist} />
              <Meta label="Tom detectado" value={parsed.metadata.key} />
              <Meta label="BPM" value={parsed.metadata.bpm} />
              <Meta label="Compasso" value={parsed.metadata.timeSignature} />
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Seções reconhecidas</h3>
              <div className="flex flex-wrap gap-2">
                {parsed.sections.length ? parsed.sections.map((s) => (
                  <span key={`${s.position}-${s.sourceStartLine}`} className="rounded-full bg-secondary px-3 py-1 text-xs">
                    {s.label || s.type} · linhas {s.sourceStartLine}–{s.sourceEndLine}
                  </span>
                )) : <p className="text-sm text-muted-foreground">Nenhuma seção reconhecida.</p>}
              </div>
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <Preview title="Letra detectada" content={extractedLyrics || "Nenhuma letra foi reconhecida."} />
              <Preview title="Cifra normalizada" content={parsed.chordProContent} />
            </div>

            {parsed.warnings.length > 0 && (
              <section>
                <h3 className="mb-2 text-sm font-semibold">Pontos para revisar</h3>
                <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {parsed.warnings.map((w, i) => (
                    <li key={`${w.code}-${i}`}>{w.line ? `Linha ${w.line}: ` : ""}{w.message}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className="space-y-2">
              <Label htmlFor="arrangement">Salvar em</Label>
              <select
                id="arrangement"
                className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                value={arrangementId}
                onChange={(e) => setArrangementId(e.target.value)}
              >
                <option value="new">Criar novo arranjo</option>
                {arrangements.map((a) => <option key={a.id} value={a.id}>Nova versão de: {a.name}</option>)}
              </select>
            </div>

            {arrangementId === "new" && (
              <div className="space-y-2">
                <Label htmlFor="arrangement-name">Nome do novo arranjo</Label>
                <Input id="arrangement-name" maxLength={120} value={arrangementName} onChange={(e) => setArrangementName(e.target.value)} />
              </div>
            )}

            <div className="space-y-2 rounded-2xl border p-4 text-sm">
              <p className="font-medium">O que atualizar na música</p>
              <label className="flex items-start gap-3">
                <input className="mt-1" type="checkbox" checked={syncLyrics} onChange={(e) => setSyncLyrics(e.target.checked)} disabled={!extractedLyrics} />
                <span>
                  Preencher a letra com a letra detectada
                  {hasLyrics && <span className="block text-xs text-amber-700 dark:text-amber-300">Já existe uma letra cadastrada. Marque somente se quiser substituí-la.</span>}
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input className="mt-1" type="checkbox" checked={syncChordChart} onChange={(e) => setSyncChordChart(e.target.checked)} />
                <span>
                  Usar esta cifra como cifra principal
                  {hasChordChart && <span className="block text-xs text-amber-700 dark:text-amber-300">Já existe uma cifra cadastrada. Marque somente se quiser substituí-la.</span>}
                </span>
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
              <input className="mt-1" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>Revisei a letra, a cifra e o tom detectados e confirmo esta importação.</span>
            </label>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={!confirmed || pending || (arrangementId === "new" && !arrangementName.trim())}>
                {pending ? "Salvando…" : "Salvar letra e cifra"}
              </Button>
              <Button variant="outline" onClick={() => setParsed(null)} disabled={pending}>Voltar à fonte</Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }: { label: string; value: string | number | null }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value ?? "—"}</p></div>;
}

function Preview({ title, content }: { title: string; content: string }) {
  return (
    <details className="rounded-2xl border p-4" open>
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed">{content}</pre>
    </details>
  );
}
