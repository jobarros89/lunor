"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteFutureEvent } from "@/lib/actions/event-delete";
import { Button, buttonVariants } from "@/components/ui/button";

type DeleteContext = {
  churchSlug: string;
  churchId: string;
  eventId: string;
  eventTitle: string;
};

function ConfirmDeleteDialog({
  context,
  open,
  onOpenChange,
  redirectTo,
}: {
  context: DeleteContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteFutureEvent(context);
      if (!result.ok) {
        setError(result.error ?? "Não foi possível apagar o culto");
        return;
      }
      onOpenChange(false);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 backdrop-blur-[2px] sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onOpenChange(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`delete-event-title-${context.eventId}`}
        aria-describedby={`delete-event-description-${context.eventId}`}
        className="w-full max-w-md rounded-3xl border bg-background p-5 shadow-2xl"
      >
        <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Trash2 className="size-5" />
        </div>
        <h2 id={`delete-event-title-${context.eventId}`} className="mt-4 text-lg font-semibold">
          Apagar culto?
        </h2>
        <p id={`delete-event-description-${context.eventId}`} className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Você tem certeza que deseja apagar <strong className="font-medium text-foreground">{context.eventTitle}</strong>? Escalas, repertório e demais dados ligados a este culto também serão removidos.
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Não, manter
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 rounded-full"
            disabled={pending}
            onClick={confirmDelete}
          >
            {pending ? "Apagando…" : "Sim, apagar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function FutureEventLink({
  context,
  href,
  canDelete,
  children,
}: {
  context: DeleteContext;
  href: string;
  canDelete: boolean;
  children: ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const [confirming, setConfirming] = useState(false);

  function clearLongPress() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function startLongPress() {
    if (!canDelete) return;
    clearLongPress();
    suppressClick.current = false;
    timer.current = setTimeout(() => {
      suppressClick.current = true;
      setConfirming(true);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
    }, 650);
  }

  return (
    <>
      <Link
        href={href}
        className="block"
        onTouchStart={startLongPress}
        onTouchMove={clearLongPress}
        onTouchCancel={clearLongPress}
        onTouchEnd={clearLongPress}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }}
        onContextMenu={(event) => {
          if (canDelete && typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) {
            event.preventDefault();
          }
        }}
      >
        {children}
      </Link>
      <ConfirmDeleteDialog
        context={context}
        open={confirming}
        onOpenChange={setConfirming}
      />
    </>
  );
}

export function DeleteFutureEventButton({
  context,
  redirectTo,
}: {
  context: DeleteContext;
  redirectTo: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={`/${context.churchSlug}/escalas/${context.eventId}/editar`}
          className={buttonVariants({
            variant: "outline",
            className: "h-11 rounded-full px-5",
          })}
        >
          <Pencil className="size-4" />
          Editar data e horário
        </Link>
        <Button
          type="button"
          variant="destructive"
          className="h-11 rounded-full px-5"
          onClick={() => setConfirming(true)}
        >
          <Trash2 className="size-4" />
          Apagar culto
        </Button>
      </div>
      <ConfirmDeleteDialog
        context={context}
        open={confirming}
        onOpenChange={setConfirming}
        redirectTo={redirectTo}
      />
    </>
  );
}
