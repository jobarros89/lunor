import Link from "next/link";
import { ChevronRight, Clock3 } from "lucide-react";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { ASSIGNMENT_STATUS_LABELS, formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { timeLabel } from "@/lib/service-window";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadError } from "@/components/shell/load-error";
import {
  LeaderScheduleMetrics,
  type LeaderScheduleEvent,
  type LeaderSchedulePerson,
} from "@/components/escalas/leader-schedule-metrics";

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  service_period: string | null;
  campuses: { name: string } | { name: string }[] | null;
  event_types: { name: string } | { name: string }[] | null;
};

type AssignmentRow = {
  id: string;
  event_id: string;
  user_id: string;
  role_name: string;
  status: string;
  profiles: { full_name: string } | { full_name: string }[] | null;
};

type ServiceWindowRow = {
  event_id: string;
  arrival_at: string | null;
  release_at: string | null;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function isConfirmed(status: string) {
  return status === "confirmado" || status === "presente";
}

function needsAttention(status: string) {
  return status === "substituicao_solicitada" || status === "falar_lider" || status === "ausente";
}

function isPending(status: string) {
  return status === "convidado" || needsAttention(status);
}

export async function MinistryScheduleList({
  churchSlug,
  ministryId,
  ministryName,
  detailBaseHref,
}: {
  churchSlug: string;
  ministryId: string;
  ministryName: string;
  detailBaseHref: string;
}) {
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();
  let canManage = tenant.isCoord;

  if (!tenant.isCoord) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("id, role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministryId)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();
    if (!membership) redirect(`/${churchSlug}`);
    canManage = membership.role === "gerente" || membership.role === "lider";
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const until = new Date(since.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [
    { data: events, error: eventsError },
    { data: assignments, error: assignmentsError },
    { data: serviceWindows, error: serviceWindowsError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, location, service_period, campuses(name), event_types(name)")
      .eq("church_id", tenant.church.id)
      .gte("starts_at", since.toISOString())
      .lte("starts_at", until.toISOString())
      .order("starts_at")
      .limit(30),
    supabase
      .from("assignments")
      .select("id, event_id, user_id, role_name, status, profiles!assignments_user_id_fkey(full_name), events!inner(starts_at)")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministryId)
      .gte("events.starts_at", since.toISOString())
      .lte("events.starts_at", until.toISOString()),
    supabase
      .from("event_ministry_windows")
      .select("event_id, arrival_at, release_at, events!inner(starts_at)")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministryId)
      .gte("events.starts_at", since.toISOString())
      .lte("events.starts_at", until.toISOString()),
  ]);

  if (eventsError) console.error(`${ministryName}: eventos da escala`, eventsError);
  if (assignmentsError) console.error(`${ministryName}: assignments da escala`, assignmentsError);
  if (serviceWindowsError) console.error(`${ministryName}: horários da equipe`, serviceWindowsError);

  const eventRows = (events ?? []) as unknown as EventRow[];
  const assignmentRows = (assignments ?? []) as unknown as AssignmentRow[];
  const windowRows = (serviceWindows ?? []) as unknown as ServiceWindowRow[];
  const byEvent = new Map<string, AssignmentRow[]>();
  const eventById = new Map(eventRows.map((event) => [event.id, event]));
  const windowByEvent = new Map(windowRows.map((window) => [window.event_id, window]));
  for (const assignment of assignmentRows) {
    byEvent.set(assignment.event_id, [...(byEvent.get(assignment.event_id) ?? []), assignment]);
  }

  const confirmedRows = assignmentRows.filter((item) => isConfirmed(item.status));
  const pendingRows = assignmentRows.filter((item) => isPending(item.status));
  const confirmed = confirmedRows.length;
  const waiting = assignmentRows.filter((item) => item.status === "convidado").length;
  const attention = assignmentRows.filter((item) => needsAttention(item.status)).length;

  const leaderEvents: LeaderScheduleEvent[] = eventRows.map((event) => {
    const eventAssignments = byEvent.get(event.id) ?? [];
    return {
      id: event.id,
      title: event.title,
      dateLabel: formatEventDate(event.starts_at),
      timeLabel: formatEventTime(event.starts_at),
      href: `${detailBaseHref}/${event.id}`,
      assignmentCount: eventAssignments.length,
      confirmedCount: eventAssignments.filter((item) => isConfirmed(item.status)).length,
      pendingCount: eventAssignments.filter((item) => isPending(item.status)).length,
    };
  });

  function toLeaderPerson(assignment: AssignmentRow): LeaderSchedulePerson {
    const event = eventById.get(assignment.event_id);
    return {
      id: assignment.id,
      eventId: assignment.event_id,
      eventTitle: event?.title ?? "Evento",
      dateLabel: event ? formatEventDate(event.starts_at) : "—",
      timeLabel: event ? formatEventTime(event.starts_at) : "—",
      href: `${detailBaseHref}/${assignment.event_id}`,
      fullName: firstRelated(assignment.profiles)?.full_name ?? "Voluntário",
      roleName: assignment.role_name,
      status: assignment.status,
      statusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status,
    };
  }

  // Nomes da equipe só são serializados para o painel interativo quando o usuário
  // realmente possui papel de liderança/gestão neste ministério.
  const leaderInvites = canManage ? assignmentRows.map(toLeaderPerson) : [];
  const leaderConfirmed = canManage ? confirmedRows.map(toLeaderPerson) : [];
  const leaderPending = canManage ? pendingRows.map(toLeaderPerson) : [];

  return (
    <div className="space-y-6">
      <LeaderScheduleMetrics
        canManage={canManage}
        eventCount={eventRows.length}
        inviteCount={assignmentRows.length}
        confirmedCount={confirmed}
        pendingCount={waiting + attention}
        events={leaderEvents}
        invites={leaderInvites}
        confirmed={leaderConfirmed}
        pending={leaderPending}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 border-b pb-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Próximas escalas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Equipe de {ministryName} nos cultos e eventos dos próximos 60 dias.
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{eventRows.length} eventos</span>
        </div>

        {eventsError || assignmentsError || serviceWindowsError ? (
          <LoadError oQue={`as escalas de ${ministryName}`} />
        ) : (
          <div className="divide-y">
            {eventRows.map((event) => {
              const eventAssignments = byEvent.get(event.id) ?? [];
              const serviceWindow = windowByEvent.get(event.id);
              const eventConfirmed = eventAssignments.filter((item) => isConfirmed(item.status)).length;
              const eventWaiting = eventAssignments.filter((item) => item.status === "convidado").length;
              const eventAttention = eventAssignments.filter((item) => needsAttention(item.status)).length;
              const mine = eventAssignments.filter((item) => item.user_id === tenant.userId);
              const campus = firstRelated(event.campuses);
              const type = firstRelated(event.event_types);
              const context = eventContextLabel({
                campusName: campus?.name,
                servicePeriod: event.service_period,
                fallbackLocation: event.location,
              });
              const arrival = timeLabel(serviceWindow?.arrival_at);
              const release = timeLabel(serviceWindow?.release_at);

              return (
                <Link
                  key={event.id}
                  href={`${detailBaseHref}/${event.id}`}
                  className="grid gap-3 py-4 transition hover:opacity-70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                      <span>{formatEventDate(event.starts_at)}</span>
                      {arrival ? (
                        <span className="inline-flex items-center gap-1 font-medium text-foreground">
                          <Clock3 className="size-3.5" />Chegada {arrival}{release ? ` · saída ${release}` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />Culto {formatEventTime(event.starts_at)}</span>
                      )}
                      {arrival && <span>· Culto {formatEventTime(event.starts_at)}</span>}
                      {(type?.name || context) && <span>· {[type?.name, context].filter(Boolean).join(" · ")}</span>}
                    </p>
                    {mine.length > 0 && (
                      <p className="mt-2 text-xs font-medium text-foreground">
                        Você: {mine.map((item) => item.role_name).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <Badge variant="secondary" >{eventAssignments.length} escalados</Badge>
                    {eventConfirmed > 0 && <Badge className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{eventConfirmed} confirmados</Badge>}
                    {eventWaiting > 0 && <Badge className="border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">{eventWaiting} aguardando</Badge>}
                    {eventAttention > 0 && <Badge className="border-0 bg-purple-500/15 text-purple-700 dark:text-purple-400">{eventAttention} atenção</Badge>}
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </div>
                </Link>
              );
            })}
            {eventRows.length === 0 && (
              <Card className="my-4">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum culto ou evento nos próximos 60 dias.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
