"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  addEventResponsibility,
  removeAssignment,
  setAssignmentStatus,
} from "@/lib/actions/escalas";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export type EventResponsibilityRow = {
  id: string;
  user_id: string;
  full_name: string;
  role_name: string;
  status: string;
};

export type EventResponsibilityMember = {
  user_id: string;
  full_name: string;
};

const STATUS_OPTIONS = [
  "convidado",
  "confirmado",
  "ausente",
  "presente",
] as const;

export function EventResponsibilities({
  churchSlug,
  churchId,
  eventId,
  responsibilities,
  members,
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  responsibilities: EventResponsibilityRow[];
  members: EventResponsibilityMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");
  const [roleName, setRoleName] = useState("");

  function act(
    action: () => Promise<{ ok: boolean; error?: string } | void>,
    success?: string,
  ) {
    startTransition(async () => {
      const result = await action();
      if (result && !result.ok) {
        toast.error(result.error ?? "Não foi possível concluir");
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  }

  function add() {
    if (!userId) {
      toast.error("Escolha a pessoa");
      return;
    }
    if (roleName.trim().length < 2) {
      toast.error("Informe a responsabilidade");
      return;
    }
    act(
      () =>
        addEventResponsibility({
          churchSlug,
          churchId,
          eventId,
          userId,
          roleName,
        }),
      "Responsabilidade adicionada",
    );
    setUserId("");
    setRoleName("");
  }

  return (
    <div className="space-y-3">
      {responsibilities.map((responsibility) => (
        <div
          key={responsibility.id}
          className="grid gap-3 rounded-2xl border px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{responsibility.full_name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {responsibility.role_name}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {canManage ? (
              <Select
                value={responsibility.status}
                disabled={pending}
                onChange={(event) =>
                  act(() =>
                    setAssignmentStatus({
                      churchSlug,
                      eventId,
                      assignmentId: responsibility.id,
                      status: event.target.value,
                    }),
                  )
                }
                aria-label={`Status de ${responsibility.full_name}`}
                className="min-w-36 flex-1"
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {ASSIGNMENT_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge
                className={`border-0 ${ASSIGNMENT_STATUS_BADGE[responsibility.status] ?? ""}`}
              >
                {ASSIGNMENT_STATUS_LABELS[responsibility.status] ??
                  responsibility.status}
              </Badge>
            )}
            {canManage && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={pending}
                className="size-11 shrink-0 text-muted-foreground"
                aria-label={`Remover responsabilidade de ${responsibility.full_name}`}
                onClick={() =>
                  act(
                    () =>
                      removeAssignment({
                        churchSlug,
                        eventId,
                        assignmentId: responsibility.id,
                      }),
                    "Responsabilidade removida",
                  )
                }
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      ))}

      {responsibilities.length === 0 && (
        <p className="py-2 text-sm text-muted-foreground">
          Nenhuma responsabilidade direta definida.
        </p>
      )}

      {canManage && (
        <div className="grid gap-2 rounded-2xl border border-dashed p-4 sm:grid-cols-2">
          <Select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            aria-label="Pessoa responsável"
          >
            <option value="">Escolher pessoa…</option>
            {members.map((member) => (
              <option key={member.user_id} value={member.user_id}>
                {member.full_name}
              </option>
            ))}
          </Select>
          <Input
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
            placeholder="Responsabilidade (ex.: Pregador)"
            aria-label="Responsabilidade do evento"
          />
          <Button
            type="button"
            disabled={pending}
            onClick={add}
            className="sm:col-span-2"
          >
            <Plus className="size-4" aria-hidden="true" />
            Adicionar responsabilidade
          </Button>
        </div>
      )}
    </div>
  );
}
