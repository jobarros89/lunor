"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { deleteChurch } from "@/lib/actions/church";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DeleteChurchZone({
  churchId,
  churchName,
}: {
  churchId: string;
  churchName: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  const canDelete = confirm.trim() === churchName.trim();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteChurch({ churchId, confirmName: confirm });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-destructive">Apagar esta igreja</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Remove a igreja e <strong>todos os dados</strong> (pessoas,
            equipamentos, escalas, avaliações, histórico). Esta ação é
            permanente e não pode ser desfeita.
          </p>

          {!open ? (
            <Button
              variant="outline"
              className="mt-3 h-10 border-destructive/40 px-4 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setOpen(true)}
            >
              Apagar igreja…
            </Button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm">
                Para confirmar, digite o nome exato da igreja:{" "}
                <strong>{churchName}</strong>
              </p>
              <Input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={churchName}
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="h-10 flex-1"
                  onClick={() => {
                    setOpen(false);
                    setConfirm("");
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canDelete || pending}
                  onClick={onDelete}
                  className="h-10 flex-1"
                >
                  {pending ? "Apagando…" : "Apagar definitivamente"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
