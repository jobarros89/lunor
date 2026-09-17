"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { addEventMinistry } from "@/lib/actions/escalas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

type MinistryOption = {
  id: string;
  name: string;
};

export function AddEventTeam({
  churchSlug,
  churchId,
  eventId,
  options,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  options: MinistryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ministryId, setMinistryId] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    if (!ministryId) return toast.error("Selecione uma área");
    startTransition(async () => {
      const result = await addEventMinistry({
        churchSlug,
        churchId,
        eventId,
        ministryId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Equipe adicionada ao culto");
      setMinistryId("");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" size="sm" disabled={options.length === 0}>
            <Plus className="size-4" />
            Adicionar equipe
          </Button>
        }
      />
      <DialogContent>
        <DialogTitle>Adicionar equipe ao culto</DialogTitle>
        <DialogDescription>
          Escolha uma área já cadastrada. Depois, em Abrir escala, você define o time, as funções e as pessoas.
        </DialogDescription>
        <div className="mt-5 space-y-4">
          <Select
            value={ministryId}
            onChange={(event) => setMinistryId(event.target.value)}
            aria-label="Ministério ou área"
          >
            <option value="">Selecione uma área</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </Select>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={pending || !ministryId} onClick={add}>
              {pending ? "Adicionando…" : "Adicionar equipe"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

