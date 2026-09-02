"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, Clock3, Pencil, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  createAvailabilityRequest,
  submitMyAvailability,
  type AvailabilityStatus,
} from "@/lib/actions/availability";
import type { TeamMemberAvailability } from "@/lib/availability-overview";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type AvailabilityEvent = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  context: string;
  team: TeamMemberAvailability[] | null;
};

export type AvailabilityRequestView = {
  id: string;
  title: string;
  respondByLabel: string | null;
  eventIds: string[];
  responses: Record<string, AvailabilityStatus>;
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

const roleLabels: Record<string, string> = {
  gerente: "Gerente",
  lider: "Líder",
  instrutor: "Instrutor",
  voluntario: "Voluntário",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusLabel(status: AvailabilityStatus) {
  return status === "available" ? "Disponível" : "Não disponível";
}

function RequestResponseCard({
  churchSlug,
  churchId,
  ministryId,
  request,
  events,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  request: AvailabilityRequestView;
  events: AvailabilityEvent[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Record<string, AvailabilityStatus | null>>(() =>
    Object.fromEntries(events.map((event) => [event.id, request.responses[event.id] ?? null]))
  );
  const initiallyComplete = events.length > 0 && events.every((event) => saved[event.id]);
  const [editing, setEditing] = useState(!initiallyComplete);
  const [draft, setDraft] = useState<Record<string, AvailabilityStatus | null>>(() => ({
    ...saved,
  }));
  const allAnswered = events.length > 0 && events.every((event) => draft[event.id]);

  function choose(eventId: string, status: AvailabilityStatus) {
    setDraft((current) => ({ ...current, [eventId]: status }));
  }

  function edit() {
    setDraft({ ...saved });
    setEditing(true);
  }

  function cancel() {
    setDraft({ ...saved });
    setEditing(false);
  }

  function submit() {
    if (!allAnswered) {
      toast.error("Responda todos os cultos antes de enviar");
      return;
    }

    startTransition(async () => {
      const result = await submitMyAvailability({
        churchSlug,
        churchId,
        ministryId,
        requestId: request.id,
        responses: events.map((event) => ({
          eventId: event.id,
          status: draft[event.id] as AvailabilityStatus,
        })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setSaved({ ...draft });
      setEditing(false);
      toast.success("Disponibilidade enviada");
      router.refresh();
    });
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{request.title}</CardTitle>
            {request.respondByLabel && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3" /> Responder até {request.respondByLabel}
              </p>
            )}
          </div>
          {!editing && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" /> Enviada
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!editing ? (
          <>
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-3"
            >
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium">Disponibilidade enviada com sucesso</p>
                <p className="text-xs text-muted-foreground">
                  A liderança já pode considerar estas respostas ao montar a escala.
                </p>
              </div>
            </div>

            <div className="divide-y rounded-2xl border px-3">
              {events.map((event) => {
                const status = saved[event.id] as AvailabilityStatus;
                return (
                  <div key={event.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {event.dateLabel} · {event.timeLabel}{event.context ? ` · ${event.context}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                        status === "available"
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-500/12 text-rose-700 dark:text-rose-400"
                      )}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                );
              })}
            </div>

            <Button type="button" variant="outline" onClick={edit} className="h-10 rounded-full px-4">
              <Pencil className="size-3.5" /> Editar resposta
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-2">
              {events.map((event) => (
                <div key={event.id} className="rounded-2xl border p-3">
                  <div className="mb-3 min-w-0">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {event.dateLabel} · {event.timeLabel}{event.context ? ` · ${event.context}` : ""}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Disponibilidade para ${event.title}`}>
                    {choices.map(({ status, label, icon: Icon, activeClass }) => (
                      <Button
                        key={status}
                        type="button"
                        variant="outline"
                        aria-pressed={draft[event.id] === status}
                        disabled={pending}
                        onClick={() => choose(event.id, status)}
                        className={cn(
                          "h-11 rounded-xl px-2 text-xs sm:text-sm",
                          draft[event.id] === status && activeClass
                        )}
                      >
                        <Icon className="size-4" /> {label}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              {initiallyComplete && (
                <Button type="button" variant="ghost" disabled={pending} onClick={cancel} className="rounded-full">
                  Cancelar
                </Button>
              )}
              <div className="ml-auto w-full sm:w-auto">
                {!allAnswered && (
                  <p className="mb-2 text-center text-xs text-muted-foreground sm:text-right">
                    Responda todos os cultos para enviar.
                  </p>
                )}
                <Button
                  type="button"
                  disabled={pending || !allAnswered}
                  onClick={submit}
                  className="h-11 w-full rounded-full px-5 sm:w-auto"
                >
                  <Send className="size-4" />
                  {pending ? "Enviando…" : "Salvar e enviar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TeamStatusGroup({
  title,
  members,
  tone,
}: {
  title: string;
  members: TeamMemberAvailability[];
  tone: "available" | "unavailable" | "pending";
}) {
  return (
    <div className="min-w-0 rounded-2xl border p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-sm font-semibold",
            tone === "available" && "text-emerald-600 dark:text-emerald-400",
            tone === "unavailable" && "text-rose-600 dark:text-rose-400",
            tone === "pending" && "text-muted-foreground"
          )}
        >
          {title}
        </p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
          {members.length}
        </span>
      </div>

      {members.length > 0 ? (
        <div className="space-y-2">
          {members.map((member) => (
            <div key={member.userId} className="flex min-w-0 items-center gap-2">
              <Avatar className="size-8 shrink-0">
                <AvatarImage src={member.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">{initials(member.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {roleLabels[member.role] ?? member.role}
                  {member.status ? " · Resposta enviada" : " · Não informou"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum voluntário</p>
      )}
    </div>
  );
}

function TeamAvailabilityCard({ event }: { event: AvailabilityEvent }) {
  const team = event.team ?? [];
  const available = team.filter((member) => member.status === "available");
  const unavailable = team.filter((member) => member.status === "unavailable");
  const unanswered = team.filter((member) => member.status === null);

  return (
    <Card className="rounded-3xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{event.title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {event.dateLabel} · {event.timeLabel}{event.context ? ` · ${event.context}` : ""}
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 lg:grid-cols-3">
        <TeamStatusGroup title="Disponíveis" members={available} tone="available" />
        <TeamStatusGroup title="Não disponíveis" members={unavailable} tone="unavailable" />
        <TeamStatusGroup title="Não responderam" members={unanswered} tone="pending" />
      </CardContent>
    </Card>
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
  const requestedIds = new Set(requests.flatMap((request) => request.eventIds));
  const requestedEvents = events.filter((event) => requestedIds.has(event.id));
  const requestableEvents = events.filter((event) => !requestedIds.has(event.id));

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
    <div className="space-y-8">
      {canManage && (
        <section className="space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Equipe · {ministryName}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Respostas para montar a escala</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Apenas respostas enviadas para cultos solicitados. Quem não respondeu permanece separado.
            </p>
          </div>

          {requestedEvents.length > 0 ? (
            <div className="space-y-3">
              {requestedEvents.map((event) => (
                <TeamAvailabilityCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <Card className="rounded-3xl">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhuma solicitação enviada para a equipe deste ministério.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      <section className={cn("space-y-3", canManage && "border-t pt-7")}>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Área pessoal
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Minha disponibilidade</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preencha todos os dias solicitados e envie sua resposta para a liderança.
          </p>
        </div>

        {requests.length > 0 ? (
          <div className="space-y-3">
            {requests.map((request) => {
              const requestEvents = request.eventIds
                .map((id) => byId.get(id))
                .filter(Boolean) as AvailabilityEvent[];
              if (requestEvents.length === 0) return null;
              return (
                <RequestResponseCard
                  key={request.id}
                  churchSlug={churchSlug}
                  churchId={churchId}
                  ministryId={ministryId}
                  request={request}
                  events={requestEvents}
                />
              );
            })}
          </div>
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitação de disponibilidade no momento.
            </CardContent>
          </Card>
        )}
      </section>

      {canManage && (
        <Card className="rounded-3xl border-t">
          <CardHeader>
            <CardTitle className="text-lg">Solicitar disponibilidade</CardTitle>
            <p className="text-sm text-muted-foreground">
              Escolha cultos já criados. A equipe do {ministryName} responderá antes da montagem da escala.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {requestableEvents.length > 0 ? (
              <>
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
                  {requestableEvents.map((event) => (
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
                  {pending ? "Enviando…" : `Enviar solicitação${selected.length > 0 ? ` · ${selected.length}` : ""}`}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {events.length === 0
                  ? "Crie primeiro um culto ou uma escala para solicitar disponibilidade."
                  : "Todos os cultos futuros já possuem uma solicitação aberta."}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
