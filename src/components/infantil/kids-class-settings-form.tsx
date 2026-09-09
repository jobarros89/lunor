"use client";

import { useState, useTransition } from "react";
import { Plus, Save, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createKidsClass,
  deleteKidsClass,
  saveKidsClasses,
} from "@/lib/actions/kids-class-settings";

export type KidsClassSettingsRow = {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
};

function yearsFromMonths(months: number) {
  return Math.floor(months / 12);
}

function sortByAge(items: KidsClassSettingsRow[]) {
  return [...items].sort((a, b) => a.minAgeMonths - b.minAgeMonths || a.name.localeCompare(b.name, "pt-BR"));
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
  const [classes, setClasses] = useState(sortByAge(initialClasses));
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newMinAge, setNewMinAge] = useState("");
  const [newMaxAge, setNewMaxAge] = useState("");

  function updateClass(
    id: string,
    patch: Partial<Pick<KidsClassSettingsRow, "name" | "minAgeMonths" | "maxAgeMonths">>
  ) {
    setClasses((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function save() {
    startTransition(async () => {
      const result = await saveKidsClasses({
        churchSlug,
        ministryId,
        classes: classes.map((item) => ({
          id: item.id,
          name: item.name,
          minAgeYears: yearsFromMonths(item.minAgeMonths),
          maxAgeYears: yearsFromMonths(item.maxAgeMonths),
        })),
      });
      if (result.ok) {
        setClasses((current) => sortByAge(current));
        toast.success("Turmas salvas");
      } else {
        toast.error(result.error);
      }
    });
  }

  function addClass() {
    const minAgeYears = Number(newMinAge);
    const maxAgeYears = Number(newMaxAge);
    if (!newName.trim() || newMinAge === "" || newMaxAge === "") {
      toast.error("Informe nome, idade mínima e idade máxima");
      return;
    }

    startTransition(async () => {
      const result = await createKidsClass({
        churchSlug,
        ministryId,
        name: newName,
        minAgeYears,
        maxAgeYears,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setClasses((current) => sortByAge([...current, result.data]));
      setNewName("");
      setNewMinAge("");
      setNewMaxAge("");
      toast.success("Turma adicionada");
    });
  }

  function removeClass(item: KidsClassSettingsRow) {
    const confirmed = window.confirm(
      `Remover a turma “${item.name}”?\n\nTurmas com histórico de check-in não podem ser excluídas.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteKidsClass({
        churchSlug,
        ministryId,
        classId: item.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setClasses((current) => current.filter((row) => row.id !== item.id));
      toast.success("Turma removida");
    });
  }

  return (
    <section className="rounded-3xl border p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <UsersRound className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Turmas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Defina o nome e a faixa etária usada automaticamente no Kids, check-in e etiquetas.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {classes.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 rounded-2xl border p-4 lg:grid-cols-[minmax(0,1fr)_140px_140px_auto] lg:items-end"
          >
            <label className="space-y-2 text-sm font-medium">
              Nome da turma
              <Input
                value={item.name}
                onChange={(event) => updateClass(item.id, { name: event.target.value })}
                maxLength={50}
                className="h-11 rounded-xl"
              />
            </label>

            <label className="space-y-2 text-sm font-medium">
              Idade mínima
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={18}
                  value={yearsFromMonths(item.minAgeMonths)}
                  onChange={(event) => {
                    const years = Number(event.target.value);
                    updateClass(item.id, { minAgeMonths: years * 12 });
                  }}
                  className="h-11 rounded-xl pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">anos</span>
              </div>
            </label>

            <label className="space-y-2 text-sm font-medium">
              Idade máxima
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={18}
                  value={yearsFromMonths(item.maxAgeMonths)}
                  onChange={(event) => {
                    const years = Number(event.target.value);
                    updateClass(item.id, { maxAgeMonths: years * 12 + 11 });
                  }}
                  className="h-11 rounded-xl pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">anos</span>
              </div>
            </label>

            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => removeClass(item)}
              className="h-11 rounded-full px-4 text-destructive hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Remover
            </Button>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-dashed p-4">
        <div>
          <p className="font-medium">Adicionar nova turma</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A faixa não pode se sobrepor às turmas existentes.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_140px_auto] lg:items-end">
          <label className="space-y-2 text-sm font-medium">
            Nome da turma
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ex.: 10-11 anos"
              maxLength={50}
              className="h-11 rounded-xl"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Idade mínima
            <Input
              type="number"
              min={0}
              max={18}
              value={newMinAge}
              onChange={(event) => setNewMinAge(event.target.value)}
              placeholder="10"
              className="h-11 rounded-xl"
            />
          </label>
          <label className="space-y-2 text-sm font-medium">
            Idade máxima
            <Input
              type="number"
              min={0}
              max={18}
              value={newMaxAge}
              onChange={(event) => setNewMaxAge(event.target.value)}
              placeholder="11"
              className="h-11 rounded-xl"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={addClass}
            className="h-11 rounded-full px-5"
          >
            <Plus className="size-4" />
            Adicionar turma
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          A faixa etária é usada para sugerir automaticamente a turma da criança no check-in.
        </p>
        <Button
          type="button"
          disabled={pending || classes.some((item) => !item.name.trim())}
          onClick={save}
          className="h-11 rounded-full px-5"
        >
          <Save className="size-4" />
          {pending ? "Salvando…" : "Salvar turmas"}
        </Button>
      </div>
    </section>
  );
}
