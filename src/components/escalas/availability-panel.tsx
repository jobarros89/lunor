"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock3, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  clearMyAvailability,
  createAvailabilityRequest,
  setMyAvailability,
  type AvailabilityStatus,
} from "@/lib/actions/availability";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type AvailabilityEvent = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  context: string;
  myStatus: AvailabilityStatus | null;
  counts: {
    available: number;
    unavailable: number;
    notInformed: number;
  } | null;
};

export type AvailabilityRequestView = {
  id: string;
  title: string;
  respondByLabel: string | null;
  eventIds: string[];
};

const choices: Array<{
  status: AvailabilityStatus;
  label: string;
  icon: typeof Check;
  activeClass: string;
}> = [
  {
    status: "available",
    label: "Disponível",
    icon: Check,
    activeClass: "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600",
  },
  {
    status: "unavailable",
    label: "Não disponível",
    icon: X,
    activeClass: "border-rose-600 bg-rose-600 text-white hover:bg-rose-600",
  },
];

function AvailabilityChoice({
  churchSlug,
  churchId,
  ministryId,
  event,
  requestId,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  event: AvailabilityEvent;
  requestId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(status: AvailabilityStatus) {
    startTransition(async () => {
      const result = await setMyAvailability({
        churchSlug,
        churchId,
        ministryId,
        eventId: event.id,
        requestId: requestId ?? null,
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Disponibilidade salva");
      router.refresh();
    });
  }

  function clear() {
    startTransition(async () => {
      const result = await clearMyAvailability({
        churchSlug,
        churchId,
        ministryId,
        eventId: event.id,
        requestId: requestId ?? null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{event.title}</p>
          <p className="text-xs text-muted-foreground">
            {event.dateLabel} · {event.timeLabel}{event.context ? ` · ${event.context}` : ""}
          </p>
        </div>
        {event.myStatus && (
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Limpar resposta
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {choices.map(({ status, label, icon: Icon, activeClass }) => (
          <Button
            key={status}
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => choose(status)}
            className={cn(
              "h-11 rounded-xl px-2 text-xs sm:text-sm",
              event.myStatus === status && activeClass
            )}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>

      {event.counts && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{event.counts.available}</strong> disponíveis</span>
          <span><strong className="text-foreground">{event.counts.unavailable}</strong> não disponíveis</span>
          <span><strong className="text-foreground">{event.counts.notInformed}</strong> sem resposta</span>
        </div>
      )}
    </div>
  );
}

export function AvailabilityPanel({
  churchSlug,
  churchId,
  ministryId,
  ministryName,
  canManage,
  events,
  requests,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  ministryName: string;
  canManage: boolean;
  events: AvailabilityEvent[];
  requests: AvailabilityRequestView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const byId = new Map(events.map((event) => [event.id, event]));

  function toggleEvent(eventId: string) {
    setSelected((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId]
    );
  }

  function requestAvailability() {
    if (selected.length === 0) return toast.error("Selecione pelo menos um culto");
    startTransition(async () => {
      const result = await createAvailabilityRequest({
        churchSlug,
        churchId,
        ministryId,
        title: title.trim() || `Disponibilidade · ${ministryName}`,
        eventIds: selected,
        respondBy: deadline ? new Date(deadline).toISOString() : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Solicitação enviada para a equipe");
      setTitle("");
      setDeadline("");
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {requests.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Solicitações</h2>
            <p className="text-sm text-muted-foreground">Pedidos da liderança aguardando a disponibilidade da equipe.</p>
          </div>
          {requests.map((request) => {
            const requestEvents = request.eventIds.map((id) => byId.get(id)).filter(Boolean) as AvailabilityEvent[];
            if (requestEvents.length === 0) return null;
            return (
              <Card key={request.id} className="rounded-3xl">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <CardTitle className="text-base">{request.title}</CardTitle>
                    {request.respondByLabel && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock3 className="size-3" /> Até {request.respondByLabel}
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {requestEvents.map((event) => (
                    <AvailabilityChoice
                      key={event.id}
                      churchSlug={churchSlug}
                      churchId={churchId}
                      ministryId={ministryId}
                      event={event}
                      requestId={request.id}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Cultos já criados</h2>
          <p className="text-sm text-muted-foreground">
            A resposta específica de um culto prevalece sobre o calendário e sobre o padrão semanal.
          </p>
        </div>
        {events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <AvailabilityChoice
                key={event.id}
                churchSlug={churchSlug}
                churchId={churchId}
                ministryId={ministryId}
                event={event}
              />
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum culto futuro deste ministério. Você ainda pode informar datas no calendário acima.
            </CardContent>
          </Card>
        )}
      </section>

      {canManage && events.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg">Solicitar disponibilidade</CardTitle>
            <p className="text-sm text-muted-foreground">
              Escolha os cultos já criados. Os voluntários do {ministryName} receberão o pedido no LUNOR e, quando Push estiver ativo, também a notificação.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={`Ex.: Disponibilidade de setembro · ${ministryName}`}
                className="h-11 rounded-xl"
              />
              <Input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                className="h-11 rounded-xl"
                aria-label="Prazo para resposta"
              />
            </div>

            <div className="space-y-2">
              {events.map((event) => (
                <label
                  key={event.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
                    selected.includes(event.id) && "border-foreground bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(event.id)}
                    onChange={() => toggleEvent(event.id)}
                    className="mt-1 size-4"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{event.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {event.dateLabel} · {event.timeLabel}{event.context ? ` · ${event.context}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <Button
              type="button"
              disabled={pending || selected.length === 0}
              onClick={requestAvailability}
              className="h-11 w-full rounded-full sm:w-auto sm:px-6"
            >
              <Send className="size-4" />
              {pending ? "Enviando…" : `Solicitar de ${selected.length || ""} culto${selected.length === 1 ? "" : "s"}`}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
