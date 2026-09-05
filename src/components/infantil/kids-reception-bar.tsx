"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { DoorClosed, DoorOpen, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  closeKidsReception,
  openStandaloneKidsReception,
} from "@/lib/actions/kids-reception";

type ActiveReception = {
  sessionId: string;
  title: string;
  eventId: string | null;
  openedAt: string;
};

export function KidsReceptionBar({
  churchSlug,
  churchId,
  ministryId,
  canManageReception,
  activeReception,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  canManageReception: boolean;
  activeReception: ActiveReception | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!activeReception) {
    if (!canManageReception) return null;

    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-3">
        <div>
          <p className="text-sm font-medium">Recepção Kids fechada</p>
          <p className="text-xs text-muted-foreground">
            Abra quando a equipe estiver pronta. Não precisa existir um culto vinculado.
          </p>
        </div>
        <Button
          type="button"
          disabled={pending}
          className="rounded-full"
          onClick={() =>
            startTransition(async () => {
              const result = await openStandaloneKidsReception({
                churchSlug,
                churchId,
                ministryId,
                title: "Recepção Kids",
              });
              if (!result.ok) {
                toast.error(result.error);
                router.refresh();
                return;
              }
              toast.success("Recepção Kids aberta");
              router.push(`/${churchSlug}/infantil/recepcao/${result.data.sessionId}`);
              router.refresh();
            })
          }
        >
          <DoorOpen className="size-4" />
          {pending ? "Abrindo…" : "Abrir recepção"}
        </Button>
      </div>
    );
  }

  const href = activeReception.eventId
    ? `/${churchSlug}/infantil/sessao/${activeReception.eventId}`
    : `/${churchSlug}/infantil/recepcao/${activeReception.sessionId}`;

  const openedAt = new Date(activeReception.openedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-emerald-500/5 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
          Recepção aberta
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {activeReception.title} · aberta às {openedAt}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="rounded-full"
          render={<Link href={href} />}
        >
          <ExternalLink className="size-4" />
          Entrar na recepção
        </Button>

        {canManageReception && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending}
            className="rounded-full"
            onClick={() => {
              if (!window.confirm("Encerrar a recepção do Kids? Depois disso novos check-ins ficam bloqueados.")) return;
              startTransition(async () => {
                const result = await closeKidsReception({
                  churchSlug,
                  churchId,
                  ministryId,
                  sessionId: activeReception.sessionId,
                });
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Recepção Kids encerrada");
                router.push(`/${churchSlug}/infantil`);
                router.refresh();
              });
            }}
          >
            <DoorClosed className="size-4" />
            {pending ? "Encerrando…" : "Encerrar recepção"}
          </Button>
        )}
      </div>
    </div>
  );
}
