"use client";

import { Select } from "@/components/ui/select";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateTicket } from "@/lib/actions/manutencoes";
import { TICKET_STATUS_LABELS } from "@/lib/manutencoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TicketUpdate({
  churchSlug,
  ticketId,
  initial,
}: {
  churchSlug: string;
  ticketId: string;
  initial: {
    status: string;
    supplier: string;
    parts: string;
    costReais: number | null;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState(initial);
  const statusId = useId();
  const costId = useId();
  const supplierId = useId();
  const partsId = useId();

  function submit() {
    startTransition(async () => {
      const result = await updateTicket({ churchSlug, ticketId, ...v });
      if (result && !result.ok) toast.error(result.error);
      else toast.success("Chamado atualizado");
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={statusId}>Status</Label>
          <Select
            id={statusId}
            value={v.status}
            onChange={(e) => setV({ ...v, status: e.target.value })}
            className="w-full"
          >
            {Object.entries(TICKET_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={costId}>Custo (R$)</Label>
          <Input
            id={costId}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={v.costReais ?? ""}
            onChange={(e) =>
              setV({
                ...v,
                costReais: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={supplierId}>Fornecedor</Label>
          <Input
            id={supplierId}
            value={v.supplier}
            onChange={(e) => setV({ ...v, supplier: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={partsId}>Peças</Label>
          <Input
            id={partsId}
            value={v.parts}
            onChange={(e) => setV({ ...v, parts: e.target.value })}
          />
        </div>
      </div>
      <Button
        type="button"
        disabled={pending}
        onClick={submit}
        className="h-12 w-full text-base"
      >
        {pending ? "Salvando…" : "Salvar atualização"}
      </Button>
    </div>
  );
}
