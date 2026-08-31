"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, X } from "lucide-react";
import {
  addAssignment,
  getAssignmentServingContext,
  linkEquipment,
  removeAssignment,
  setAssignmentStatus,
  unlinkEquipment,
} from "@/lib/actions/escalas";
import { resolveSubstitution } from "@/lib/actions/substitution";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Member = {
  user_id: string;
  full_name: string;
  cargaMes: number;
  indisponivel: boolean;
  aptidoes: string[];
  interesses: string[];
};
type Equipment = { id: string; name: string };
type ServingArea = { id: string; name: string };
type AssignmentServingArea = {
  id: string;
  department_id: string | null;
  department_name: string | null;
};
export type AssignmentRow = {
  id: string;
  user_id: string;
  full_name: string;
  role_name: string;
  status: string;
  equipments: { id: string; name: string }[];
};

type Suggestion = Member & {
  score: number;
  reason: string;
};

const LEADER_STATUS_OPTIONS = [
  "convidado",
  "confirmado",
  "substituicao_solicitada",
  "ausente",
  "presente",
] as const;

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesRole(values: string[], roleName: string) {
  const role = normalize(roleName);
  return values.some((value) => {
    const candidate = normalize(value);
    return role.includes(candidate) || candidate.includes(role);
  });
}

