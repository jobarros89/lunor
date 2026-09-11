"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { copilotSuggestion, copilotSuggestionHref } from "@/lib/ai/copilot-suggestions";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Sparkles,
} from "lucide-react";
import type {
  LeadershipInsight,
  LeadershipInsightSeverity,
} from "@/lib/ai/leadership-insights";
import { cn } from "@/lib/utils";

type AttentionSummary = {
  critical: number;
  warning: number;
  info: number;
  attentionScore: number;
  ministriesWithOperationalAttention: number;
};

type AssistantAttentionCenterProps = {
  churchSlug: string;
  insights: LeadershipInsight[];
  summary: AttentionSummary;
};

const SEVERITY_LABEL: Record<LeadershipInsightSeverity, string> = {
  critical: "Prioridade alta",
  warning: "Revisar",
  info: "Informação",
};

const SEVERITY_STYLE: Record<LeadershipInsightSeverity, string> = {
  critical:
    "border-rose-500/20 bg-rose-500/8 text-rose-700 dark:text-rose-300",
  warning:
    "border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300",
  info: "border-foreground/10 bg-muted/35 text-foreground",
};

function eventDate(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function severityIcon(severity: LeadershipInsightSeverity) {
  if (severity === "info") return <CheckCircle2 className="size-3.5" />;
  return <CircleAlert className="size-3.5" />;
}

export function AssistantAttentionCenter({
  churchSlug,
  insights,
  summary,
}: AssistantAttentionCenterProps) {
  const attentionCount = summary.critical + summary.warning;
  const hasAttention = attentionCount > 0;
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const orderedInsights = useMemo(
    () => insights.slice(0, 6),
    [insights]
  );
  const visibleInsights = showAll
    ? orderedInsights
    : orderedInsights.slice(0, hasAttention ? 2 : 1);
  const hiddenCount = Math.max(0, orderedInsights.length - visibleInsights.length);

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#6e5ce6]/18 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5 sm:py-5 md:px-6"
        aria-expanded={open}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#6e5ce6] text-white shadow-sm sm:size-11">
          <Sparkles className="size-4.5 sm:size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6e5ce6] sm:text-[11px]">
              Assistente LUNOR
            </p>
            {hasAttention ? (
              <span className="rounded-full bg-[#6e5ce6]/10 px-2.5 py-1 text-[10px] font-semibold text-[#6e5ce6] sm:text-[11px]">
                {attentionCount} {attentionCount === 1 ? "prioridade" : "prioridades"}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 sm:text-[11px]">
                Tudo certo
              </span>
            )}
          </div>

          <h2 className="mt-1.5 text-[1.35rem] font-semibold leading-tight tracking-tight sm:text-2xl">
            {hasAttention ? "Vamos por partes." : "Tudo certo por aqui."}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {hasAttention
              ? `Separei ${attentionCount} ${attentionCount === 1 ? "ponto" : "pontos"} para você priorizar em ${summary.ministriesWithOperationalAttention} ${summary.ministriesWithOperationalAttention === 1 ? "ministério" : "ministérios"}. Comece pelo primeiro item.`
              : orderedInsights[0]?.detail ?? "Não encontrei pendências operacionais relevantes nos próximos cultos."}
          </p>
        </div>

        <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/10 text-muted-foreground">
          <ChevronDown
            className={cn(
              "size-4 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </span>
      </button>

      {open && (
        <div className="border-t border-foreground/8 bg-muted/[0.08] px-3 pb-4 pt-3 sm:px-5 sm:pb-5 md:px-6">
          <div className="space-y-3">
            {visibleInsights.map((insight, index) => (
              <article
                key={insight.id}
                className="rounded-2xl border border-foreground/10 bg-background px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:px-5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
                      SEVERITY_STYLE[insight.severity]
                    )}
                  >
                    {severityIcon(insight.severity)}
                    {SEVERITY_LABEL[insight.severity]}
                  </span>
                  <span className="font-semibold text-foreground">
                    {insight.ministry.name}
                  </span>
                  {insight.event && (
                    <span className="text-muted-foreground">
                      {eventDate(insight.event.startsAt)}
                    </span>
                  )}
                  {index === 0 && hasAttention && (
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6e5ce6]">
                      Comece aqui
                    </span>
                  )}
                </div>

                <h3 className="mt-3 text-base font-semibold leading-snug tracking-tight sm:text-[1.05rem]">
                  {insight.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {insight.detail}
                </p>

                <div className="mt-3 rounded-xl bg-[#6e5ce6]/7 px-3.5 py-3">
                  <p className="text-xs leading-relaxed text-foreground/85">
                    <span className="font-semibold text-[#6e5ce6]">Sugestão do LUNOR:</span>{" "}
                    {insight.suggestedAction}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <Link
                    href={copilotSuggestionHref(churchSlug, insight)}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#6e5ce6] px-4 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5"
                  >
                    {copilotSuggestion(insight).label}
                    <Sparkles className="size-3.5" />
                  </Link>

                  {insight.event ? (
                    <Link
                      href={`/${churchSlug}/escalas/${insight.event.id}`}
                      className="inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Abrir culto
                      <ArrowRight className="size-3.5" />
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>

          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-dashed border-foreground/15 px-4 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Ver mais {hiddenCount} {hiddenCount === 1 ? "prioridade" : "prioridades"}
            </button>
          )}

          {showAll && orderedInsights.length > 2 && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="mt-2 min-h-10 w-full text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Mostrar menos
            </button>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-foreground/8 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground">
              O LUNOR prepara os próximos passos. Nada é alterado sem a sua confirmação.
            </p>
            <Link
              href={`/${churchSlug}/assistente`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-[#6e5ce6]/25 px-4 text-xs font-semibold text-[#6e5ce6] transition-colors hover:bg-[#6e5ce6]/8"
            >
              Conversar com o LUNOR
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
