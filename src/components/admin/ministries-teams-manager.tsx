"use client";

import { useTransition } from "react";
import { ChevronDown, CircleOff, Plus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import {
  createAdminFunction,
  createAdminMinistry,
  createAdminTeam,
  setAdminFunctionActive,
  setAdminMinistryActive,
  setAdminTeamActive,
  updateAdminFunction,
  updateAdminMinistry,
  updateAdminTeam,
} from "@/lib/actions/ministry-admin";
import type { ActionResult } from "@/lib/actions/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Ministry = {
  id: string;
  name: string;
  module_key: "generic" | "worship" | "kids";
  active: boolean;
};
type Team = {
  id: string;
  ministry_id: string | null;
  name: string;
  active: boolean;
};
type TeamFunction = {
  id: string;
  ministry_id: string;
  department_id: string;
  name: string;
  active: boolean;
};

export function MinistriesTeamsManager({
  churchSlug,
  churchId,
  ministries,
  teams,
  functions,
}: {
  churchSlug: string;
  churchId: string;
  ministries: Ministry[];
  teams: Team[];
  functions: TeamFunction[];
}) {
  const [pending, startTransition] = useTransition();

  function execute(
    action: () => Promise<ActionResult>,
    success: string,
    form?: HTMLFormElement,
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form?.reset();
      toast.success(success);
    });
  }

  return (
    <div className="space-y-5">
      <form
        className="rounded-2xl border bg-card p-4 sm:flex sm:items-end sm:gap-3"
        action={(formData) => {
          const form = document.activeElement?.closest("form") as HTMLFormElement | null;
          execute(
            () => createAdminMinistry({
              churchSlug,
              churchId,
              name: formData.get("name"),
            }),
            "Ministério criado",
            form ?? undefined,
          );
        }}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor="new-ministry" className="text-sm font-medium">Novo ministério ou área</label>
          <Input id="new-ministry" name="name" required placeholder="Ex.: Produção, Louvor, Kids" className="mt-2" />
        </div>
        <Button type="submit" disabled={pending} className="mt-3 w-full sm:mt-0 sm:w-auto">
          <Plus className="size-4" />
          Criar ministério
        </Button>
      </form>

      <div className="space-y-4">
        {ministries.map((ministry) => {
          const ministryTeams = teams.filter((team) => team.ministry_id === ministry.id);
          return (
            <section
              key={ministry.id}
              className={`rounded-2xl border bg-card ${ministry.active ? "" : "opacity-70"}`}
            >
              <div className="space-y-3 border-b p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold">{ministry.name}</h2>
                      <Badge variant={ministry.active ? "secondary" : "outline"}>
                        {ministry.active ? "Ativo" : "Desativado"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ministryTeams.length} {ministryTeams.length === 1 ? "time" : "times"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => execute(
                      () => setAdminMinistryActive({
                        churchSlug,
                        churchId,
                        ministryId: ministry.id,
                        active: !ministry.active,
                      }),
                      ministry.active ? "Ministério desativado" : "Ministério reativado",
                    )}
                  >
                    {ministry.active ? <CircleOff className="size-4" /> : <RotateCcw className="size-4" />}
                    <span className="hidden sm:inline">{ministry.active ? "Desativar" : "Reativar"}</span>
                  </Button>
                </div>

                <form
                  className="flex gap-2"
                  action={(formData) => execute(
                    () => updateAdminMinistry({
                      churchSlug,
                      churchId,
                      ministryId: ministry.id,
                      name: formData.get("name"),
                    }),
                    "Ministério atualizado",
                  )}
                >
                  <Input name="name" defaultValue={ministry.name} aria-label={`Nome de ${ministry.name}`} required />
                  <Button type="submit" variant="outline" size="icon" disabled={pending} aria-label="Salvar ministério">
                    <Save className="size-4" />
                  </Button>
                </form>
              </div>

              <div className="space-y-3 p-4">
                {ministryTeams.map((team) => {
                  const teamFunctions = functions.filter((item) => item.department_id === team.id);
                  return (
                    <details key={team.id} className="group rounded-xl border bg-background" open>
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                        <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{team.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {teamFunctions.length} {teamFunctions.length === 1 ? "função" : "funções"}
                          </p>
                        </div>
                        <Badge variant={team.active ? "secondary" : "outline"}>
                          {team.active ? "Ativo" : "Desativado"}
                        </Badge>
                      </summary>

                      <div className="space-y-4 border-t p-3">
                        <div className="flex gap-2">
                          <form
                            className="flex min-w-0 flex-1 gap-2"
                            action={(formData) => execute(
                              () => updateAdminTeam({
                                churchSlug,
                                churchId,
                                ministryId: ministry.id,
                                teamId: team.id,
                                name: formData.get("name"),
                              }),
                              "Time atualizado",
                            )}
                          >
                            <Input name="name" defaultValue={team.name} aria-label={`Nome do time ${team.name}`} required />
                            <Button type="submit" variant="outline" size="icon" disabled={pending} aria-label="Salvar time">
                              <Save className="size-4" />
                            </Button>
                          </form>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={team.active ? `Desativar ${team.name}` : `Reativar ${team.name}`}
                            onClick={() => execute(
                              () => setAdminTeamActive({
                                churchSlug,
                                churchId,
                                teamId: team.id,
                                active: !team.active,
                              }),
                              team.active ? "Time desativado" : "Time reativado",
                            )}
                          >
                            {team.active ? <CircleOff className="size-4" /> : <RotateCcw className="size-4" />}
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Funções</p>
                          {teamFunctions.map((item) => (
                            <div key={item.id} className={`flex gap-2 ${item.active ? "" : "opacity-60"}`}>
                              <form
                                className="flex min-w-0 flex-1 gap-2"
                                action={(formData) => execute(
                                  () => updateAdminFunction({
                                    churchSlug,
                                    churchId,
                                    ministryId: ministry.id,
                                    teamId: team.id,
                                    functionId: item.id,
                                    name: formData.get("name"),
                                  }),
                                  "Função atualizada",
                                )}
                              >
                                <Input name="name" defaultValue={item.name} aria-label={`Nome da função ${item.name}`} required />
                                <Button type="submit" variant="outline" size="icon" disabled={pending} aria-label="Salvar função">
                                  <Save className="size-4" />
                                </Button>
                              </form>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={pending}
                                aria-label={item.active ? `Desativar ${item.name}` : `Reativar ${item.name}`}
                                onClick={() => execute(
                                  () => setAdminFunctionActive({
                                    churchSlug,
                                    churchId,
                                    functionId: item.id,
                                    active: !item.active,
                                  }),
                                  item.active ? "Função desativada" : "Função reativada",
                                )}
                              >
                                {item.active ? <CircleOff className="size-4" /> : <RotateCcw className="size-4" />}
                              </Button>
                            </div>
                          ))}
                          {teamFunctions.length === 0 && (
                            <p className="text-sm text-muted-foreground">Nenhuma função cadastrada.</p>
                          )}
                        </div>

                        <form
                          className="flex flex-col gap-2 sm:flex-row"
                          action={(formData) => {
                            const form = document.activeElement?.closest("form") as HTMLFormElement | null;
                            execute(
                              () => createAdminFunction({
                                churchSlug,
                                churchId,
                                ministryId: ministry.id,
                                teamId: team.id,
                                name: formData.get("name"),
                              }),
                              "Função criada",
                              form ?? undefined,
                            );
                          }}
                        >
                          <Input name="name" required placeholder="Nova função (ex.: Áudio, DM, Baixo)" />
                          <Button type="submit" variant="outline" disabled={pending}>
                            <Plus className="size-4" />
                            Adicionar função
                          </Button>
                        </form>
                      </div>
                    </details>
                  );
                })}

                <form
                  className="flex flex-col gap-2 rounded-xl border border-dashed p-3 sm:flex-row"
                  action={(formData) => {
                    const form = document.activeElement?.closest("form") as HTMLFormElement | null;
                    execute(
                      () => createAdminTeam({
                        churchSlug,
                        churchId,
                        ministryId: ministry.id,
                        name: formData.get("name"),
                      }),
                      "Time criado",
                      form ?? undefined,
                    );
                  }}
                >
                  <Input name="name" required placeholder="Novo time (ex.: Banda, MC, Recepção)" />
                  <Button type="submit" variant="outline" disabled={pending}>
                    <Plus className="size-4" />
                    Adicionar time
                  </Button>
                </form>
              </div>
            </section>
          );
        })}

        {ministries.length === 0 && (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <p className="font-medium">Nenhum ministério cadastrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie o primeiro ministério ou área para organizar seus times.
            </p>
          </div>
        )}
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Itens desativados deixam de aparecer nos novos fluxos, mas permanecem vinculados ao histórico de eventos e escalas.
      </p>
    </div>
  );
}
