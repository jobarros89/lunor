"use client";

import { useState, useTransition } from "react";
import { Printer, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveKidsPrintSettings } from "@/lib/actions/kids-print-settings";
import { printKidsLabel } from "@/lib/kids-label-print";
import {
  kidsLabelPreset,
  type KidsLabelPreset,
  type KidsPrintSettings,
} from "@/lib/kids-print-settings";

const PRESETS: Record<Exclude<KidsLabelPreset, "custom">, [number, number]> = {
  "62x50": [62, 50],
  "60x40": [60, 40],
  "50x30": [50, 30],
};

export function KidsPrintSettingsForm({
  churchSlug,
  ministryId,
  initialSettings,
}: {
  churchSlug: string;
  ministryId: string;
  initialSettings: KidsPrintSettings;
}) {
  const [settings, setSettings] = useState<KidsPrintSettings>({
    ...initialSettings,
    printMode: "universal",
  });
  const [pending, startTransition] = useTransition();
  const preset = kidsLabelPreset(settings);

  function selectPreset(value: KidsLabelPreset) {
    if (value === "custom") return;
    const [width, height] = PRESETS[value];
    setSettings((current) => ({
      ...current,
      labelWidthMm: width,
      labelHeightMm: height,
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await saveKidsPrintSettings({
        churchSlug,
        ministryId,
        ...settings,
        printMode: "universal",
      });
      if (result.ok) toast.success("Configuração de etiquetas salva");
      else toast.error(result.error);
    });
  }

  function testPrint() {
    const opened = printKidsLabel(settings, {
      churchName: "Sua igreja",
      childName: "Criança teste",
      childAge: "5 anos",
      className: "Sala teste",
      guardianName: "Responsável teste",
      restrictedPickupNames: [],
      allergies: "Exemplo de alergia",
      specialNeeds: null,
      code: "123",
      pickupUrl: "https://lunorservice.com",
      eventTitle: "Culto teste",
      eventContext: "Campus teste",
    });
    if (!opened) {
      toast.error("O navegador bloqueou a janela de impressão");
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl border-2 border-primary bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Universal</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Usa o diálogo de impressão do navegador e o driver já instalado no dispositivo.
              </p>
            </div>
            <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
              Ativo
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4" />
            Compatível com impressoras comuns e térmicas reconhecidas pelo sistema.
          </div>
        </div>

        <div className="rounded-3xl border border-dashed p-5 opacity-70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">Impressão direta homologada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Envio direto para modelos térmicos homologados, sem abrir o diálogo do navegador.
              </p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              Em breve
            </span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            A arquitetura já separa esse modo para futuras integrações, como Zebra e outros fabricantes.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border p-5">
        <div>
          <h2 className="text-lg font-semibold">Formato da etiqueta</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O padrão atual do LUNOR Kids é 62 × 50 mm. Você pode escolher um tamanho comum ou personalizar.
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">
            Tamanho
            <select
              value={preset}
              onChange={(event) => selectPreset(event.target.value as KidsLabelPreset)}
              className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal md:text-sm"
            >
              <option value="62x50">62 × 50 mm — padrão LUNOR</option>
              <option value="60x40">60 × 40 mm</option>
              <option value="50x30">50 × 30 mm — compacto</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            Orientação
            <select
              value={settings.orientation}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  orientation: event.target.value as "horizontal" | "vertical",
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal md:text-sm"
            >
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium">
            Largura (mm)
            <Input
              type="number"
              min={20}
              max={120}
              step="0.5"
              value={settings.labelWidthMm}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  labelWidthMm: Number(event.target.value),
                }))
              }
              className="h-11 rounded-xl"
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Altura (mm)
            <Input
              type="number"
              min={20}
              max={150}
              step="0.5"
              value={settings.labelHeightMm}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  labelHeightMm: Number(event.target.value),
                }))
              }
              className="h-11 rounded-xl"
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Margem (mm)
            <Input
              type="number"
              min={0}
              max={10}
              step="0.5"
              value={settings.marginMm}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  marginMm: Number(event.target.value),
                }))
              }
              className="h-11 rounded-xl"
            />
          </label>

          <label className="space-y-2 text-sm font-medium">
            Quantidade de vias
            <select
              value={settings.copies}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  copies: Number(event.target.value),
                }))
              }
              className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal md:text-sm"
            >
              <option value={1}>1 via</option>
              <option value={2}>2 vias</option>
              <option value={3}>3 vias</option>
            </select>
          </label>
        </div>

        <label className="mt-5 flex items-center justify-between gap-4 rounded-2xl bg-muted/40 p-4">
          <div>
            <p className="text-sm font-medium">QR Code de retirada</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mantém o QR de segurança impresso junto do código numérico.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.qrEnabled}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                qrEnabled: event.target.checked,
              }))
            }
            className="size-5 accent-primary"
            aria-label="Imprimir QR Code de retirada"
          />
        </label>
      </section>

      <section className="rounded-3xl border p-5">
        <h2 className="font-semibold">Teste antes do culto</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Imprima uma etiqueta de teste e confirme no diálogo do sistema que a escala está em 100% e que o papel selecionado corresponde ao tamanho configurado.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="outline" onClick={testPrint} className="h-11 rounded-full px-5">
            <Printer className="size-4" />
            Imprimir etiqueta de teste
          </Button>
          <Button type="button" disabled={pending} onClick={save} className="h-11 rounded-full px-5">
            <Save className="size-4" />
            {pending ? "Salvando…" : "Salvar configuração"}
          </Button>
        </div>
      </section>
    </div>
  );
}
