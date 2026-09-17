"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { saveMinistryServiceWindow } from "@/lib/actions/service-window";
import { timeLabel, toWallTimeInput } from "@/lib/service-window";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

type WindowData = {
  arrival_at: string | null;
  release_at: string | null;
  notes: string | null;
} | null;

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
  const [arrivalAt, setArrivalAt] = useState(toWallTimeInput(window?.arrival_at));
  const [releaseAt, setReleaseAt] = useState(toWallTimeInput(window?.release_at));
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
      const result = await saveMinistryServiceWindow({ churchSlug, churchId, eventId, ministryId, arrivalAt, releaseAt, notes });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(arrivalAt || releaseAt || notes.trim() ? "Horários da equipe salvos" : "Horários da equipe removidos");
    });
  }

  return (
    <Card className="min-w-0 max-w-full overflow-hidden border-foreground/10">
      <CardHeader className="min-w-0 space-y-2 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5 shrink-0" />
          <CardTitle className="text-base">Horários da equipe</CardTitle>
        </div>
        <CardDescription className="break-words">
          O culto continua com seu horário real. {ministryName} pode ter uma janela própria de chegada e saída.
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 max-w-full space-y-4 px-4 sm:px-6">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <div className="min-w-0 rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Culto</p>
            <p className="mt-1 break-words font-medium">{eventRange}</p>
          </div>
          <div className="min-w-0 rounded-2xl border bg-muted/20 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ministryName}</p>
            <p className="mt-1 break-words font-medium">{teamRange}</p>
          </div>
        </div>

        {canManage && (
          <div className="min-w-0 space-y-3 border-t pt-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Field label="Chegada da equipe">
                <Input type="datetime-local" value={arrivalAt} onChange={(event) => setArrivalAt(event.target.value)} className="w-full min-w-0 max-w-full" />
              </Field>
              <Field label="Saída prevista da equipe">
                <Input type="datetime-local" value={releaseAt} onChange={(event) => setReleaseAt(event.target.value)} className="w-full min-w-0 max-w-full" />
              </Field>
            </div>
            <Field label="Observação de horário">
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: passagem às 09:15; equipe liberada após desmontagem" maxLength={1000} className="w-full min-w-0 max-w-full" />
            </Field>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-words text-xs text-muted-foreground">Deixe os dois horários vazios para a equipe herdar o horário do culto.</p>
              <Button type="button" onClick={save} disabled={pending} className="w-full px-5 sm:w-auto sm:shrink-0">
                {pending ? "Salvando…" : "Salvar horários"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
