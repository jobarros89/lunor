"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellRing, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PrintLabelButton } from "@/components/infantil/print-label-button";
import { checkOutChild } from "@/lib/actions/infantil";
import { chamarResponsavelSeguro } from "@/lib/actions/infantil-call";
import { checkInOrReenterChild } from "@/lib/actions/infantil-checkin";

export type Guardian = {
  id: string;
  name: string;
  phone: string | null;
  canPickup: boolean;
  relationship: string | null;
};
export type SessionChild = {
  id: string;
  fullName: string;
  age: string;
  allergies: string | null;
  specialNeeds: string | null;
  classId: string | null;
  className: string | null;
  checkin: { id: string; code: string; checkedOut: boolean } | null;
  guardians: Guardian[];
};

export function SessionChildRow({
  child,
  churchSlug,
  churchId,
  ministryId,
  eventId,
  eventTitle,
  eventContext,
  podeLiberar,
}: {
  child: SessionChild;
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
  eventTitle: string;
  eventContext: string;
  podeLiberar: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [retirando, setRetirando] = useState(false);
  const [guardianId, setGuardianId] = useState("");
  const [justificativa, setJustificativa] = useState("");

  const autorizados = child.guardians.filter((g) => g.canPickup);
  const escolhido = child.guardians.find((g) => g.id === guardianId);
  const precisaJustificar = !!escolhido && !escolhido.canPickup;

  function entrar() {
    startTransition(async () => {
      const r = await checkInOrReenterChild({
        churchSlug,
        churchId,
        ministryId,
        eventId,
        childId: child.id,
        classId: child.classId,
      });
      if (r.ok) {
        toast.success(
          child.checkin?.checkedOut
            ? `${child.fullName} entrou novamente`
            : `${child.fullName} entrou`
        );
      } else {
        toast.error(r.error);
      }
    });
  }

  function retirar() {
    if (!guardianId) return toast.error("Escolha quem está retirando");
    startTransition(async () => {
      const r = await checkOutChild({
        churchSlug,
        eventId,
        checkinId: child.checkin!.id,
        guardianId,
        overrideReason: justificativa,
      });
      if (r.ok) {
        toast.success(`${child.fullName} foi retirado(a)`);
        setRetirando(false);
        setGuardianId("");
        setJustificativa("");
      } else {
        toast.error(r.error);
      }
    });
  }

  function chamar() {
    startTransition(async () => {
      try {
        const r = await chamarResponsavelSeguro({
          churchSlug,
          churchId,
          ministryId,
          eventId,
          checkinId: child.checkin!.id,
          reason: "",
        });
        if (r.ok) {
          if (r.data.linkedAccountCount > 0) {
            toast.success(`Responsável chamado — código ${child.checkin!.code}`, {
              description: "O chamado foi registrado e enviado às contas LUNOR vinculadas.",
            });
          } else {
            toast.warning(`Chamado registrado — código ${child.checkin!.code}`, {
              description: "Nenhum responsável desta criança possui conta LUNOR vinculada para receber Push.",
            });
          }
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("O LUNOR foi atualizado. Recarregando para usar a versão mais recente…");
        window.setTimeout(() => window.location.reload(), 800);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{child.fullName}</p>
          <p className="text-xs text-muted-foreground">
            {child.age}{child.className ? ` · ${child.className}` : ""}
          </p>
        </div>
        {child.checkin ? (
          child.checkin.checkedOut ? (
            <Button
              disabled={pending}
              onClick={entrar}
              className="h-9 shrink-0 rounded-full px-4"
            >
              {pending ? "…" : "Check-in novamente"}
            </Button>
          ) : (
            <Badge className="shrink-0 rounded-full border-0 bg-emerald-100 text-emerald-800">
              Presente · {child.checkin.code}
            </Badge>
          )
        ) : (
          <Button
            disabled={pending}
            onClick={entrar}
            className="h-9 shrink-0 rounded-full px-4"
          >
            Check-in
          </Button>
        )}
      </div>

      {child.checkin?.checkedOut && (
        <p className="text-xs text-muted-foreground">
          Esta criança já saiu deste culto. Você pode fazer um novo check-in e gerar um novo código.
        </p>
      )}

      {child.guardians.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Responsável: {child.guardians[0].name}
          {child.guardians[0].phone ? ` · ${child.guardians[0].phone}` : ""}
        </p>
      )}

      {(child.allergies || child.specialNeeds) && (
        <div className="flex flex-wrap gap-2">
          {child.allergies && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
              <TriangleAlert className="size-3" />
              Alergia: {child.allergies}
            </span>
          )}
          {child.specialNeeds && (
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">
              {child.specialNeeds}
            </span>
          )}
        </div>
      )}

      {child.checkin && !child.checkin.checkedOut && (
        <div className="space-y-2">
          {!retirando ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <PrintLabelButton
                childName={child.fullName}
                className={child.className}
                code={child.checkin.code}
                eventTitle={eventTitle}
                eventContext={eventContext}
              />
              <Button
                variant="outline"
                disabled={pending}
                onClick={chamar}
                className="h-10 rounded-full"
              >
                <BellRing className="size-4" />
                Chamar
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setRetirando(true)}
                className="h-10 rounded-full"
              >
                Registrar retirada
              </Button>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl bg-muted/40 p-3">
              <p className="text-xs font-medium">Quem está retirando?</p>
              <select
                value={guardianId}
                onChange={(e) => setGuardianId(e.target.value)}
                className="h-11 w-full rounded-xl border bg-background px-3 text-base md:text-sm"
                aria-label="Responsável que está retirando"
              >
                <option value="">Escolher…</option>
                {autorizados.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                    {g.relationship ? ` (${g.relationship})` : ""}
                  </option>
                ))}
                {podeLiberar &&
                  child.guardians
                    .filter((g) => !g.canPickup)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} — NÃO autorizado
                      </option>
                    ))}
              </select>

              {autorizados.length === 0 && (
                <p className="text-xs text-amber-700">
                  Nenhum responsável autorizado cadastrado para esta criança.
                </p>
              )}

              {precisaJustificar && (
                <div className="space-y-1">
                  <Input
                    value={justificativa}
                    onChange={(e) => setJustificativa(e.target.value)}
                    placeholder="Justificativa da liberação excepcional"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-amber-700">
                    Retirada fora da lista: exige justificativa e fica registrada
                    com o seu nome.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  disabled={pending}
                  onClick={retirar}
                  className="h-10 flex-1 rounded-full"
                >
                  {pending ? "…" : "Confirmar"}
                </Button>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => setRetirando(false)}
                  className="h-10 rounded-full"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
