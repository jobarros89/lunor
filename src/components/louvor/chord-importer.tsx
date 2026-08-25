"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { confirmChordImport } from "@/lib/actions/chord-import";
import { parseChordChart, type ParsedChordChart } from "@/lib/music/import/parse-chord-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MAX_LENGTH = 20_000;
const ACCEPTED = ".txt,.cho,.crd,.pro,.chordpro";

export function ChordImporter({ churchSlug, songId, arrangements }: {
  churchSlug: string; songId: string; arrangements: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<{ name: string; type: string } | null>(null);
  const [parsed, setParsed] = useState<ParsedChordChart | null>(null);
  const [arrangementId, setArrangementId] = useState("new");
  const [arrangementName, setArrangementName] = useState("Arranjo principal");
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const blocking = !content.trim() || content.length > MAX_LENGTH || parsed?.warnings.some((w) => w.code === "EMPTY_CONTENT");

  async function readFile(selected: File | undefined) {
    if (!selected) return;
    const extension = selected.name.split(".").pop()?.toLowerCase();
    if (!extension || !["txt", "cho", "crd", "pro", "chordpro"].includes(extension)) {
      toast.error("Formato de arquivo não aceito."); return;
    }
    if (selected.size > MAX_LENGTH * 4) { toast.error("O arquivo excede o limite de 20.000 caracteres."); return; }
    const text = await selected.text();
    setContent(text); setFile({ name: selected.name, type: selected.type }); setParsed(null);
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
        churchSlug, songId, arrangementId: arrangementId === "new" ? null : arrangementId,
        arrangementName, sourceKind: file ? "FILE" : "PASTE", sourceFormat: parsed.detectedFormat,
        originalFilename: file?.name ?? null, mimeType: file?.type || null,
        rawContent: parsed.originalContent, chordProContent: parsed.chordProContent,
        metadata: parsed.metadata, warnings: parsed.warnings,
      });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(`Cifra importada como versão ${result.data.versionNumber}.`);
      setOpen(false); setParsed(null); setContent(""); setConfirmed(false);
    });
  }

  if (!open) return <Button className="rounded-full" variant="outline" onClick={() => setOpen(true)}><Upload className="size-4" />Importar cifra</Button>;

  return <Card className="rounded-3xl">
    <CardHeader><CardTitle className="text-base">Importar cifra · {parsed ? "Revisão e confirmação" : "Entrada"}</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {!parsed ? <>
        <div className="space-y-2"><Label htmlFor="chord-content">Cole a cifra</Label>
          <textarea id="chord-content" value={content} onChange={(e) => { setContent(e.target.value); setFile(null); }} rows={10} className="w-full rounded-2xl border bg-transparent p-3 font-mono text-sm" placeholder="Título: ..." />
          <p className={content.length > MAX_LENGTH ? "text-sm text-destructive" : "text-xs text-muted-foreground"}>{content.length.toLocaleString("pt-BR")} / {MAX_LENGTH.toLocaleString("pt-BR")} caracteres</p>
        </div>
        <div className="space-y-2"><Label htmlFor="chord-file">Ou selecione um arquivo</Label><Input id="chord-file" type="file" accept={ACCEPTED} onChange={(e) => void readFile(e.target.files?.[0])} /><p className="text-xs text-muted-foreground">TXT, CHO, CRD, PRO ou CHORDPRO.</p></div>
        <div className="flex gap-2"><Button onClick={review} disabled={blocking}>Revisar importação</Button><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button></div>
      </> : <>
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-sm sm:grid-cols-3">
          <Meta label="Formato" value={parsed.detectedFormat} /><Meta label="Título" value={parsed.metadata.title} /><Meta label="Artista" value={parsed.metadata.artist} /><Meta label="Tom" value={parsed.metadata.key} /><Meta label="BPM" value={parsed.metadata.bpm} /><Meta label="Compasso" value={parsed.metadata.timeSignature} />
        </div>
        <section><h3 className="mb-2 text-sm font-semibold">Seções reconhecidas</h3><div className="flex flex-wrap gap-2">{parsed.sections.length ? parsed.sections.map((s) => <span key={`${s.position}-${s.sourceStartLine}`} className="rounded-full bg-secondary px-3 py-1 text-xs">{s.label || s.type} · linhas {s.sourceStartLine}–{s.sourceEndLine}</span>) : <p className="text-sm text-muted-foreground">Nenhuma seção reconhecida.</p>}</div></section>
        <section><h3 className="mb-2 text-sm font-semibold">Warnings</h3>{parsed.warnings.length ? <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">{parsed.warnings.map((w, i) => <li key={`${w.code}-${i}`}>{w.line ? `Linha ${w.line}: ` : ""}{w.message}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum warning.</p>}</section>
        <Preview title="Prévia ChordPro" content={parsed.chordProContent} />
        <Preview title="Conteúdo original preservado" content={parsed.originalContent} />
        <div className="space-y-2"><Label htmlFor="arrangement">Destino</Label><select id="arrangement" className="h-10 w-full rounded-xl border bg-background px-3 text-sm" value={arrangementId} onChange={(e) => setArrangementId(e.target.value)}><option value="new">Criar novo arranjo</option>{arrangements.map((a) => <option key={a.id} value={a.id}>Nova versão de: {a.name}</option>)}</select></div>
        {arrangementId === "new" && <div className="space-y-2"><Label htmlFor="arrangement-name">Nome do novo arranjo</Label><Input id="arrangement-name" maxLength={120} value={arrangementName} onChange={(e) => setArrangementName(e.target.value)} /></div>}
        <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm"><input className="mt-1" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>Revisei a prévia e confirmo a criação desta versão. Os metadados da música não serão substituídos.</span></label>
        <div className="flex flex-wrap gap-2"><Button onClick={save} disabled={!confirmed || pending || (arrangementId === "new" && !arrangementName.trim())}>{pending ? "Confirmando…" : "Confirmar importação"}</Button><Button variant="outline" onClick={() => setParsed(null)} disabled={pending}>Voltar à entrada</Button><Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancelar</Button></div>
      </>}
    </CardContent>
  </Card>;
}

function Meta({ label, value }: { label: string; value: string | number | null }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value ?? "—"}</p></div>; }
function Preview({ title, content }: { title: string; content: string }) { return <details className="rounded-2xl border p-4" open><summary className="cursor-pointer text-sm font-semibold">{title}</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs">{content}</pre></details>; }
