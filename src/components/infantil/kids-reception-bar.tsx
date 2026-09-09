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

type CampusOption = {
  id: string;
  name: string;
};

type ActiveReception = {
  sessionId: string;
  title: string;
  eventId: string | null;
  campusId: string | null;
  campusName: string | null;
  openedAt: string;
};

export function KidsReceptionBar({
  churchSlug,
  churchId,
  ministryId,
  canManageReception,
  campuses,
  activeReceptions,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  canManageReception: boolean;
  campuses: CampusOption[];
  activeReceptions: ActiveReception[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (campuses.length === 0 && activeReceptions.length === 0) {
    if (!canManageReception) return null;
    return (
      <div className="rounded-2xl border bg-card px-4 py-3">
        <p className="text-sm font-medium">Nenhum campus ativo</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Cadastre um campus na Administração antes de abrir a recepção do Kids.
        </p>
      </div>
    );
  }

  const byCampus = new Map(
    activeReceptions
      .filter((reception) => !!reception.campusId)
      .map((reception) => [reception.campusId!, reception])
  );
  const legacyReceptions = activeReceptions.filter((reception) => !reception.campusId);

  function openCampus(campus: CampusOption) {
    startTransition(async () => {
      const result = await openStandaloneKidsReception({
        churchSlug,
        churchId,
        ministryId,
        campusId: campus.id,
        title: "Recepção Kids",
      });
      if (!result.ok) {
        toast.error(result.error);
        router.refresh();
        return;
      }
      toast.success(`Recepção de ${campus.name} aberta`);
      router.push(`/${churchSlug}/infantil/recepcao/${result.data.sessionId}`);
      router.refresh();
    });
  }

  function closeReception(reception: ActiveReception) {
    if (
      !window.confirm(
        `Encerrar a recepção do Kids${reception.campusName ? ` de ${reception.campusName}` : ""}? Depois disso novos check-ins ficam bloqueados.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await closeKidsReception({
        churchSlug,
        churchId,
        ministryId,
        sessionId: reception.sessionId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Recepção Kids encerrada");
      router.push(`/${churchSlug}/infantil`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      {campuses.map((campus) => {
        const active = byCampus.get(campus.id) ?? null;
        if (!active && !canManageReception) return null;

        if (!active) {
          return (
            <div
              key={campus.id}
              className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="size-2 shrink-0 rounded-full bg-muted-foreground/40"
                    aria-hidden="true"
                  />
                  {campus.name} · recepção fechada
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Abra quando a equipe deste campus estiver pronta.
                </p>
              </div>

              <Button
                type="button"
                size="sm"
                disabled={pending}
                className="h-9 shrink-0 rounded-full px-4"
                onClick={() => openCampus(campus)}
              >
                <DoorOpen className="size-4" />
                {pending ? "Aguarde…" : "Abrir"}
              </Button>
            </div>
          );
        }

        const href = active.eventId
          ? `/${churchSlug}/infantil/sessao/${active.eventId}`
          : `/${churchSlug}/infantil/recepcao/${active.sessionId}`;
        const openedAt = new Date(active.openedAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <div key={campus.id} className="rounded-2xl border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  {campus.name} · recepção aberta
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {active.title} · desde {openedAt}
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
                  onClick={() => closeReception(active)}
                >
                  <DoorClosed className="size-3.5" />
                  {pending ? "Aguarde…" : "Encerrar recepção"}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {legacyReceptions.map((active) => {
        const href = active.eventId
          ? `/${churchSlug}/infantil/sessao/${active.eventId}`
          : `/${churchSlug}/infantil/recepcao/${active.sessionId}`;
        return (
          <div key={active.sessionId} className="rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-sm font-medium">Recepção antiga sem campus definido</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Encerre esta sessão e abra uma nova escolhendo o campus correto.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                nativeButton={false}
                variant="outline"
                size="sm"
                className="h-9 rounded-full px-3"
                render={<Link href={href} />}
              >
                <ExternalLink className="size-4" />
                Entrar
              </Button>
              {canManageReception && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => closeReception(active)}
                  className="h-9 rounded-full px-3 text-destructive hover:text-destructive"
                >
                  <DoorClosed className="size-4" />
                  Encerrar
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
