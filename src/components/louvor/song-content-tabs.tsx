"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileAudio, Loader2, Music2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import {
  registerRehearsalMaterial,
  removeRehearsalMaterial,
} from "@/lib/actions/rehearsal-materials";

type MaterialCategory =
  | "VOCAL_SOPRANO"
  | "VOCAL_CONTRALTO"
  | "VOCAL_TENOR"
  | "VOCAL_OTHER"
  | "BASS"
  | "GUITAR"
  | "KEYS"
  | "DRUMS"
  | "CLICK"
  | "GUIDE"
  | "OTHER";

export type RehearsalMaterial = {
  id: string;
  label: string;
  category: MaterialCategory;
  file_name: string;
  storage_object_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  arrangement_version_id: string | null;
  created_at: string;
};

export type ArrangementVersionOption = {
  id: string;
  label: string;
};

const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  VOCAL_SOPRANO: "Vocal · Soprano",
  VOCAL_CONTRALTO: "Vocal · Contralto",
  VOCAL_TENOR: "Vocal · Tenor",
  VOCAL_OTHER: "Vocal · Outra voz",
  BASS: "Baixo",
  GUITAR: "Guitarra",
  KEYS: "Teclado",
  DRUMS: "Bateria",
  CLICK: "Click",
  GUIDE: "Guia completa",
  OTHER: "Outro",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(mb >= 10 ? 0 : 1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function safeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()}` : "";
  const base = name.replace(/\.[^.]+$/, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const clean = base.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "audio";
  return `${clean}${extension.toLowerCase()}`;
}

export function SongContentTabs({
  churchSlug,
  churchId,
  songId,
  lyrics,
  chordChart,
  materials,
  arrangementVersions,
  canEdit,
}: {
  churchSlug: string;
  churchId: string;
  songId: string;
  lyrics: string | null;
  chordChart: string | null;
  materials: RehearsalMaterial[];
  arrangementVersions: ArrangementVersionOption[];
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"lyrics" | "chords" | "materials">("lyrics");
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<MaterialCategory>("OTHER");
  const [versionId, setVersionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const groups = new Map<string, RehearsalMaterial[]>();
    for (const material of materials) {
      const key = CATEGORY_LABELS[material.category];
      groups.set(key, [...(groups.get(key) ?? []), material]);
    }
    return [...groups.entries()];
  }, [materials]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    Promise.all(
      materials.map(async (material) => {
        const { data } = await supabase.storage
          .from("worship-materials")
          .createSignedUrl(material.storage_object_path, 60 * 60);
        return [material.id, data?.signedUrl ?? ""] as const;
      })
    ).then((entries) => {
      if (active) setUrls(Object.fromEntries(entries.filter(([, url]) => !!url)));
    });
    return () => {
      active = false;
    };
  }, [materials]);

  async function uploadMaterial() {
    if (!file) {
      setError("Escolha um arquivo de áudio");
      return;
    }
    if (!label.trim()) {
      setError("Informe um nome, como ‘Baixo no click’ ou ‘Contralto’");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 100 MB");
      return;
    }

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const path = `${churchId}/${songId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const { error: uploadError } = await supabase.storage
      .from("worship-materials")
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      setError(uploadError.message || "Não foi possível enviar o arquivo");
      setUploading(false);
      return;
    }

    const result = await registerRehearsalMaterial({
      churchSlug,
      churchId,
      songId,
      arrangementVersionId: versionId || null,
      label: label.trim(),
      category,
      fileName: file.name,
      storageObjectPath: path,
      mimeType: file.type || null,
      sizeBytes: file.size,
    });

    if (!result.ok) {
      await supabase.storage.from("worship-materials").remove([path]);
      setError(result.error);
      setUploading(false);
      return;
    }

    setLabel("");
    setCategory("OTHER");
    setVersionId("");
    setFile(null);
    setUploading(false);
    window.location.reload();
  }

  function remove(material: RehearsalMaterial) {
    setError(null);
    startTransition(async () => {
      const result = await removeRehearsalMaterial({
        churchSlug,
        churchId,
        songId,
        materialId: material.id,
      });
      if (!result.ok) setError(result.error);
      else window.location.reload();
    });
  }

  return (
    <div className="overflow-hidden rounded-3xl border bg-card">
      <div className="flex gap-1 overflow-x-auto border-b p-2">
        {([
          ["lyrics", "Letra"],
          ["chords", "Cifra"],
          ["materials", `Materiais${materials.length ? ` · ${materials.length}` : ""}`],
        ] as const).map(([value, text]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
              tab === value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
          >
            {text}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-6">
        {tab === "lyrics" && (
          lyrics ? (
            <p className="whitespace-pre-wrap text-sm leading-7">{lyrics}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma letra cadastrada.</p>
          )
        )}

        {tab === "chords" && (
          chordChart ? (
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-sm leading-7">{chordChart}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma cifra cadastrada.</p>
          )
        )}

        {tab === "materials" && (
          <div className="space-y-6">
            {canEdit && (
              <div className="space-y-4 rounded-2xl bg-muted/50 p-4">
                <div>
                  <p className="font-medium">Adicionar material de ensaio</p>
                  <p className="text-sm text-muted-foreground">
                    Ex.: Contralto, Baixo no click, Guia completa ou Click.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Nome
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Ex.: Baixo no click"
                      className="mt-1 h-11 rounded-xl bg-background"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Função
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                      className="lunor-control mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    >
                      {Object.entries(CATEGORY_LABELS).map(([value, text]) => (
                        <option key={value} value={value}>{text}</option>
                      ))}
                    </select>
                  </label>
                  {arrangementVersions.length > 0 && (
                    <label className="text-sm font-medium">
                      Arranjo / versão
                      <select
                        value={versionId}
                        onChange={(e) => setVersionId(e.target.value)}
                        className="lunor-control mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                      >
                        <option value="">Geral da música</option>
                        {arrangementVersions.map((version) => (
                          <option key={version.id} value={version.id}>{version.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="text-sm font-medium">
                    Arquivo de áudio
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-background file:px-4 file:py-2 file:font-medium"
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  className="h-11 rounded-full"
                  disabled={uploading || !file}
                  onClick={uploadMaterial}
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {uploading ? "Enviando…" : "Enviar material"}
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            {grouped.length === 0 ? (
              <div className="flex items-center gap-3 rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                <Music2 className="size-5" />
                Nenhum material de ensaio enviado ainda.
              </div>
            ) : (
              grouped.map(([group, items]) => (
                <section key={group} className="space-y-2">
                  <h3 className="text-sm font-semibold">{group}</h3>
                  {items.map((material) => (
                    <div key={material.id} className="rounded-2xl border p-4">
                      <div className="flex items-start gap-3">
                        <FileAudio className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{material.label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {material.file_name}
                            {formatBytes(material.size_bytes) ? ` · ${formatBytes(material.size_bytes)}` : ""}
                          </p>
                        </div>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            onClick={() => remove(material)}
                            aria-label={`Remover ${material.label}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                      {urls[material.id] && (
                        <audio controls preload="metadata" className="mt-3 w-full" src={urls[material.id]}>
                          Seu navegador não suporta reprodução de áudio.
                        </audio>
                      )}
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
