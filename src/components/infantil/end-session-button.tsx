"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DoorClosed, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { encerrarSessao } from "@/lib/actions/infantil";
import { closeKidsReceptionByEvent } from "@/lib/actions/kids-reception";

export function EndSessionButton({
  churchSlug,
  churchId,
  ministryId,
  eventId,
  presentes,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
  presentes: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmando, setConfirmando] = useState(false);

  if (presentes === 0) {
    return (
      <Button
        variant="outline"
        disabled={pending}
        className="w-full"
        onClick={() => {
          if (!window.confirm("Encerrar a recepção do Kids? Os responsáveis não poderão mais fazer check-in nesta sessão.")) return;
          startTransition(async () => {
            const r = await closeKidsReceptionByEvent({
              churchSlug,
              churchId,
              ministryId,
              eventId,
            });
            if (!r.ok) {
              toast.error(r.error);
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
    );
  }

  if (!confirmando) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setConfirmando(true)}
        >
          <Megaphone className="size-4" />
          Encerrar e avisar os responsáveis
        </Button>
        <p className="px-1 text-center text-xs text-muted-foreground">
          A recepção só pode ser encerrada depois que todas as crianças forem retiradas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-dashed p-4">
      <p className="text-sm">
        Avisar os responsáveis das{" "}
        <strong>
          {presentes} {presentes === 1 ? "criança" : "crianças"}
        </strong>{" "}
        que ainda estão na sala?
      </p>
      <div className="flex gap-2">
        <Button
          disabled={pending}
          className="h-10 flex-1"
          onClick={() =>
            startTransition(async () => {
              const r = await encerrarSessao({
                churchSlug,
                churchId,
                ministryId,
                eventId,
              });
              if (r.ok) {
                toast.success("Responsáveis avisados");
                setConfirmando(false);
              } else {
                toast.error(r.error);
              }
            })
          }
        >
          {pending ? "Avisando…" : "Avisar todos"}
        </Button>
        <Button
          variant="outline"
          disabled={pending}
          className="h-10"
          onClick={() => setConfirmando(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
