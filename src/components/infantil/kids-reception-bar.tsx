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
      <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
            Recepção fechada
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Abra quando a equipe estiver pronta.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          disabled={pending}
          className="h-9 shrink-0 rounded-full px-4"
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
          {pending ? "Abrindo…" : "Abrir"}
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
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            Recepção aberta
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {activeReception.title} · desde {openedAt}
          </p>
        </div>

        <Button
          nativeButton={false}
          variant="outline"
          size="sm"
          className="h-9 shrink-0 rounded-full px-3"
          render={<Link href={href} />}
        >
          <ExternalLink className="size-4" />
          Entrar
        </Button>
      </div>

      {canManageReception && (
        <div className="mt-3 border-t pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="h-8 rounded-full px-2 text-xs text-destructive hover:text-destructive"
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
            <DoorClosed className="size-3.5" />
            {pending ? "Encerrando…" : "Encerrar recepção"}
          </Button>
        </div>
      )}
    </div>
  );
}
