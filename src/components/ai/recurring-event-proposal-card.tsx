"use client";

import { useState, useTransition } from "react";
import { CalendarDays, CheckCircle2, MapPin } from "lucide-react";
import { confirmAssistantRecurringEvents } from "@/lib/actions/ai-recurring-events";
import { HumanReview } from "@/components/ai/human-review";
import { recurringReviewSnapshot } from "@/lib/ai/human-review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RecurringEventProposal = {
  kind: "recurring_event_proposal";
  templateEventId: string;
  title: string;
  campus: { id: string; name: string };
  servicePeriod: "manha" | "tarde" | "noite";
  weekday: "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado";
  location: string | null;
  templateStartsAt: string;
  occurrences: Array<{ startsAt: string; endsAt: string | null }>;
  skippedExisting: number;
};

const PERIOD_LABELS = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
} as const;

function occurrenceLabel(startsAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

export function RecurringEventProposalCard({
  churchSlug,
  proposal,
}: {
  churchSlug: string;
  proposal: RecurringEventProposal;
}) {
  const [pending, startTransition] = useTransition();
  const [reviewed, setReviewed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function confirm() {
    if (pending || confirmed || !reviewed) return;
    setError("");
    setSuccess("");
    startTransition(async () => {
      try {
        const result = await confirmAssistantRecurringEvents({
          churchSlug,
          templateEventId: proposal.templateEventId,
          startsAt: proposal.occurrences.map((occurrence) => occurrence.startsAt),
          review: { validated: true, snapshot: recurringReviewSnapshot(proposal) },
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }

        const { created, skippedExisting } = result.data;
        setConfirmed(true);
        setSuccess(
          created === 0
            ? "Todos esses cultos já estavam cadastrados. Nenhuma duplicação foi criada."
            : `${created} culto${created === 1 ? "" : "s"} criado${created === 1 ? "" : "s"}${skippedExisting > 0 ? ` · ${skippedExisting} data${skippedExisting === 1 ? "" : "s"} já existente${skippedExisting === 1 ? "" : "s"} preservada${skippedExisting === 1 ? "" : "s"}` : ""}.`
        );
      } catch {
        setError("Não foi possível confirmar os cultos agora. Confira a agenda antes de tentar novamente.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-[#6e5ce6]/25 bg-background p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#6e5ce6]/12 text-[#6e5ce6]">
          <CalendarDays className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e5ce6]">
            Série de cultos
          </p>
          <p className="mt-1 font-semibold">{proposal.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {proposal.campus.name} · {PERIOD_LABELS[proposal.servicePeriod]} · {proposal.occurrences.length} {proposal.occurrences.length === 1 ? "nova data" : "novas datas"}
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-foreground/10 bg-muted/20 p-2">
        {proposal.occurrences.map((occurrence) => (
          <div
            key={occurrence.startsAt}
            className="rounded-lg bg-background px-3 py-2 text-xs font-medium"
          >
            {occurrenceLabel(occurrence.startsAt)}
            {occurrence.endsAt && <span className="mt-1 block text-muted-foreground">Término: {occurrenceLabel(occurrence.endsAt)}</span>}
          </div>
        ))}
      </div>

      {proposal.location && <p className="mt-3 text-xs text-muted-foreground">Local: {proposal.location}</p>}
      {proposal.skippedExisting > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {proposal.skippedExisting} {proposal.skippedExisting === 1 ? "data já está cadastrada e será preservada" : "datas já estão cadastradas e serão preservadas"}.
        </p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        O LUNOR usa o culto existente como modelo de título, campus, período, horário, duração, local e tipo. A confirmação cria somente as datas que ainda não existem.
      </p>

      {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
      {success && (
        <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {success}
        </p>
      )}

      <HumanReview checked={reviewed} onChange={setReviewed} disabled={pending || confirmed} />
      <Button
        type="button"
        onClick={confirm}
        disabled={pending || confirmed || !reviewed}
        className={cn(
          "mt-3 w-full rounded-full",
          confirmed
            ? "bg-emerald-600 text-white hover:bg-emerald-600"
            : "bg-[#6e5ce6] text-white hover:bg-[#5f4fd1]"
        )}
      >
        {pending ? (
          "Criando cultos…"
        ) : confirmed ? (
          <>
            <CheckCircle2 className="size-4" />
            Série confirmada
          </>
        ) : (
          `Aprovar e criar ${proposal.occurrences.length} culto${proposal.occurrences.length === 1 ? "" : "s"}`
        )}
      </Button>
    </div>
  );
}

