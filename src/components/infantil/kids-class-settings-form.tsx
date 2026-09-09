"use client";

import { useState, useTransition } from "react";
import { Save, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveKidsClassNames } from "@/lib/actions/kids-class-settings";

export type KidsClassSettingsRow = {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
};

function ageRangeLabel(minMonths: number, maxMonths: number) {
  const minYears = Math.floor(minMonths / 12);
  const maxYears = Math.floor(maxMonths / 12);
  if (minYears === maxYears) return `${minYears} ${minYears === 1 ? "ano" : "anos"}`;
  return `${minYears} a ${maxYears} anos`;
}

export function KidsClassSettingsForm({
  churchSlug,
  ministryId,
  initialClasses,
}: {
  churchSlug: string;
  ministryId: string;
  initialClasses: KidsClassSettingsRow[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [pending, startTransition] = useTransition();

  function changeName(id: string, name: string) {
    setClasses((current) =>
      current.map((item) => (item.id === id ? { ...item, name } : item))
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveKidsClassNames({
        churchSlug,
        ministryId,
        classes: classes.map(({ id, name }) => ({ id, name })),
      });
      if (result.ok) toast.success("Nomes das turmas salvos");
      else toast.error(result.error);
    });
  }

  return (
    <section className="rounded-3xl border p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
          <UsersRound className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Turmas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Altere o nome que aparece no Kids, no check-in e nas etiquetas. Ex.: Maternal pode virar 2-3.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {classes.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
          >
            <label className="space-y-2 text-sm font-medium">
              Nome da turma
              <Input
                value={item.name}
                onChange={(event) => changeName(item.id, event.target.value)}
                maxLength={50}
                className="h-11 rounded-xl"
              />
            </label>
            <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:min-w-36">
              <span className="block font-medium text-foreground">Faixa automática</span>
              {ageRangeLabel(item.minAgeMonths, item.maxAgeMonths)}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Alterar o nome não muda a regra automática de idade da turma.
      </p>

      <Button
        type="button"
        disabled={pending || classes.some((item) => !item.name.trim())}
        onClick={save}
        className="mt-4 h-11 rounded-full px-5"
      >
        <Save className="size-4" />
        {pending ? "Salvando…" : "Salvar turmas"}
      </Button>
    </section>
  );
}
