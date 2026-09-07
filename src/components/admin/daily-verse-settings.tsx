"use client";

import { useState, useTransition } from "react";
import { updateDailyVerseSettings } from "@/lib/actions/daily-verse-settings";
import { sendDailyVerseNowAction } from "@/lib/actions/send-daily-verse-now";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const VERSIONS = [
  { value: "blt", label: "Bíblia Livre (CC0)" },
  { value: "nvi", label: "NVI" },
  { value: "acf", label: "ACF" },
  { value: "ra", label: "RA" },
] as const;

const THEMES = [
  { value: "auto", label: "Rotação automática" },
  { value: "gratidao", label: "Gratidão" },
  { value: "fe", label: "Fé" },
  { value: "amor", label: "Amor" },
  { value: "esperanca", label: "Esperança" },
  { value: "sabedoria", label: "Sabedoria" },
  { value: "paz", label: "Paz" },
] as const;

type Version = (typeof VERSIONS)[number]["value"];
type Theme = (typeof THEMES)[number]["value"];

export type DailyVerseConfig = {
  daily_verse_enabled?: boolean;
  daily_verse_version?: Version;
  daily_verse_theme?: Theme;
};

const selectCls = "h-11 w-full rounded-xl border bg-background px-3 text-base md:text-sm";

export function DailyVerseSettings({
  churchId,
  currentConfig,
}: {
  churchId: string;
  currentConfig?: DailyVerseConfig;
}) {
  const [pending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(currentConfig?.daily_verse_enabled ?? false);
  const [version, setVersion] = useState<Version>(currentConfig?.daily_verse_version ?? "blt");
  const [theme, setTheme] = useState<Theme>(currentConfig?.daily_verse_theme ?? "auto");
  const [message, setMessage] = useState<string | null>(null);

  const [sending, startSendTransition] = useTransition();
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateDailyVerseSettings(churchId, { enabled, version, theme });
        setMessage("Preferências salvas.");
      } catch {
        setMessage("Não foi possível salvar. Tente novamente.");
      }
    });
  }

  function handleSendNow() {
    setSendMessage(null);
    startSendTransition(async () => {
      try {
        const resultado = await sendDailyVerseNowAction(churchId);
        if (!resultado.ok) {
          setSendMessage(resultado.erro ?? "Não foi possível enviar.");
        } else if (resultado.enviados === 0) {
          setSendMessage("Nenhum usuário vinculado à igreja possui notificações ativadas.");
        } else {
          setSendMessage(
            `Enviado agora para ${resultado.enviados} ${resultado.enviados === 1 ? "pessoa" : "pessoas"}.`
          );
        }
      } catch {
        setSendMessage("Não foi possível enviar. Tente novamente.");
      }
    });
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle className="text-base">Versículo do dia</CardTitle>
        <CardDescription>
          Envia um versículo temático por notificação, uma vez ao dia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="size-4 rounded border"
          />
          Ativar versículo do dia
        </label>

        {enabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="verse-version" className="text-sm font-medium">
                Tradução
              </label>
              <select
                id="verse-version"
                value={version}
                onChange={(event) => setVersion(event.target.value as Version)}
                className={selectCls}
              >
                {VERSIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="verse-theme" className="text-sm font-medium">
                Tema
              </label>
              <select
                id="verse-theme"
                value={theme}
                onChange={(event) => setTheme(event.target.value as Theme)}
                className={selectCls}
              >
                {THEMES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
          {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>

        {enabled && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={handleSendNow} disabled={sending}>
                {sending ? "Enviando..." : "Enviar agora"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Envio manual independente do cron; pode ser usado a qualquer momento.
              </span>
            </div>
            {sendMessage && <p className="text-xs text-muted-foreground">{sendMessage}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
