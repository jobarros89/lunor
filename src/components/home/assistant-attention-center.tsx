import Link from "next/link";
import {
  AlertTriangle,
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
  critical: "Crítico",
  warning: "Atenção",
  info: "Informação",
};

const SEVERITY_STYLE: Record<LeadershipInsightSeverity, string> = {
  critical:
    "border-red-500/25 bg-red-500/5 text-red-700 dark:text-red-300",
  warning:
    "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  info: "border-foreground/10 bg-muted/25 text-foreground",
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
  if (severity === "critical") return <CircleAlert className="size-4" />;
  if (severity === "warning") return <AlertTriangle className="size-4" />;
  return <CheckCircle2 className="size-4" />;
}

export function AssistantAttentionCenter({
  churchSlug,
  insights,
  summary,
}: AssistantAttentionCenterProps) {
  const attentionCount = summary.critical + summary.warning;
  const hasAttention = attentionCount > 0;
  const visibleInsights = insights.slice(0, 6);

  return (
    <section className="overflow-hidden rounded-3xl border border-[#6e5ce6]/20 bg-gradient-to-br from-[#6e5ce6]/8 via-background to-background shadow-sm">
      <details open={hasAttention} className="group">
        <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 marker:hidden md:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#6e5ce6] text-white">
            <Sparkles className="size-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6e5ce6]">
                Assistente LUNOR
              </p>
              {summary.critical > 0 && (
                <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:text-red-300">
                  {summary.critical} crítico{summary.critical === 1 ? "" : "s"}
                </span>
              )}
              {summary.warning > 0 && (
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                  {summary.warning} em atenção
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight md:text-2xl">
              {hasAttention
                ? `${attentionCount} ${attentionCount === 1 ? "item precisa" : "itens precisam"} da sua atenção`
                : "Operação sem alertas relevantes agora"}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {hasAttention
                ? `${summary.ministriesWithOperationalAttention} ${summary.ministriesWithOperationalAttention === 1 ? "ministério concentra" : "ministérios concentram"} pendências nos próximos cultos. Expanda para priorizar o que resolver primeiro.`
                : "O LUNOR não encontrou pendências críticas de escala, confirmação ou disponibilidade nos próximos cultos analisados."}
            </p>
          </div>

          <ChevronDown className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>

        <div className="border-t border-foreground/10 px-5 pb-5 pt-2 md:px-6 md:pb-6">
          <div className="divide-y divide-foreground/10">
            {visibleInsights.map((insight) => (
              <article
                key={insight.id}
                className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold",
                        SEVERITY_STYLE[insight.severity]
                      )}
                    >
                      {severityIcon(insight.severity)}
                      {SEVERITY_LABEL[insight.severity]}
                    </span>
                    <span className="font-medium">{insight.ministry.name}</span>
                    {insight.event && (
                      <span className="text-muted-foreground">
                        {eventDate(insight.event.startsAt)}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 font-semibold tracking-tight">{insight.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {insight.detail}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed">
                    <span className="font-semibold">Próximo passo:</span>{" "}
                    {insight.suggestedAction}
                  </p>
                </div>

                {insight.event ? (
                  <Link
                    href={`/${churchSlug}/escalas/${insight.event.id}`}
                    className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-foreground/15 px-4 text-xs font-semibold transition-colors hover:bg-muted md:w-auto"
                  >
                    Abrir culto
                    <ArrowRight className="size-3.5" />
                  </Link>
                ) : null}
              </article>
            ))}
          </div>

          <div className="mt-2 flex flex-col gap-3 border-t border-foreground/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-muted-foreground">
              O painel é calculado com dados reais de escala, confirmações e disponibilidade. As ações continuam sob confirmação humana.
            </p>
            <Link
              href={`/${churchSlug}/assistente`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#6e5ce6] px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Preparar correções
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </details>
    </section>
  );
}
