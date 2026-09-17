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

  const ministryNameById = new Map(ministries.map((ministry) => [ministry.id, ministry.name]));

  return (
    <div className="space-y-4">
      {ministries.length > 0 ? (
        <form action={addTeam} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select name="ministryId" required defaultValue="">
            <option value="" disabled>Selecione o ministério/área</option>
            {ministries.map((ministry) => (
              <option key={ministry.id} value={ministry.id}>{ministry.name}</option>
            ))}
          </Select>
          <Input ref={teamInputRef} name="name" placeholder="Nome do time (ex.: Banda, MC)" required />
          <Button type="submit" disabled={pending} className="px-5">
            <Plus className="size-4" />
            Adicionar time
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Crie um ministério/área antes de configurar os times.</p>
      )}

      <div className="space-y-3">
        {departments.map((team) => {
          const teamFunctions = functions.filter((item) => item.department_id === team.id);
          return (
            <div key={team.id} className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{team.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {team.ministry_id ? ministryNameById.get(team.ministry_id) ?? "Ministério/área" : "Time legado sem ministério"}
                  </p>
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

              <div className="flex flex-wrap gap-2">
                {teamFunctions.map((item) => (
                  <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
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
                  <span className="text-sm text-muted-foreground">Nenhuma função cadastrada.</span>
                )}
              </div>

              {team.ministry_id && (
                <form action={addFunction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="ministryId" value={team.ministry_id} />
                  <input type="hidden" name="departmentId" value={team.id} />
                  <Input name="name" placeholder="Função (ex.: DM, Áudio, Bateria)" required />
                  <Button type="submit" variant="outline" disabled={pending}>Adicionar função</Button>
                </form>
              )}
            </div>
          );
        })}
        {departments.length === 0 && ministries.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum time criado. Organize cada ministério/área em times e funções.
          </p>
        )}
      </div>
    </div>
  );
}
