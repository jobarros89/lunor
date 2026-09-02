"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { saveMinistryServiceWindow } from "@/lib/actions/service-window";
import { timeLabel } from "@/lib/service-window";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

type WindowData = {
  arrival_at: string | null;
  release_at: string | null;
  notes: string | null;
} | null;

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MinistryServiceWindowCard({
  churchSlug,
  churchId,
  eventId,
  ministryId,
  ministryName,
  eventStartsAt,
  eventEndsAt,
  window,
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  ministryId: string;
  ministryName: string;
  eventStartsAt: string;
  eventEndsAt: string | null;
  window: WindowData;
  canManage: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [arrivalAt, setArrivalAt] = useState(toLocalInput(window?.arrival_at));
  const [releaseAt, setReleaseAt] = useState(toLocalInput(window?.release_at));
  const [notes, setNotes] = useState(window?.notes ?? "");

  const eventRange = useMemo(() => {
    const start = timeLabel(eventStartsAt);
    const end = timeLabel(eventEndsAt);
    return end ? `${start} – ${end}` : start;
  }, [eventStartsAt, eventEndsAt]);
  const teamRange = useMemo(() => {
    const arrival = timeLabel(window?.arrival_at);
    const release = timeLabel(window?.release_at);
    if (!arrival && !release) return "Segue o horário do culto";
    if (arrival && release) return `Chegada ${arrival} · Saída ${release}`;
    if (arrival) return `Chegada ${arrival}`;
    return `Saída ${release}`;
  }, [window?.arrival_at, window?.release_at]);

  function save() {
    startTransition(async () => {
      const result = await saveMinistryServiceWindow({
        churchSlug,
        churchId,
        eventId,
        ministryId,
        arrivalAt,
        releaseAt,
        notes,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(arrivalAt || releaseAt || notes.trim() ? "Horários da equipe salvos" : "Horários da equipe removidos");
    });
  }

  return (
    <Card className="rounded-3xl border-foreground/10">
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5" />
          <CardTitle className="text-base">Horários da equipe</CardTitle>
        </div>
        <CardDescription>
          O culto continua com seu horário real. {ministryName} pode ter uma janela própria de chegada e saída.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Culto</p>
            <p className="mt-1 font-medium">{eventRange}</p>
          </div>
          <div className="rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ministryName}</p>
            <p className="mt-1 font-medium">{teamRange}</p>
          </div>
        </div>

        {canManage && (
          <div className="space-y-3 border-t pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Chegada da equipe">
                <Input
                  type="datetime-local"
                  value={arrivalAt}
                  onChange={(event) => setArrivalAt(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </Field>
              <Field label="Saída prevista da equipe">
                <Input
                  type="datetime-local"
                  value={releaseAt}
                  onChange={(event) => setReleaseAt(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </Field>
            </div>
            <Field label="Observação de horário">
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ex.: passagem às 09:15; equipe liberada após desmontagem"
                maxLength={1000}
                className="h-11 rounded-xl"
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Deixe os dois horários vazios para a equipe herdar o horário do culto.
              </p>
              <Button type="button" onClick={save} disabled={pending} className="h-11 rounded-full px-5">
                {pending ? "Salvando…" : "Salvar horários"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
