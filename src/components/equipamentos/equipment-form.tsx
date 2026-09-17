"use client";

import { Select } from "@/components/ui/select";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveEquipment } from "@/lib/actions/equipamentos";
import { STATUS_OPTIONS } from "@/lib/equipamentos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { FormSection } from "@/components/ui/form-section";
import { Textarea } from "@/components/ui/textarea";

type Category = { id: string; name: string };
type Member = { user_id: string; full_name: string };

export type EquipmentFormValues = {
  id?: string;
  name: string;
  categoryId: string | null;
  subcategory: string;
  brand: string;
  model: string;
  serialNumber: string;
  assetNumber: string;
  valueReais: number | null;
  supplier: string;
  invoiceRef: string;
  warrantyUntil: string;
  manualUrl: string;
  photoUrl: string;
  status: string;
  location: string;
  purchaseDate: string;
  lifespanMonths: number | null;
  responsibleId: string | null;
  ownerId: string | null;
  notes: string;
};

const EMPTY: EquipmentFormValues = {
  name: "",
  categoryId: null,
  subcategory: "",
  brand: "",
  model: "",
  serialNumber: "",
  assetNumber: "",
  valueReais: null,
  supplier: "",
  invoiceRef: "",
  warrantyUntil: "",
  manualUrl: "",
  photoUrl: "",
  status: "disponivel",
  location: "",
  purchaseDate: "",
  lifespanMonths: null,
  responsibleId: null,
  ownerId: null,
  notes: "",
};

export function EquipmentForm({
  churchSlug,
  churchId,
  categories,
  members,
  initial,
  photoPreview,
  canChooseOwner,
  currentUserId,
}: {
  churchSlug: string;
  churchId: string;
  categories: Category[];
  members: Member[];
  initial?: EquipmentFormValues;
  /** signed URL da foto atual (bucket privado) para a prévia na edição */
  photoPreview?: string | null;
  /** Gestor pode escolher se é da igreja ou de alguém; voluntário fica no próprio. */
  canChooseOwner: boolean;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>(photoPreview ?? "");
  const [v, setV] = useState<EquipmentFormValues>(
    initial ?? { ...EMPTY, ownerId: canChooseOwner ? null : currentUserId },
  );
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${churchId}/equipments/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { upsert: false });
      if (error) throw error;
      // bucket privado: guardamos o path; a exibição gera signed URL.
      // a prévia imediata usa o arquivo local (sem ida à rede).
      setV((prev) => ({ ...prev, photoUrl: path }));
      setPreviewUrl(URL.createObjectURL(file));
      toast.success("Foto enviada");
    } catch (err) {
      console.error("uploadPhoto:", err);
      toast.error("Falha ao enviar a foto");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (v.name.length < 2) return toast.error("Dê um nome ao equipamento");
    startTransition(async () => {
      const result = await saveEquipment({ churchSlug, churchId, ...v });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <Card className="border-0 bg-transparent shadow-none">
      <CardContent className="space-y-6 p-0" aria-busy={pending || uploading}>
        <FormSection title="Identificação">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed bg-muted/40 transition-colors hover:bg-muted"
              aria-label="Enviar foto"
            >
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Foto do equipamento"
                  className="size-full object-cover"
                />
              ) : (
                <Camera className="size-7 text-muted-foreground" />
              )}
            </button>
            <div className="text-sm text-muted-foreground">
              {uploading
                ? "Enviando foto…"
                : previewUrl
                  ? "Toque para trocar a foto"
                  : "Toque para adicionar uma foto"}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPhoto(file);
              }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" required>
              <Input
                value={v.name}
                onChange={(e) => setV({ ...v, name: e.target.value })}
                placeholder="Ex.: Canon R8"
              />
            </Field>
            <Field label="Categoria">
              <Select
                value={v.categoryId ?? ""}
                onChange={(e) =>
                  setV({ ...v, categoryId: e.target.value || null })
                }
              >
                <option value="">Sem categoria</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Subcategoria">
              <Input
                value={v.subcategory}
                onChange={(e) => setV({ ...v, subcategory: e.target.value })}
              />
            </Field>
            <Field label="Marca">
              <Input
                value={v.brand}
                onChange={(e) => setV({ ...v, brand: e.target.value })}
              />
            </Field>
            <Field label="Modelo">
              <Input
                value={v.model}
                onChange={(e) => setV({ ...v, model: e.target.value })}
              />
            </Field>
            <Field label="Nº de série">
              <Input
                value={v.serialNumber}
                onChange={(e) => setV({ ...v, serialNumber: e.target.value })}
              />
            </Field>
            <Field label="Nº patrimonial">
              <Input
                value={v.assetNumber}
                onChange={(e) => setV({ ...v, assetNumber: e.target.value })}
              />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Propriedade e operação">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Propriedade">
              {canChooseOwner ? (
                <Select
                  value={v.ownerId ?? ""}
                  onChange={(e) =>
                    setV({ ...v, ownerId: e.target.value || null })
                  }
                >
                  <option value="">Da igreja</option>
                  {members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      Pessoal de {m.full_name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  Este é o seu equipamento pessoal (entra no inventário como
                  seu).
                </p>
              )}
            </Field>
            <Field label="Status">
              <Select
                value={v.status}
                onChange={(e) => setV({ ...v, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Localização">
              <Input
                value={v.location}
                onChange={(e) => setV({ ...v, location: e.target.value })}
                placeholder="Ex.: Sala técnica"
              />
            </Field>
            <Field label="Responsável">
              <Select
                value={v.responsibleId ?? ""}
                onChange={(e) =>
                  setV({ ...v, responsibleId: e.target.value || null })
                }
              >
                <option value="">Sem responsável</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </FormSection>
        <FormSection title="Compra e vida útil">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valor (R$)">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={v.valueReais ?? ""}
                onChange={(e) =>
                  setV({
                    ...v,
                    valueReais:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Fornecedor">
              <Input
                value={v.supplier}
                onChange={(e) => setV({ ...v, supplier: e.target.value })}
              />
            </Field>
            <Field label="Nota fiscal (ref.)">
              <Input
                value={v.invoiceRef}
                onChange={(e) => setV({ ...v, invoiceRef: e.target.value })}
              />
            </Field>
            <Field label="Data de compra">
              <Input
                type="date"
                value={v.purchaseDate}
                onChange={(e) => setV({ ...v, purchaseDate: e.target.value })}
              />
            </Field>
            <Field label="Garantia até">
              <Input
                type="date"
                value={v.warrantyUntil}
                onChange={(e) => setV({ ...v, warrantyUntil: e.target.value })}
              />
            </Field>
            <Field label="Vida útil (meses)">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                value={v.lifespanMonths ?? ""}
                onChange={(e) =>
                  setV({
                    ...v,
                    lifespanMonths:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </FormSection>
        <FormSection title="Documentação">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Manual (URL)">
              <Input
                value={v.manualUrl}
                onChange={(e) => setV({ ...v, manualUrl: e.target.value })}
              />
            </Field>
            <Field label="Observações">
              <Textarea
                value={v.notes}
                onChange={(e) => setV({ ...v, notes: e.target.value })}
              />
            </Field>
          </div>
        </FormSection>
        <Button
          type="button"
          disabled={pending || uploading}
          onClick={submit}
          className="h-12 w-full text-base"
        >
          {pending
            ? "Salvando…"
            : initial?.id
              ? "Salvar alterações"
              : "Cadastrar equipamento"}
        </Button>
      </CardContent>
    </Card>
  );
}
