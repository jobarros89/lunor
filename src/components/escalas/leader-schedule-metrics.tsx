"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type LeaderScheduleEvent = {
  id: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  href: string;
  assignmentCount: number;
  confirmedCount: number;
  pendingCount: number;
};

export type LeaderSchedulePerson = {
  id: string;
  eventId: string;
  eventTitle: string;
  dateLabel: string;
  timeLabel: string;
  href: string;
  fullName: string;
  roleName: string;
  status: string;
  statusLabel: string;
};

type Panel = "events" | "invites" | "confirmed" | "pending" | null;

const PANELS: Record<Exclude<Panel, null>, { title: string; description: string }> = {
  events: {
    title: "Próximos eventos",
    description: "Cultos e eventos que podem receber uma escala deste ministério nos próximos 60 dias.",
  },
  invites: {
    title: "Pessoas na escala",
    description: "Quem foi escalado, em qual culto e com qual função.",
  },
  confirmed: {
    title: "Confirmados",
    description: "Pessoas que já confirmaram presença ou já estão marcadas como presentes.",
  },
  pending: {
    title: "Pendências",
    description: "Convites aguardando resposta e situações que exigem atenção da liderança.",
  },
};

export function LeaderScheduleMetrics({
  canManage,
  eventCount,
  inviteCount,
  confirmedCount,
  pendingCount,
  events,
  invites,
  confirmed,
  pending,
}: {
  canManage: boolean;
  eventCount: number;
  inviteCount: number;
  confirmedCount: number;
  pendingCount: number;
  events: LeaderScheduleEvent[];
  invites: LeaderSchedulePerson[];
  confirmed: LeaderSchedulePerson[];
  pending: LeaderSchedulePerson[];
}) {
  const [panel, setPanel] = useState<Panel>(null);

  const metrics = [
    { key: "events" as const, icon: CalendarCheck2, value: eventCount, label: "Próximos eventos" },
    { key: "invites" as const, icon: Users2, value: inviteCount, label: "Convites na escala" },
    { key: "confirmed" as const, icon: CheckCircle2, value: confirmedCount, label: "Confirmados" },
    { key: "pending" as const, icon: TriangleAlert, value: pendingCount, label: "Pendências" },
  ];

  return (
    <section className="space-y-3" aria-label="Métricas das próximas escalas">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            icon={metric.icon}
            value={metric.value}
            label={metric.label}
            interactive={canManage}
            expanded={panel === metric.key}
            onClick={canManage ? () => setPanel((current) => current === metric.key ? null : metric.key) : undefined}
          />
        ))}
      </div>

      {canManage && panel && (
        <div className="overflow-hidden rounded-3xl border bg-card/50">
          <div className="border-b px-4 py-4 sm:px-5">
            <p className="font-semibold">{PANELS[panel].title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{PANELS[panel].description}</p>
          </div>

          {panel === "events" ? (
            <EventList events={events} />
          ) : (
            <PeopleList
              people={panel === "invites" ? invites : panel === "confirmed" ? confirmed : pending}
              emptyMessage={
                panel === "pending"
                  ? "Nenhuma pendência neste período."
                  : panel === "confirmed"
                    ? "Ainda não há confirmações neste período."
                    : "Nenhuma pessoa escalada neste período."
              }
            />
          )}
        </div>
      )}

      {canManage && (
        <p className="px-1 text-xs text-muted-foreground">
          Toque em um indicador para ver os detalhes da equipe.
        </p>
      )}
    </section>
  );
}

function MetricCard({
  icon: Icon,
  value,
  label,
  interactive,
  expanded,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  value: number;
  label: string;
  interactive: boolean;
  expanded: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="size-4 shrink-0" />
          {label}
        </span>
        {interactive && (
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        )}
      </div>
      <p className="mt-8 text-left text-3xl font-semibold tracking-tight">{value}</p>
    </>
  );

  if (!interactive) {
    return <div className="rounded-3xl border bg-card px-5 py-5">{content}</div>;
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onClick}
      className={cn(
        "min-h-[134px] rounded-3xl border bg-card px-5 py-5 text-left transition",
        "hover:-translate-y-0.5 hover:border-foreground/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        expanded && "border-foreground/40 bg-accent/30"
      )}
    >
      {content}
    </button>
  );
}

function EventList({ events }: { events: LeaderScheduleEvent[] }) {
  if (events.length === 0) {
    return <p className="px-5 py-7 text-sm text-muted-foreground">Nenhum evento futuro neste período.</p>;
  }

  return (
    <div className="divide-y">
      {events.map((event) => (
        <Link
          key={event.id}
          href={event.href}
          className="grid gap-3 px-4 py-4 transition hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{event.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{event.dateLabel} · {event.timeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Badge variant="secondary" className="rounded-full">{event.assignmentCount} escalados</Badge>
            {event.confirmedCount > 0 && (
              <Badge className="rounded-full border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                {event.confirmedCount} confirmados
              </Badge>
            )}
            {event.pendingCount > 0 && (
              <Badge className="rounded-full border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {event.pendingCount} pendências
              </Badge>
            )}
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}

function PeopleList({
  people,
  emptyMessage,
}: {
  people: LeaderSchedulePerson[];
  emptyMessage: string;
}) {
  if (people.length === 0) {
    return <p className="px-5 py-7 text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="divide-y">
      {people.map((person) => (
        <Link
          key={person.id}
          href={person.href}
          className="grid gap-3 px-4 py-4 transition hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{person.fullName}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {person.roleName} · {person.eventTitle}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{person.dateLabel} · {person.timeLabel}</p>
          </div>
          <div className="flex items-center gap-2 sm:justify-end">
            <Badge variant="secondary" className="rounded-full">{person.statusLabel}</Badge>
            <ChevronRight className="size-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}
