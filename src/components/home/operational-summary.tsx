import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AssistantLauncher } from "@/components/ai/assistant-launcher";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import type {
  OperationalEventSummary,
  OperationalReadiness,
  OperationalSummary,
} from "@/lib/operational-summary";

const readinessLabel: Record<OperationalReadiness, string> = {
  ready: "Pronto",
  attention: "Atenção",
  no_assignments: "Sem escala",
};

const readinessClass: Record<OperationalReadiness, string> = {
  ready: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  attention: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  no_assignments: "bg-muted text-muted-foreground",
};

function eventAttention(event: OperationalEventSummary) {
  const items: string[] = [];
  if (event.assignments.awaitingConfirmation > 0)
    items.push(`${event.assignments.awaitingConfirmation} aguardando confirmação`);
  if (event.assignments.wantsLeader > 0)
    items.push(`${event.assignments.wantsLeader} quer falar com o líder`);
  if (event.assignments.substitutionNeeded > 0)
    items.push(`${event.assignments.substitutionNeeded} precisa de substituição`);
  if (event.assignments.absent > 0)
    items.push(`${event.assignments.absent} ausente`);
  if (event.assignments.assignedUnavailable > 0)
    items.push(`${event.assignments.assignedUnavailable} escalado indisponível`);
  return items;
}

export function OperationalSummarySection({
  churchSlug,
  summary,
}: {
  churchSlug: string;
  summary: OperationalSummary;
}) {
  return (
    <section className="space-y-4" aria-labelledby="operational-summary-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/20 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Resumo operacional · {summary.scope.ministryName}
          </p>
          <h2 id="operational-summary-title" className="mt-2 text-2xl font-medium tracking-tight">
            O que precisa da sua atenção
          </h2>
        </div>
        <Link
          href={`/${churchSlug}/escalas`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-accent"
        >
          Abrir escalas
          <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Próximos cultos" value={summary.totals.upcomingEvents} />
        <Metric label="Pessoas ativas" value={summary.totals.activeMembers} />
        <Metric label="Escalas confirmadas" value={summary.totals.confirmedAssignments} />
        <Metric label="Cultos em atenção" value={summary.totals.eventsAttention} />
      </div>

      {summary.events.length === 0 ? (
        <div className="rounded-3xl border border-dashed px-5 py-8">
          <p className="font-medium">Nenhum culto futuro cadastrado.</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Assim que o primeiro culto for criado, o LUNOR cruza escala, disponibilidade e integrantes desta equipe aqui.
          </p>
          <Link
            href={`/${churchSlug}/escalas/novo`}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background"
          >
            Criar primeiro culto
            <ArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-foreground/15 rounded-3xl border px-4 md:px-5">
          {summary.events.map((event) => {
            const attention = eventAttention(event);
            return (
              <div key={event.id} className="grid gap-3 py-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/${churchSlug}/escalas/${event.id}`}
                      className="truncate font-semibold tracking-tight hover:opacity-65"
                    >
                      {event.title}
                    </Link>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${readinessClass[event.readiness]}`}>
                      {readinessLabel[event.readiness]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatEventDate(event.startsAt)} · {formatEventTime(event.startsAt)}
                  </p>
                </div>

                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-medium">{event.assignments.total} escalados</span>
                    <span className="text-muted-foreground"> · {event.assignments.confirmed} confirmados</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Disponibilidade: {event.availability.available} sim · {event.availability.unavailable} não · {event.availability.unknown} sem resposta
                  </p>
                  {attention.length > 0 && (
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {attention.join(" · ")}
                    </p>
                  )}
                </div>

                <Link
                  href={`/${churchSlug}/escalas/${event.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium hover:bg-accent"
                >
                  Abrir culto
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        O status usa somente dados existentes: escalas, confirmações e disponibilidade informada. “Sem escala” não significa erro — apenas que esta equipe ainda não tem pessoas escaladas no culto.
      </p>

      <AssistantLauncher
        churchSlug={churchSlug}
        ministryId={summary.scope.ministryId}
        ministryName={summary.scope.ministryName}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border bg-card/40 px-4 py-4">
      <p className="font-editorial text-3xl leading-none tracking-[-0.04em]">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
