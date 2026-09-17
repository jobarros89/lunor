"use client";

import { Select } from "@/components/ui/select";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { checkOutChild } from "@/lib/actions/infantil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PickupGuardian = {
  id: string;
  name: string;
  relationship: string | null;
  canPickup: boolean;
};

export function QrPickupConfirm({
  churchSlug,
  eventId,
  checkinId,
  guardians,
  canOverride,
}: {
  churchSlug: string;
  eventId: string;
  checkinId: string;
  guardians: PickupGuardian[];
  canOverride: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guardianId, setGuardianId] = useState("");
  const [reason, setReason] = useState("");
  const selected = guardians.find((guardian) => guardian.id === guardianId);
  const needsOverride = !!selected && !selected.canPickup;
  const authorized = guardians.filter((guardian) => guardian.canPickup);

  function confirm() {
    if (!guardianId) return toast.error("Selecione quem está retirando");
    if (needsOverride && reason.trim().length < 5) {
      return toast.error("Informe a justificativa da retirada excepcional");
    }

    startTransition(async () => {
      const result = await checkOutChild({
        churchSlug,
        eventId,
        checkinId,
        guardianId,
        overrideReason: reason,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Retirada confirmada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="pickup-guardian" className="text-xs font-medium">
          Quem está retirando?
        </label>
        <Select
          id="pickup-guardian"
          value={guardianId}
          onChange={(event) => setGuardianId(event.target.value)}
          className="mt-1 w-full text-base md:text-sm"
        >
          <option value="">Escolher responsável…</option>
          {authorized.map((guardian) => (
            <option key={guardian.id} value={guardian.id}>
              {guardian.name}{guardian.relationship ? ` (${guardian.relationship})` : ""}
            </option>
          ))}
          {canOverride &&
            guardians
              .filter((guardian) => !guardian.canPickup)
              .map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.name} — NÃO autorizado
                </option>
              ))}
        </Select>
      </div>

      {authorized.length === 0 && (
        <p className="text-xs text-amber-700">
          Nenhum responsável autorizado está cadastrado para esta criança.
        </p>
      )}

      {needsOverride && (
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Justificativa da liberação excepcional"
        />
      )}

      <Button
        type="button"
        onClick={confirm}
        disabled={pending}
        className="h-12 w-full"
      >
        <CheckCircle2 className="size-4" />
        {pending ? "Confirmando…" : "Confirmar retirada"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        O QR apenas localiza a criança. A autorização de retirada continua sendo validada no banco.
      </p>
    </div>
  );
}
