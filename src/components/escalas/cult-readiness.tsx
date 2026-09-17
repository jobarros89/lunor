"use client";

import { CheckCircle2, Circle, ClipboardCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { setEventCultCheck } from "@/lib/actions/event-cult-checks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GROUPS = [
  {
    title: "Produção",
    items: [
      { key: "production.audio-tested", label: "Áudio testado" },
      { key: "production.projection-ready", label: "Projeção pronta" },
      { key: "production.track-ready", label: "Trilha pronta" },
    ],
  },
  {
    title: "Kids",
    items: [
      { key: "kids.rooms-open", label: "Salas abertas" },
      { key: "kids.labels-available", label: "Etiquetas disponíveis" },
      { key: "kids.team-complete", label: "Equipe completa" },
    ],
  },
  {
    title: "Louvor",
    items: [
      { key: "worship.soundcheck-complete", label: "Passagem concluída" },
      { key: "worship.everyone-in-position", label: "Todos em posição" },
    ],
  },
] as const;

type CheckKey = (typeof GROUPS)[number]["items"][number]["key"];

export type CultReadinessRow = {
  check_key: string;
  completed: boolean;
};

export function CultReadiness({
  churchSlug,
  churchId,
  eventId,
  rows,
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  rows: CultReadinessRow[];
  canManage: boolean;
}) {
  const initial = Object.fromEntries(rows.map((row) => [row.check_key, row.completed])) as Record<
    string,
    boolean
  >;
  const [checks, setChecks] = useState(initial);
  const [pendingKey, setPendingKey] = useState<CheckKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = GROUPS.reduce((sum, group) => sum + group.items.length, 0);
  const completed = GROUPS.reduce(
    (sum, group) => sum + group.items.filter((item) => checks[item.key]).length,
    0
  );

  function toggle(checkKey: CheckKey) {
    if (!canManage || pendingKey) return;
    const next = !checks[checkKey];
    setError(null);
    setPendingKey(checkKey);
    setChecks((current) => ({ ...current, [checkKey]: next }));

    startTransition(async () => {
      const result = await setEventCultCheck({
        churchSlug,
        churchId,
        eventId,
        checkKey,
        completed: next,
      });
      if (!result.ok) {
        setChecks((current) => ({ ...current, [checkKey]: !next }));
        setError(result.error ?? "Não foi possível atualizar o checklist");
      }
      setPendingKey(null);
    });
  }

  return (
    <section className="space-y-3" aria-labelledby="cult-readiness-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5" aria-hidden="true" />
          <div>
            <h2 id="cult-readiness-title" className="text-xl font-semibold">
              Prontidão do culto
            </h2>
            <p className="text-sm text-muted-foreground">
              Confirmações operacionais rápidas antes e durante o culto.
            </p>
          </div>
        </div>
        <Badge variant={completed === total ? "default" : "secondary"}>
          {completed}/{total} concluídos
        </Badge>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{group.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-4">
              {group.items.map((item) => {
                const done = Boolean(checks[item.key]);
                const pending = pendingKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={!canManage || pending}
                    onClick={() => toggle(item.key)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors enabled:hover:bg-accent disabled:cursor-default"
                    aria-pressed={done}
                  >
                    {done ? (
                      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className={done ? "font-medium" : "text-muted-foreground"}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {!canManage && (
        <p className="text-xs text-muted-foreground">
          Somente líderes e gestores do culto podem alterar este checklist.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
