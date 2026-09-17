"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarOff, Plus, X } from "lucide-react";
import {
  addUnavailability,
  removeUnavailability,
} from "@/lib/actions/disponibilidade";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Periodo = {
  id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

function formatDate(iso: string): string {
  // iso = "2026-08-01" → "01/08/2026"
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function UnavailabilityManager({
  churchSlug,
  churchId,
  periodos,
}: {
  churchSlug: string;
  churchId: string;
  periodos: Periodo[];
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");

  function add() {
    if (!start) return toast.error("Escolha a data de início");
    const fim = end || start; // dia único = fim igual ao início
    startTransition(async () => {
      const r = await addUnavailability({
        churchSlug,
        churchId,
        startDate: start,
        endDate: fim,
        reason,
      });
      if (r && !r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Período adicionado");
      setOpen(false);
      setStart("");
      setEnd("");
      setReason("");
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await removeUnavailability({ churchSlug, id });
      if (r && !r.ok) toast.error(r.error);
    });
  }

  return (
    <div className="space-y-3">
      {periodos.length === 0 && !open && (
        <p className="text-sm text-muted-foreground">
          Nenhum período marcado. Avise quando não puder servir — o líder vê
          isso ao montar a escala.
        </p>
      )}

      {periodos.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
        >
          <div className="min-w-0">
            <p className="font-medium">
              {formatDate(p.start_date)}
              {p.end_date !== p.start_date && ` — ${formatDate(p.end_date)}`}
            </p>
            {p.reason && (
              <p className="truncate text-sm text-muted-foreground">
                {p.reason}
              </p>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            disabled={pending}
            onClick={() => remove(p.id)}
            aria-label="Remover período"
            className="size-11 shrink-0 text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}

      {open ? (
        <div className="space-y-2 rounded-2xl border border-dashed p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">De</span>
              <Input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Até (opcional)</span>
              <Input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </div>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo (opcional) — ex.: viagem"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              disabled={pending}
              onClick={add}
              className="flex-1"
            >
              Salvar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() => setOpen(true)}
          className="w-full"
        >
          <Plus className="size-4" />
          Marcar indisponibilidade
        </Button>
      )}
    </div>
  );
}

export { CalendarOff };
