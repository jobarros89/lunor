"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  createDepartment,
  createTeamFunction,
  deleteDepartment,
  deleteTeamFunction,
} from "@/lib/actions/departamentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type Ministry = { id: string; name: string };
type Department = { id: string; name: string; ministry_id: string | null };
type TeamFunction = {
  id: string;
  name: string;
  ministry_id: string;
  department_id: string;
};

export function DepartmentsManager({
  churchSlug,
  churchId,
  departments,
  functions,
  ministries,
}: {
  churchSlug: string;
  churchId: string;
  departments: Department[];
  functions: TeamFunction[];
  ministries: Ministry[];
}) {
  const [pending, startTransition] = useTransition();
  const teamInputRef = useRef<HTMLInputElement>(null);

  function addTeam(formData: FormData) {
    startTransition(async () => {
      const result = await createDepartment({
        churchSlug,
        churchId,
        ministryId: formData.get("ministryId"),
        name: formData.get("name"),
      });
      if (result && !result.ok) toast.error(result.error);
      else {
        toast.success("Time adicionado");
        if (teamInputRef.current) teamInputRef.current.value = "";
      }
    });
  }

  function addFunction(formData: FormData) {
    startTransition(async () => {
      const result = await createTeamFunction({
        churchSlug,
        churchId,
        ministryId: formData.get("ministryId"),
        departmentId: formData.get("departmentId"),
        name: formData.get("name"),
      });
      if (result && !result.ok) toast.error(result.error);
      else toast.success("Função adicionada");
    });
  }

  function removeTeam(departmentId: string) {
    startTransition(async () => {
      const result = await deleteDepartment({ churchSlug, departmentId });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  function removeFunction(functionId: string) {
    startTransition(async () => {
      const result = await deleteTeamFunction({ churchSlug, functionId });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  const legacyTeams = departments.filter((team) => !team.ministry_id);

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            1 · Área
          </p>
          <p className="mt-1 text-sm font-medium">Louvor, Kids, Mídia…</p>
        </div>
        <div className="rounded-2xl border bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            2 · Time
          </p>
          <p className="mt-1 text-sm font-medium">Banda, Áudio, Recepção…</p>
        </div>
        <div className="rounded-2xl border bg-muted/20 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            3 · Função
          </p>
          <p className="mt-1 text-sm font-medium">DM, Baixo, Bateria…</p>
        </div>
      </div>

      {ministries.length > 0 ? (
        <div className="rounded-2xl border p-4">
          <p className="mb-3 text-sm font-medium">Adicionar um novo time</p>
          <form
            action={addTeam}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
          >
            <Select name="ministryId" required defaultValue="">
              <option value="" disabled>
                Escolha a área
              </option>
              {ministries.map((ministry) => (
                <option key={ministry.id} value={ministry.id}>
                  {ministry.name}
                </option>
              ))}
            </Select>
            <Input
              ref={teamInputRef}
              name="name"
              placeholder="Nome do time (ex.: Banda)"
              required
            />
            <Button type="submit" disabled={pending} className="px-5">
              <Plus className="size-4" />
              Adicionar time
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Crie uma área/ministério antes de configurar os times.
        </p>
      )}

      <div className="space-y-4">
        {ministries.map((ministry) => {
          const ministryTeams = departments.filter(
            (team) => team.ministry_id === ministry.id,
          );
          const ministryFunctionCount = functions.filter(
            (item) => item.ministry_id === ministry.id,
          ).length;

          return (
            <section
              key={ministry.id}
              className="space-y-4 rounded-2xl border p-4 sm:p-5"
              aria-labelledby={`ministry-${ministry.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p
                    id={`ministry-${ministry.id}`}
                    className="font-semibold"
                  >
                    {ministry.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Área / ministério
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ministryTeams.length} {ministryTeams.length === 1 ? "time" : "times"} ·{" "}
                  {ministryFunctionCount}{" "}
                  {ministryFunctionCount === 1 ? "função" : "funções"}
                </p>
              </div>

              {ministryTeams.length === 0 ? (
                <div className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  Nenhum time configurado nesta área ainda.
                </div>
              ) : (
                <div className="space-y-3">
                  {ministryTeams.map((team) => {
                    const teamFunctions = functions.filter(
                      (item) => item.department_id === team.id,
                    );
                    return (
                      <div
                        key={team.id}
                        className="space-y-3 rounded-xl bg-muted/25 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{team.name}</p>
                            <p className="text-xs text-muted-foreground">Time</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={pending}
                            className="size-9 text-muted-foreground"
                            aria-label={`Remover time ${team.name}`}
                            onClick={() => removeTeam(team.id)}
                          >
                            <X className="size-4" />
                          </Button>
                        </div>

                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Funções
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {teamFunctions.map((item) => (
                              <span
                                key={item.id}
                                className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-sm"
                              >
                                {item.name}
                                <button
                                  type="button"
                                  disabled={pending}
                                  className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                                  aria-label={`Remover função ${item.name}`}
                                  onClick={() => removeFunction(item.id)}
                                >
                                  <X className="size-3" />
                                </button>
                              </span>
                            ))}
                            {teamFunctions.length === 0 && (
                              <span className="text-sm text-muted-foreground">
                                Nenhuma função cadastrada.
                              </span>
                            )}
                          </div>
                        </div>

                        <form
                          action={addFunction}
                          className="flex flex-col gap-2 sm:flex-row"
                        >
                          <input
                            type="hidden"
                            name="ministryId"
                            value={ministry.id}
                          />
                          <input
                            type="hidden"
                            name="departmentId"
                            value={team.id}
                          />
                          <Input
                            name="name"
                            placeholder="Nova função (ex.: DM, Baixo, Bateria)"
                            required
                          />
                          <Button
                            type="submit"
                            variant="outline"
                            disabled={pending}
                          >
                            Adicionar função
                          </Button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {legacyTeams.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="font-medium">Times antigos sem área</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Estes registros foram preservados, mas precisam ser reorganizados em
            uma área antes de novas escalas.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {legacyTeams.map((team) => (
              <span
                key={team.id}
                className="rounded-full border bg-background px-3 py-1 text-sm"
              >
                {team.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
