"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DistributionOverview, DistributionPerson } from "@/lib/distribution";
import { relativeLastService } from "@/lib/distribution";

const WINDOWS = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
] as const;

type WindowValue = (typeof WINDOWS)[number]["value"];

const SIGNAL_BAR: Record<DistributionPerson["signal"], string> = {
  attention: "bg-amber-500",
  balanced: "bg-emerald-500",
  reconnect: "bg-sky-500",
};

const SIGNAL_TEXT: Record<DistributionPerson["signal"], string> = {
  attention: "text-amber-600 dark:text-amber-400",
  balanced: "text-emerald-600 dark:text-emerald-400",
  reconnect: "text-sky-600 dark:text-sky-400",
};

function loadFor(person: DistributionPerson, window: WindowValue) {
  if (window === 30) return person.last30;
  if (window === 60) return person.last60;
  return person.last90;
}

export function DistributionPanel({
  churchSlug,
  ministryName,
  overview,
  maxRows = 6,
}: {
  churchSlug: string;
  ministryName: string;
  overview: DistributionOverview;
  maxRows?: number;
}) {
  const [window, setWindow] = useState<WindowValue>(30);

  const ranked = useMemo(
    () =>
      [...overview.people]
        .sort(
          (a, b) =>
            loadFor(b, window) - loadFor(a, window) ||
            a.name.localeCompare(b.name, "pt-BR")
        )
        .slice(0, maxRows),
    [overview.people, window, maxRows]
  );

  const maxLoad = Math.max(1, ...ranked.map((person) => loadFor(person, window)));
  const maxWeek = Math.max(1, ...overview.weeks.map((week) => week.count));
  const hasData = overview.totalServices30 > 0 || overview.weeks.some((w) => w.count > 0);

  return (
    <section
      className="rounded-3xl border bg-card"
      aria-label={`Distribuição de carga — ${ministryName}`}
    >
      <header className="flex flex-wrap items-end justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-tight">Distribuição do time</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {ministryName} · {overview.activeMembers} pessoas ativas
          </p>
        </div>
        <Link
          href={`/${churchSlug}/distribuicao`}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Radar completo
          <ArrowRight className="size-3.5" />
        </Link>
      </header>

      {!hasData ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Ainda não há escalas suficientes neste setor para medir distribuição. Monte a
          primeira escala e o painel começa a acompanhar.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-y border-b md:grid-cols-4 md:divide-y-0">
            <Stat
              value={overview.attention.length}
              label="servindo demais"
              hint={`${overview.attention.length === 1 ? "1 pessoa passou" : `${overview.attention.length} pessoas passaram`} do ritmo saudável`}
              tone="attention"
            />
            <Stat
              value={overview.balancedCount}
              label="em ritmo bom"
              hint="Sem sinais de alerta agora"
              tone="balanced"
            />
            <Stat
              value={overview.reconnect.length}
              label="para reconectar"
              hint="6+ semanas sem servir"
              tone="reconnect"
            />
            <Stat
              value={overview.balanceIndex ?? "—"}
              label="índice de equilíbrio"
              hint={
                overview.balanceIndex === null
                  ? "Sem serviços nos últimos 30 dias"
                  : `${overview.idleMembers} sem escala em 30 dias`
              }
              suffix={overview.balanceIndex === null ? undefined : "/100"}
              tone={
                overview.balanceIndex === null
                  ? "neutral"
                  : overview.balanceIndex >= 70
                    ? "balanced"
                    : overview.balanceIndex >= 45
                      ? "attention"
                      : "critical"
              }
            />
          </div>

          <div className="border-b px-5 py-5">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium">Serviços por semana</h3>
              <span className="text-xs text-muted-foreground">últimas {overview.weeks.length} semanas</span>
            </div>
            <ul className="mt-4 flex h-24 items-end gap-1.5">
              {overview.weeks.map((week) => {
                const height = Math.round((week.count / maxWeek) * 100);
                return (
                  <li
                    key={week.weekStart}
                    className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                    title={`Semana de ${week.label}: ${week.count} serviços, ${week.people} pessoas`}
                  >
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {week.count}
                    </span>
                    <span
                      className="w-full rounded-sm bg-foreground/80"
                      style={{ height: `${Math.max(height, week.count > 0 ? 6 : 2)}%` }}
                      aria-hidden
                    />
                    <span className="w-full truncate text-center text-[10px] tabular-nums text-muted-foreground">
                      {week.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-medium">Carga por pessoa</h3>
              <div className="flex rounded-full border p-0.5" role="group" aria-label="Período">
                {WINDOWS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setWindow(item.value)}
                    aria-pressed={window === item.value}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      window === item.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="mt-4 space-y-3">
              {ranked.map((person) => {
                const load = loadFor(person, window);
                const width = Math.round((load / maxLoad) * 100);
                return (
                  <li key={person.userId}>
                    <Link
                      href={`/${churchSlug}/pessoas/${person.userId}`}
                      className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm group-hover:underline">
                          {person.name}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {load}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <span
                          className={`block h-full rounded-full ${SIGNAL_BAR[person.signal]}`}
                          style={{ width: `${load > 0 ? Math.max(width, 4) : 0}%` }}
                          aria-hidden
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        <span className={SIGNAL_TEXT[person.signal]}>
                          {person.signal === "attention"
                            ? "Servindo demais"
                            : person.signal === "reconnect"
                              ? "Reconectar"
                              : "Ritmo bom"}
                        </span>
                        {" · "}
                        {relativeLastService(person.daysSinceLast)}
                        {person.consecutiveWeeks >= 2
                          ? ` · ${person.consecutiveWeeks} semanas seguidas`
                          : ""}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>

            {overview.people.length > maxRows && (
              <p className="mt-4 text-xs text-muted-foreground">
                Mostrando {maxRows} de {overview.people.length}. Veja todos no radar completo.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function Stat({
  value,
  label,
  hint,
  suffix,
  tone,
}: {
  value: number | string;
  label: string;
  hint: string;
  suffix?: string;
  tone: "attention" | "balanced" | "reconnect" | "critical" | "neutral";
}) {
  const toneClass =
    tone === "attention"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "balanced"
        ? "text-emerald-600 dark:text-emerald-400"
        : tone === "reconnect"
          ? "text-sky-600 dark:text-sky-400"
          : tone === "critical"
            ? "text-rose-600 dark:text-rose-400"
            : "text-foreground";

  return (
    <div className="px-5 py-4">
      <p className={`text-3xl font-semibold tabular-nums leading-none ${toneClass}`}>
        {value}
        {suffix && (
          <span className="ml-0.5 text-sm font-normal text-muted-foreground">{suffix}</span>
        )}
      </p>
      <p className="mt-2 text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}
