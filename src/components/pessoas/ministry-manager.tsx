"use client";

import { Select } from "@/components/ui/select";

import { useTransition } from "react";
import { toast } from "sonner";
import { removeFromMinistry, setMinistryRole } from "@/lib/actions/pessoas";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Ministry = { id: string; name: string };
type Membership = { ministry_id: string; role: string };

const ROLES = [
  { value: "voluntario", label: "Voluntário" },
  { value: "instrutor", label: "Instrutor" },
  { value: "lider", label: "Líder" },
  { value: "gerente", label: "Gerente" },
] as const;

export function MinistryManager({
  churchSlug,
  churchId,
  userId,
  ministries,
  memberships,
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  userId: string;
  ministries: Ministry[];
  memberships: Membership[];
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string } | void>) {
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok) toast.error(result.error ?? "Erro");
    });
  }

  if (ministries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum ministério criado ainda.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {ministries.map((min) => {
        const membership = memberships.find((m) => m.ministry_id === min.id);
        return (
          <div
            key={min.id}
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          >
            <p className="min-w-0 flex-1 truncate font-medium">{min.name}</p>
            {canManage ? (
              <div className="flex items-center gap-2">
                <Select
                  value={membership?.role ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    e.target.value &&
                    act(() =>
                      setMinistryRole({
                        churchSlug,
                        churchId,
                        ministryId: min.id,
                        userId,
                        role: e.target.value,
                      })
                    )
                  }
                  className="text-base md:text-sm"
                  aria-label={`Papel em ${min.name}`}
                >
                  <option value="">Fora do ministério</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
                {membership && (
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    className="size-9 text-muted-foreground"
                    aria-label={`Remover de ${min.name}`}
                    onClick={() =>
                      act(() =>
                        removeFromMinistry({
                          churchSlug,
                          churchId,
                          ministryId: min.id,
                          userId,
                        })
                      )
                    }
                  >
                    <X className="size-4" />
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {ROLES.find((r) => r.value === membership?.role)?.label ?? "—"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
