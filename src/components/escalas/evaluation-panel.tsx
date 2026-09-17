"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { submitEvaluation } from "@/lib/actions/avaliacoes";
import { CRITERIOS } from "@/lib/manutencoes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type EvaluationValues = {
  pontualidade: number;
  organizacao: number;
  conhecimento: number;
  comunicacao: number;
  trabalho_equipe: number;
  comprometimento: number;
  notes: string;
};

const DEFAULT: EvaluationValues = {
  pontualidade: 0,
  organizacao: 0,
  conhecimento: 0,
  comunicacao: 0,
  trabalho_equipe: 0,
  comprometimento: 0,
  notes: "",
};

export function EvaluationPanel({
  churchSlug,
  churchId,
  eventId,
  assignmentId,
  userId,
  fullName,
  existing,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  assignmentId: string;
  userId: string;
  fullName: string;
  existing: EvaluationValues | null;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<EvaluationValues>(existing ?? DEFAULT);

  const complete = CRITERIOS.every(
    (c) => v[c.key as keyof EvaluationValues] as number >= 1
  );

  function submit() {
    startTransition(async () => {
      const result = await submitEvaluation({
        churchSlug,
        churchId,
        eventId,
        assignmentId,
        userId,
        ...v,
      });
      if (result && !result.ok) toast.error(result.error);
      else {
        toast.success(`Avaliação de ${fullName} salva`);
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-2xl border px-4 py-3">
        <div>
          <p className="font-medium">{fullName}</p>
          <p className="text-xs text-muted-foreground">
            {existing ? "Avaliado — toque para revisar" : "Ainda não avaliado"}
          </p>
        </div>
        <Button
          size="sm"
          variant={existing ? "outline" : "default"}
          className="h-9 rounded-full px-4"
          onClick={() => setOpen(true)}
        >
          {existing ? "Revisar" : "Avaliar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border p-4">
      <p className="font-medium">{fullName}</p>
      {CRITERIOS.map((c) => (
        <div key={c.key} className="space-y-1.5">
          <p className="text-sm text-muted-foreground">{c.label}</p>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setV((prev) => ({ ...prev, [c.key]: n }))}
                aria-label={`${c.label}: nota ${n}`}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  (v[c.key as keyof EvaluationValues] as number) === n
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <textarea
        value={v.notes}
        onChange={(e) => setV((prev) => ({ ...prev, notes: e.target.value }))}
        placeholder="Observações (opcional)"
        rows={2}
        className="lunor-control w-full rounded-xl border bg-background p-3 text-base md:text-sm"
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-full"
        >
          Cancelar
        </Button>
        <Button
          disabled={pending || !complete}
          onClick={submit}
          className="h-11 flex-1 rounded-full"
        >
          {pending ? "Salvando…" : "Salvar avaliação"}
        </Button>
      </div>
    </div>
  );
}
