"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, RotateCcw, UserX } from "lucide-react";
import { setEventPresence } from "@/lib/actions/presence";
import { ASSIGNMENT_STATUS_BADGE, ASSIGNMENT_STATUS_LABELS } from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type CultModeAssignment = {
  id: string;
  name: string;
  role: string;
  ministry: string;
  status: string;
  checkedInAt: string | null;
};

export function CultModeTeam({
  churchSlug,
  eventId,
  assignments,
  canManage,
}: {
  churchSlug: string;
  eventId: string;
  assignments: CultModeAssignment[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function update(assignmentId: string, presence: "presente" | "ausente" | "limpar") {
    startTransition(async () => {
      const result = await setEventPresence({ churchSlug, eventId, assignmentId, presence });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  const ministries = new Map<string, CultModeAssignment[]>();
  for (const assignment of assignments) {
    ministries.set(assignment.ministry, [...(ministries.get(assignment.ministry) ?? []), assignment]);
  }

  return (
    <div className="space-y-6">
      {[...ministries.entries()].map(([ministry, rows]) => (
        <section key={ministry}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{ministry}</h3>
            <span className="text-xs text-muted-foreground">{rows.filter((row) => row.status === "presente").length}/{rows.length} chegaram</span>
          </div>
          <div className="divide-y border-y border-foreground/15">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{row.name}</p>
                    <Badge className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[row.status] ?? ""}`}>
                      {ASSIGNMENT_STATUS_LABELS[row.status] ?? row.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.role}
                    {row.checkedInAt ? ` · chegou ${new Date(row.checkedInAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </p>
                </div>

                {canManage && (
                  <div className="flex gap-2">
                    {row.status !== "presente" ? (
                      <Button size="sm" disabled={pending} onClick={() => update(row.id, "presente")} className="h-10 rounded-full px-4">
                        <Check className="size-4" />
                        Chegou
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled={pending} onClick={() => update(row.id, "limpar")} className="h-10 rounded-full px-4">
                        <RotateCcw className="size-4" />
                        Desfazer
                      </Button>
                    )}
                    {row.status !== "ausente" && row.status !== "presente" && (
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => update(row.id, "ausente")} className="h-10 rounded-full px-3 text-muted-foreground">
                        <UserX className="size-4" />
                        Ausente
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {assignments.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pessoa escalada para este culto.</p>}
    </div>
  );
}
