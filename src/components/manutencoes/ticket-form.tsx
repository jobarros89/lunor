"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { createTicket } from "@/lib/actions/manutencoes";
import { PRIORITY_LABELS } from "@/lib/manutencoes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Equipment = { id: string; name: string };

export function TicketForm({
  churchSlug,
  churchId,
  equipments,
  preselectedId,
}: {
  churchSlug: string;
  churchId: string;
  equipments: Equipment[];
  preselectedId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const priorityLabelId = useId();
  const [v, setV] = useState({
    equipmentId: preselectedId ?? "",
    title: "",
    description: "",
    priority: "media" as "baixa" | "media" | "alta" | "urgente",
  });

  function submit() {
    if (!v.equipmentId) return toast.error("Escolha o equipamento");
    if (v.title.length < 2) return toast.error("Descreva o problema");
    startTransition(async () => {
      const result = await createTicket({ churchSlug, churchId, ...v });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-4 pt-6">
        <Field label="Equipamento" required>
          <select
            value={v.equipmentId}
            onChange={(e) => setV({ ...v, equipmentId: e.target.value })}
            className="lunor-control h-11 w-full rounded-xl border bg-background px-3 text-sm"
          >
            <option value="">Escolher equipamento…</option>
            {equipments.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Problema" required>
          <Input
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            placeholder="Ex.: Canal 5 sem áudio"
            className="h-11 rounded-xl"
          />
        </Field>

        <Field label="Detalhes">
          <textarea
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            rows={3}
            className="lunor-control w-full rounded-xl border bg-background p-3 text-base md:text-sm"
            placeholder="Quando começou, o que já foi testado…"
          />
        </Field>

        <div className="space-y-1.5">
          <span id={priorityLabelId} className="block text-sm font-medium">
            Prioridade
          </span>
          <div
            role="group"
            aria-labelledby={priorityLabelId}
            className="flex flex-wrap gap-2"
          >
            {(Object.keys(PRIORITY_LABELS) as (typeof v.priority)[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={v.priority === p}
                  onClick={() => setV({ ...v, priority: p })}
                  className={cn(
                    "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                    v.priority === p
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                  )}
                >
                  {PRIORITY_LABELS[p]}
                </button>
              )
            )}
          </div>
        </div>

        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="h-12 w-full rounded-full text-base"
        >
          {pending ? "Abrindo…" : "Abrir chamado"}
        </Button>
      </CardContent>
    </Card>
  );
}
