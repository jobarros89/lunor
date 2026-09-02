"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Link2, Send, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  linkGuardianAccount,
  unlinkGuardianAccount,
} from "@/lib/actions/guardian-account";
import { createGuardianInvite } from "@/lib/actions/guardian-family";

type Guardian = {
  id: string;
  fullName: string;
  userId: string | null;
};

type Account = {
  id: string;
  fullName: string;
};

export function GuardianAccountLink({
  churchSlug,
  churchId,
  ministryId,
  guardians,
  accounts,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  guardians: Guardian[];
  accounts: Account[];
}) {
  const router = useRouter();
  const [guardianId, setGuardianId] = useState("");
  const [userId, setUserId] = useState("");
  const [pending, startTransition] = useTransition();
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});

  const unlinked = useMemo(
    () => guardians.filter((guardian) => !guardian.userId),
    [guardians]
  );
  const linked = useMemo(
    () => guardians.filter((guardian) => !!guardian.userId),
    [guardians]
  );
  const accountName = new Map(accounts.map((account) => [account.id, account.fullName]));

  function link() {
    if (!guardianId || !userId) {
      toast.error("Selecione o responsável e a conta LUNOR");
      return;
    }

    startTransition(async () => {
      const result = await linkGuardianAccount({
        churchSlug,
        churchId,
        ministryId,
        guardianId,
        userId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conta vinculada ao responsável");
      setGuardianId("");
      setUserId("");
      router.refresh();
    });
  }

  function createInvite(guardian: Guardian) {
    startTransition(async () => {
      const result = await createGuardianInvite({
        churchSlug,
        guardianId: guardian.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setInviteUrls((current) => ({ ...current, [guardian.id]: result.data.url }));
      try {
        await navigator.clipboard.writeText(result.data.url);
        toast.success("Convite familiar copiado");
      } catch {
        toast.success("Convite familiar criado");
      }
    });
  }

  function unlink(guardian: Guardian) {
    startTransition(async () => {
      const result = await unlinkGuardianAccount({
        churchSlug,
        churchId,
        ministryId,
        guardianId: guardian.id,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Vínculo removido");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {unlinked.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select
            value={guardianId}
            onChange={(event) => setGuardianId(event.target.value)}
            disabled={pending}
            className="h-11 rounded-xl border bg-background px-3 text-sm"
            aria-label="Responsável"
          >
            <option value="">Selecione o responsável</option>
            {unlinked.map((guardian) => (
              <option key={guardian.id} value={guardian.id}>
                {guardian.fullName}
              </option>
            ))}
          </select>

          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={pending}
            className="h-11 rounded-xl border bg-background px-3 text-sm"
            aria-label="Conta LUNOR"
          >
            <option value="">Selecione a conta LUNOR</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.fullName}
              </option>
            ))}
          </select>

          <Button
            type="button"
            disabled={pending || !guardianId || !userId}
            onClick={link}
            className="h-11 rounded-full px-5"
          >
            <Link2 className="size-4" />
            Vincular
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Todos os responsáveis cadastrados já estão vinculados a uma conta LUNOR.
        </p>
      )}

      {unlinked.length > 0 && (
        <div className="space-y-2 rounded-2xl border p-4">
          <div>
            <p className="text-sm font-medium">Acesso da família</p>
            <p className="text-xs text-muted-foreground">
              O convite cria uma conta restrita somente às crianças vinculadas ao responsável.
            </p>
          </div>
          {unlinked.map((guardian) => (
            <div key={guardian.id} className="space-y-2 rounded-xl bg-muted/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{guardian.fullName}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => createInvite(guardian)}
                  className="rounded-full"
                >
                  <Send className="size-4" />
                  Gerar convite
                </Button>
              </div>
              {inviteUrls[guardian.id] && (
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={inviteUrls[guardian.id]}
                    className="h-10 min-w-0 flex-1 rounded-xl border bg-background px-3 text-xs"
                    aria-label={`Convite de ${guardian.fullName}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-10 rounded-full"
                    onClick={() => navigator.clipboard.writeText(inviteUrls[guardian.id])}
                    aria-label="Copiar convite"
                  >
                    <Copy className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {linked.length > 0 && (
        <div className="space-y-2">
          {linked.map((guardian) => (
            <div
              key={guardian.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium">{guardian.fullName}</p>
                <p className="text-xs text-muted-foreground">
                  Conta: {accountName.get(guardian.userId ?? "") ?? "Conta vinculada"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => unlink(guardian)}
                className="rounded-full"
              >
                <Unlink className="size-4" />
                Desvincular
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