export function AssignmentManager({
  churchSlug,
  churchId,
  ministryId,
  eventId,
  assignments,
  members,
  equipments,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
  assignments: AssignmentRow[];
  members: Member[];
  equipments: Equipment[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [servingAreas, setServingAreas] = useState<ServingArea[]>([]);
  const [assignmentAreas, setAssignmentAreas] = useState<AssignmentServingArea[]>([]);

  useEffect(() => {
    let active = true;
    getAssignmentServingContext({ churchId, ministryId, eventId }).then((result) => {
      if (!active || !result.ok) return;
      setServingAreas(result.data.departments);
      setAssignmentAreas(result.data.assignments);
    });
    return () => {
      active = false;
    };
  }, [churchId, ministryId, eventId, assignments]);

  function act(fn: () => Promise<{ ok: boolean; error?: string; data?: unknown } | void>, success?: string) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) {
        toast.error(result.error ?? "Erro");
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function escalar() {
    if (!userId) return toast.error("Escolha a pessoa");
    if (servingAreas.length > 0 && !departmentId)
      return toast.error("Escolha onde a pessoa vai servir");
    if (roleName.length < 2) return toast.error("Informe a função (ex.: Guitarra)");
    act(
      () =>
        addAssignment({
          churchSlug,
          churchId,
          ministryId,
          eventId,
          userId,
          departmentId: departmentId || null,
          roleName,
        }),
      "Pessoa escalada"
    );
    setUserId("");
    setDepartmentId("");
    setRoleName("");
  }

  function suggestionsForRole(role: string, excludedUserId?: string): Suggestion[] {
    const alreadyAssigned = new Set(
      assignments
        .filter((item) => item.status !== "substituido")
        .map((item) => item.user_id)
    );

    return members
      .filter((member) =>
        member.user_id !== excludedUserId &&
        !member.indisponivel &&
        !alreadyAssigned.has(member.user_id)
      )
      .map((member) => {
        const skillMatch = matchesRole(member.aptidoes, role);
        const interestMatch = matchesRole(member.interesses, role);
        const score = 100 - member.cargaMes * 10 + (skillMatch ? 35 : 0) + (interestMatch ? 15 : 0);
        const reasons: string[] = [];
        if (skillMatch) reasons.push("aptidão compatível");
        else if (interestMatch) reasons.push("tem interesse nessa função");
        reasons.push(member.cargaMes === 0 ? "ainda não serviu no mês" : `${member.cargaMes} escala${member.cargaMes === 1 ? "" : "s"} no mês`);
        return { ...member, score, reason: reasons.join(" · ") };
      })
      .sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name, "pt-BR"))
      .slice(0, 3);
  }

  function suggestionsFor(assignment: AssignmentRow): Suggestion[] {
    return suggestionsForRole(assignment.role_name, assignment.user_id);
  }

  const selectCls = "h-11 rounded-xl border bg-background px-3 text-base md:text-sm";
  const selecionado = members.find((m) => m.user_id === userId);
  const newAssignmentSuggestions = roleName.trim().length >= 2
    ? suggestionsForRole(roleName)
    : [];

  const confirmados = assignments.filter((a) => a.status === "confirmado").length;
  const aguardando = assignments.filter((a) => a.status === "convidado").length;
  const trocas = assignments.filter((a) => a.status === "substituicao_solicitada").length;
  const conversas = assignments.filter((a) => a.status === "falar_lider").length;

  return (
    <div className="space-y-4">
      {assignments.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            {confirmados} confirmado{confirmados === 1 ? "" : "s"}
          </span>
          {aguardando > 0 && <span className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-700 dark:text-amber-400">{aguardando} aguardando</span>}
          {trocas > 0 && <span className="rounded-full bg-purple-500/15 px-3 py-1 font-medium text-purple-700 dark:text-purple-400">{trocas} precisam de substituição</span>}
          {conversas > 0 && <span className="rounded-full bg-sky-500/15 px-3 py-1 font-medium text-sky-700 dark:text-sky-400">{conversas} querem falar</span>}
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((a) => {
          const suggestions = a.status === "substituicao_solicitada" ? suggestionsFor(a) : [];
          const statusIsManual = LEADER_STATUS_OPTIONS.includes(a.status as (typeof LEADER_STATUS_OPTIONS)[number]);
          const servingArea = assignmentAreas.find((item) => item.id === a.id)?.department_name;

          return (
            <div key={a.id} className="space-y-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {servingArea ? `${servingArea} · ` : ""}{a.role_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[a.status] ?? ""}`}>
                    {ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    className="size-11 rounded-full text-muted-foreground"
                    aria-label={`Remover ${a.full_name}`}
                    onClick={() => act(() => removeAssignment({ churchSlug, eventId, assignmentId: a.id }))}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>

              {a.status === "substituicao_solicitada" && (
                <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
                    <p className="text-sm font-medium">Sugestões para substituir</p>
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {suggestions.map((candidate, index) => (
                        <div key={candidate.user_id} className="flex items-center gap-3 rounded-xl bg-background p-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{candidate.full_name}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{candidate.reason}</p>
                          </div>
                          <Button
                            size="sm"
                            disabled={pending}
                            className="rounded-full"
                            onClick={() => act(
                              () => resolveSubstitution({
                                churchSlug,
                                eventId,
                                assignmentId: a.id,
                                replacementUserId: candidate.user_id,
                              }),
                              `${candidate.full_name} foi chamado para substituir`
                            )}
                          >
                            Chamar
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Nenhuma pessoa disponível desta equipe sem conflito neste culto.</p>
                  )}
                </div>
              )}

              {a.status !== "substituido" && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {a.equipments.map((eq) => (
                    <button
                      key={eq.id}
                      type="button"
                      disabled={pending}
                      title="Remover equipamento"
                      onClick={() => act(() => unlinkEquipment({ churchSlug, churchId, eventId, assignmentId: a.id, equipmentId: eq.id }))}
                      className="rounded-full bg-muted px-3 py-2 text-xs font-medium hover:bg-muted/70"
                    >
                      {eq.name} ×
                    </button>
                  ))}
                  <select
                    value=""
                    disabled={pending}
                    onChange={(e) => e.target.value && act(() => linkEquipment({ churchSlug, churchId, eventId, assignmentId: a.id, equipmentId: e.target.value }))}
                    className="h-9 rounded-full border bg-background px-3 text-sm"
                    aria-label={`Vincular equipamento a ${a.full_name}`}
                  >
                    <option value="">+ equipamento</option>
                    {equipments.filter((eq) => !a.equipments.some((x) => x.id === eq.id)).map((eq) => <option key={eq.id} value={eq.id}>{eq.name}</option>)}
                  </select>
                </div>
              )}

              {a.status !== "substituido" && (
                <select
                  value={a.status}
                  disabled={pending}
                  onChange={(e) => act(() => setAssignmentStatus({ churchSlug, eventId, assignmentId: a.id, status: e.target.value }))}
                  className={selectCls}
                  aria-label={`Status de ${a.full_name}`}
                >
                  {!statusIsManual && <option value={a.status}>{ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}</option>}
                  {LEADER_STATUS_OPTIONS.map((value) => <option key={value} value={value}>{ASSIGNMENT_STATUS_LABELS[value]}</option>)}
                </select>
              )}
            </div>
          );
        })}
        {assignments.length === 0 && <p className="text-sm text-muted-foreground">Ninguém escalado ainda.</p>}
      </div>

      <div className="space-y-3 rounded-2xl border border-dashed p-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
          <p className="text-sm font-medium">Escalar pessoa</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className={selectCls} aria-label="Escolher pessoa">
            <option value="">Escolher pessoa…</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}{m.indisponivel ? " · indisponível" : ""}{m.cargaMes > 0 ? ` · ${m.cargaMes}× no mês` : ""}
              </option>
            ))}
          </select>
          {servingAreas.length > 0 && (
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={selectCls}
              aria-label="Onde vai servir?"
            >
              <option value="">Onde vai servir?</option>
              {servingAreas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          )}
          <Input value={roleName} onChange={(e) => setRoleName(e.target.value)} placeholder="Função (ex.: Guitarra)" className="h-11 rounded-xl" />
          <Button disabled={pending} className="h-11 rounded-full px-5" onClick={escalar}>Escalar</Button>
        </div>

        {roleName.trim().length >= 2 && !userId && (
          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
              <div>
                <p className="text-sm font-medium">Sugestões LUNOR</p>
                <p className="text-xs text-muted-foreground">Com base em aptidão, interesse, disponibilidade e carga deste mês.</p>
              </div>
            </div>
            {newAssignmentSuggestions.length > 0 ? (
              <div className="mt-3 space-y-2">
                {newAssignmentSuggestions.map((candidate, index) => (
                  <div key={candidate.user_id} className="flex items-center gap-3 rounded-xl bg-background p-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{candidate.full_name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{candidate.reason}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setUserId(candidate.user_id)}
                    >
                      Selecionar
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Nenhuma pessoa disponível desta equipe para sugerir nesta função.</p>
            )}
          </div>
        )}

        {selecionado && (
          <div className="space-y-2 rounded-2xl bg-muted/40 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-background px-2.5 py-0.5 font-medium">{selecionado.cargaMes}× este mês</span>
              {selecionado.indisponivel && <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 font-medium text-red-700 dark:text-red-400">Indisponível nesta data</span>}
            </div>
            <div><span className="text-muted-foreground">Sabe: </span>{selecionado.aptidoes.length > 0 ? selecionado.aptidoes.join(", ") : <span className="text-muted-foreground">nenhuma aptidão</span>}</div>
            <div><span className="text-muted-foreground">Quer: </span>{selecionado.interesses.length > 0 ? selecionado.interesses.join(", ") : <span className="text-muted-foreground">—</span>}</div>
          </div>
        )}
      </div>
    </div>
  );
}
