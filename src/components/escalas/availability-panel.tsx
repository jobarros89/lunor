"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronDown, Clock3, Pencil, Send, X } from "lucide-react";
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
  monthKey: string;
  monthLabel: string;
  serviceRoles: Record<string, string>;
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

const sourceLabels: Record<NonNullable<TeamMemberAvailability["source"]>, string> = {
  event: "Evento específico",
  ministry_calendar: "Calendário mensal",
  general_calendar: "Calendário geral",
  ministry_recurring: "Padrão do ministério",
  general_recurring: "Padrão geral",
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
  serviceRoles,
}: {
  title: string;
  members: TeamMemberAvailability[];
  tone: "available" | "unavailable" | "pending";
  serviceRoles: Record<string, string>;
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
                  {serviceRoles[member.userId] ?? "Função ainda não definida"}
                  {member.source ? ` · ${sourceLabels[member.source]}` : " · Não informou"}
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

function TeamAvailabilityCard({
  event,
  selected,
  selectionMode,
  onSelect,
}: {
  event: AvailabilityEvent;
  selected: boolean;
  selectionMode: boolean;
  onSelect: (eventId: string) => void;
}) {
  const team = event.team ?? [];
  const available = team.filter((member) => member.status === "available");
  const unavailable = team.filter((member) => member.status === "unavailable");
  const unanswered = team.filter((member) => member.status === null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  function startHold() {
    held.current = false;
    holdTimer.current = setTimeout(() => {
      held.current = true;
      onSelect(event.id);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(20);
      }
    }, 550);
  }

  function cancelHold() {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card transition-colors",
        selected && "border-emerald-500/70 bg-emerald-500/5"
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          aria-label={`${selected ? "Remover" : "Selecionar"} ${event.title}`}
          aria-pressed={selected}
          onClick={() => onSelect(event.id)}
          className="flex min-h-16 w-11 shrink-0 items-center justify-center rounded-l-2xl focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex size-5 items-center justify-center rounded-full border",
              selected && "border-emerald-500 bg-emerald-500 text-white"
            )}
          >
            {selected ? <Check className="size-3" /> : null}
          </span>
        </button>
        <details className="group min-w-0 flex-1">
      <summary
        className="flex min-h-16 cursor-pointer list-none items-center gap-3 py-3 pl-1 pr-4 [&::-webkit-details-marker]:hidden"
        onPointerDown={startHold}
        onPointerMove={cancelHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        onClick={(eventClick) => {
          if (held.current || selectionMode) {
            eventClick.preventDefault();
            if (!held.current) onSelect(event.id);
            held.current = false;
          }
        }}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{event.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {event.dateLabel} · {event.timeLabel}{event.context ? ` · ${event.context}` : ""}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-3 text-xs sm:flex">
          <span className="text-emerald-600 dark:text-emerald-400">{available.length} disponíveis</span>
          <span className="text-rose-600 dark:text-rose-400">{unavailable.length} não disponíveis</span>
          <span className="text-muted-foreground">{unanswered.length} pendentes</span>
        </span>
        <span className="flex shrink-0 gap-1 text-xs sm:hidden" aria-label={`${available.length} disponíveis, ${unavailable.length} não disponíveis e ${unanswered.length} pendentes`}>
          <span className="text-emerald-600 dark:text-emerald-400">{available.length}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-rose-600 dark:text-rose-400">{unavailable.length}</span>
          <span className="text-muted-foreground">· {unanswered.length}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="grid gap-3 border-t p-3 lg:grid-cols-3">
        <TeamStatusGroup title="Disponíveis" members={available} tone="available" serviceRoles={event.serviceRoles} />
        <TeamStatusGroup title="Não disponíveis" members={unavailable} tone="unavailable" serviceRoles={event.serviceRoles} />
        <TeamStatusGroup title="Não responderam" members={unanswered} tone="pending" serviceRoles={event.serviceRoles} />
      </div>
        </details>
      </div>
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
  const initialEventMonth =
    events[0]?.monthKey ?? new Date().toISOString().slice(0, 7);
  const [selected, setSelected] = useState<string[]>([]);
  const [teamMonth, setTeamMonth] = useState(initialEventMonth);
  const [requestMonth, setRequestMonth] = useState(initialEventMonth);
  const [requestOpen, setRequestOpen] = useState(false);
  const [openMonths, setOpenMonths] = useState<string[]>(() =>
    events[0]?.monthKey ? [events[0].monthKey] : []
  );
  const byId = new Map(events.map((event) => [event.id, event]));
  const requestedIds = new Set(requests.flatMap((request) => request.eventIds));
  const requestableEvents = events.filter((event) => !requestedIds.has(event.id));
  const filteredRequestableEvents = requestableEvents.filter(
    (event) => event.monthKey === requestMonth
  );
  const requestMonthLabel =
    events.find((event) => event.monthKey === requestMonth)?.monthLabel ??
    new Date(`${requestMonth}-01T12:00:00`).toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
  const groupedEvents = Object.entries(
    events.reduce<Record<string, { label: string; events: AvailabilityEvent[] }>>((groups, event) => {
      const group = groups[event.monthKey] ?? { label: event.monthLabel, events: [] };
      group.events.push(event);
      groups[event.monthKey] = group;
      return groups;
    }, {})
  );

  function toggleMonth(monthKey: string) {
    setOpenMonths((current) =>
      current.includes(monthKey)
        ? current.filter((key) => key !== monthKey)
        : [...current, monthKey]
    );
  }

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Equipe · {ministryName}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Disponibilidade para montar a escala</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                O calendário mensal aparece em cada evento. Uma resposta específica do evento tem prioridade.
              </p>
            </div>
            <label className="w-48 max-w-full shrink-0 self-start">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Mês e ano</span>
              <Input
                type="month"
                value={teamMonth}
                onChange={(event) => {
                  const month = event.target.value;
                  setTeamMonth(month);
                  setSelected([]);
                  setOpenMonths((current) =>
                    current.includes(month) ? current : [...current, month]
                  );
                }}
                className="h-11 rounded-xl"
                aria-label="Mês e ano da disponibilidade da equipe"
              />
            </label>
          </div>

          {events.length > 0 ? (
            <div className="space-y-3">
              <p className="px-1 text-xs text-muted-foreground sm:hidden">
                Toque no círculo ou segure um culto para selecionar.
              </p>
              {groupedEvents
                .filter(([monthKey]) => monthKey === teamMonth)
                .map(([monthKey, group]) => {
                const isOpen = openMonths.includes(monthKey);
                return (
                  <section key={monthKey} className="overflow-hidden rounded-3xl border bg-card/30">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => toggleMonth(monthKey)}
                      className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <span>
                        <span className="block font-semibold capitalize">{group.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {group.events.length} {group.events.length === 1 ? "culto" : "cultos"}
                        </span>
                      </span>
                      <ChevronDown className={cn("size-5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                    </button>
                    {isOpen ? (
                      <div className="space-y-2 border-t p-2">
                        {group.events.map((event) => (
                          <TeamAvailabilityCard
                            key={event.id}
                            event={event}
                            selected={selected.includes(event.id)}
                            selectionMode={selected.length > 0}
                            onSelect={toggleEvent}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                );
              })}
              {!groupedEvents.some(([monthKey]) => monthKey === teamMonth) ? (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhum culto encontrado neste mês.
                </div>
              ) : null}
              {selected.length > 0 ? (
                <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur md:bottom-4">
                  <p className="text-sm font-medium">
                    {selected.length} {selected.length === 1 ? "culto selecionado" : "cultos selecionados"}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => document.getElementById("availability-request-form")?.scrollIntoView({ behavior: "smooth" })}>
                      Solicitar
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Card className="rounded-3xl">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                Nenhum evento futuro criado para este ministério.
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {requests.length > 0 && (
        <section className={cn("space-y-3", canManage && "border-t pt-7")}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Eventos específicos
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Solicitações da liderança</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Responda cada evento. Esta resposta substitui a marcação mensal somente naquela data.
            </p>
          </div>

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
        </section>
      )}

      {canManage && (
        <section id="availability-request-form" className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Solicitar disponibilidade</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Escolha cultos já criados. A equipe do {ministryName} responderá antes da montagem da escala.
              </p>
            </div>
            <label className="w-48 max-w-full shrink-0 self-start">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Mês e ano</span>
              <Input
                type="month"
                value={requestMonth}
                onChange={(event) => {
                  setRequestMonth(event.target.value);
                  setSelected([]);
                  setRequestOpen(false);
                }}
                className="h-11 rounded-xl"
                aria-label="Mês e ano dos cultos para solicitar disponibilidade"
              />
            </label>
          </div>

          <div className="overflow-hidden rounded-3xl border bg-card/30">
            <button
              type="button"
              aria-expanded={requestOpen}
              onClick={() => setRequestOpen((current) => !current)}
              className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span>
                <span className="block font-semibold capitalize">{requestMonthLabel}</span>
                <span className="block text-xs text-muted-foreground">
                  {filteredRequestableEvents.length}{" "}
                  {filteredRequestableEvents.length === 1 ? "culto disponível" : "cultos disponíveis"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-5 text-muted-foreground transition-transform",
                  requestOpen && "rotate-180"
                )}
              />
            </button>

            {requestOpen ? (
              <div className="space-y-4 border-t p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={`Ex.: Disponibilidade de ${requestMonthLabel} · ${ministryName}`}
                    className="h-11 rounded-xl"
                    aria-label="Título da solicitação"
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
                  {filteredRequestableEvents.map((event) => (
                    <label
                      key={event.id}
                      className={cn(
                        "flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors",
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
                  {filteredRequestableEvents.length === 0 ? (
                    <p className="rounded-2xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                      {events.length === 0
                        ? "Crie primeiro um culto ou uma escala para solicitar disponibilidade."
                        : "Nenhum culto disponível para solicitação neste mês."}
                    </p>
                  ) : null}
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
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
