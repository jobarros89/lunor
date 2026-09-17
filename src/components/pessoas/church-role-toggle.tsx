"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { setChurchRole } from "@/lib/actions/pessoas";
import { cn } from "@/lib/utils";

type ChurchRole = "admin" | "coordenador" | "member";

const ROLES: { value: ChurchRole; label: string; desc: string }[] = [
  {
    value: "admin",
    label: "Administrador",
    desc: "Controle total da igreja, inclusive permissões, configurações e ações críticas.",
  },
  {
    value: "coordenador",
    label: "Gestor",
    desc: "Gerencia equipe e operação da igreja, sem acesso às configurações críticas.",
  },
  {
    value: "member",
    label: "Membro",
    desc: "Acesso normal às áreas e ministérios em que participa.",
  },
];

export function ChurchRoleToggle({
  churchSlug,
  churchId,
  userId,
  currentRole,
  isSelf,
}: {
  churchSlug: string;
  churchId: string;
  userId: string;
  currentRole: ChurchRole;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function setRole(role: ChurchRole) {
    if (role === currentRole) return;
    startTransition(async () => {
      const result = await setChurchRole({ churchSlug, churchId, userId, role });
      if (result && !result.ok) toast.error(result.error);
      else {
        const label = ROLES.find((item) => item.value === role)?.label ?? role;
        toast.success(`Permissão atualizada para ${label}`);
      }
    });
  }

  if (isSelf) {
    return (
      <div className="flex gap-3 rounded-2xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          Sua própria permissão fica protegida para evitar que a igreja fique sem administrador.
          Outro administrador pode alterar seu nível de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Escolha o nível de acesso desta pessoa. A alteração é aplicada imediatamente.
      </p>
      {ROLES.map((r) => {
        const active = r.value === currentRole;
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => setRole(r.value)}
            className={cn(
              "flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors disabled:opacity-60",
              active
                ? "border-brand bg-brand/10"
                : "border-border bg-background hover:border-brand/50 hover:bg-accent/30"
            )}
          >
            <span>
              <span className="block font-medium">{r.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {r.desc}
              </span>
            </span>
            {active && (
              <span className="shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground">
                Atual
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
