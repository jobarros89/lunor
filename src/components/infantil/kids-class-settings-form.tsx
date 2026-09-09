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
  campusId: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
};

type CampusOption = {
  id: string;
  name: string;
};

function yearsFromMonths(months: number) {
  return Math.floor(months / 12);
}

function sortByAge(items: KidsClassSettingsRow[]) {
  return [...items].sort(
    (a, b) => a.minAgeMonths - b.minAgeMonths || a.name.localeCompare(b.name, "pt-BR")
  );
}

export function KidsClassSettingsForm({
  churchSlug,
  ministryId,
  campuses,
  initialCampusId,
  initialClasses,
}: {
  churchSlug: string;
  ministryId: string;
  campuses: CampusOption[];
  initialCampusId: string;
  initialClasses: KidsClassSettingsRow[];
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [selectedCampusId, setSelectedCampusId] = useState(initialCampusId);
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newMinAge, setNewMinAge] = useState("");
  const [newMaxAge, setNewMaxAge] = useState("");

  const currentCampus = campuses.find((campus) => campus.id === selectedCampusId) ?? null;
  const currentClasses = sortByAge(
    classes.filter((item) => item.campusId === selectedCampusId)
  );

  function clearNewClass() {
    setNewName("");
    setNewMinAge("");
    setNewMaxAge("");
  }

  function updateClass(
    id: string,
    patch: Partial<Pick<KidsClassSettingsRow, "name" | "minAgeMonths" | "maxAgeMonths">>
  ) {
    setClasses((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function save() {
    if (!selectedCampusId || currentClasses.length === 0) return;
    startTransition(async () => {
      const result = await saveKidsClasses({
        churchSlug,
        ministryId,
        campusId: selectedCampusId,
        classes: currentClasses.map((item) => ({
          id: item.id,
          name: item.name,
          minAgeYears: yearsFromMonths(item.minAgeMonths),
          maxAgeYears: yearsFromMonths(item.maxAgeMonths),
        })),
      });
      if (result.ok) {
        setClasses((current) => sortByAge(current));
        toast.success(`Turmas de ${currentCampus?.name ?? "campus"} salvas`);
      } else {
        toast.error(result.error);
      }
    });
  }

  function addClass() {
    if (!selectedCampusId) return toast.error("Escolha um campus");
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
        campusId: selectedCampusId,
        name: newName,
        minAgeYears,
        maxAgeYears,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setClasses((current) =>
        sortByAge([
          ...current,
          {
            ...result.data,
            campusId: selectedCampusId,
          },
        ])
      );
      clearNewClass();
      toast.success("Turma adicionada");
    });
  }

  function removeClass(item: KidsClassSettingsRow) {
    const confirmed = window.confirm(
      `Remover a turma “${item.name}” de ${currentCampus?.name ?? "este campus"}?\n\nTurmas com histórico de check-in não podem ser excluídas.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteKidsClass({
        churchSlug,
        ministryId,
        campusId: selectedCampusId,
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

  if (campuses.length === 0) {
    return (
      <section className="rounded-3xl border p-5">
        <h2 className="text-lg font-semibold">Turmas</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre pelo menos um campus na Administração antes de configurar as turmas do Kids.
        </p>
      </section>
    );
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
              Cada campus possui suas próprias turmas e faixas etárias. A criança recebe a sugestão conforme o campus da recepção.
            </p>
          </div>
        </div>

        <label className="min-w-52 space-y-2 text-sm font-medium">
          Campus
          <select
            value={selectedCampusId}
            onChange={(event) => {
              setSelectedCampusId(event.target.value);
              clearNewClass();
            }}
            className="h-11 w-full rounded-xl border bg-background px-3 text-base font-normal md:text-sm"
          >
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 rounded-2xl bg-muted/40 px-4 py-3">
        <p className="text-sm font-medium">Campus {currentCampus?.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          As turmas abaixo serão usadas somente nas recepções deste campus.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {currentClasses.map((item) => (
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
                  onChange={(event) =>
                    updateClass(item.id, { minAgeMonths: Number(event.target.value) * 12 })
                  }
                  className="h-11 rounded-xl pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  anos
                </span>
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
                  onChange={(event) =>
                    updateClass(item.id, { maxAgeMonths: Number(event.target.value) * 12 + 11 })
                  }
                  className="h-11 rounded-xl pr-12"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                  anos
                </span>
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

        {currentClasses.length === 0 && (
          <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
            Nenhuma turma configurada para {currentCampus?.name}. Adicione a primeira turma abaixo.
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-dashed p-4">
        <div>
          <p className="font-medium">Adicionar nova turma em {currentCampus?.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A faixa não pode se sobrepor às outras turmas deste campus.
          </p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_140px_auto] lg:items-end">
          <label className="space-y-2 text-sm font-medium">
            Nome da turma
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Ex.: Kids 1"
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
              placeholder="3"
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
              placeholder="5"
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
          A faixa etária sugere a turma no check-in. A equipe pode alterar a turma manualmente quando necessário.
        </p>
        {currentClasses.length > 0 && (
          <Button
            type="button"
            disabled={pending || currentClasses.some((item) => !item.name.trim())}
            onClick={save}
            className="h-11 rounded-full px-5"
          >
            <Save className="size-4" />
            {pending ? "Salvando…" : "Salvar turmas"}
          </Button>
        )}
      </div>
    </section>
  );
}
