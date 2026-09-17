"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, MessageCircle, X } from "lucide-react";
import { respondToAssignment } from "@/lib/actions/assignment-response";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function QuickConfirm({
  churchSlug,
  churchId,
  eventId,
  assignmentId,
}: {
  churchSlug: string;
  churchId?: string;
  eventId: string;
  assignmentId: string;
}) {
  const [pending, startTransition] = useTransition();

  function respond(response: "confirmar" | "nao_posso" | "falar_lider") {
    startTransition(async () => {
      const result = await respondToAssignment({
        churchSlug,
        churchId,
        eventId,
        assignmentId,
        response,
      });
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }

      if (response === "confirmar") toast.success("Escala confirmada!");
      if (response === "nao_posso") toast.success("Líder avisado. Vamos buscar uma substituição.");
      if (response === "falar_lider") toast.success("Seu líder foi avisado.");
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-lg bg-primary px-4 text-[0.8rem] font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Salvando…" : "Responder"}
        {!pending && <ChevronDown className="size-3.5" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52 rounded-2xl p-1.5">
        <DropdownMenuItem onClick={() => respond("confirmar")} className="min-h-11 rounded-xl">
          <Check className="size-4" />
          Confirmo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => respond("nao_posso")} className="min-h-11 rounded-xl">
          <X className="size-4" />
          Não posso servir
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => respond("falar_lider")} className="min-h-11 rounded-xl">
          <MessageCircle className="size-4" />
          Falar com o líder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
