import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import {
  AvailabilityPanel,
  type AvailabilityEvent,
  type AvailabilityRequestView,
} from "@/components/escalas/availability-panel";
import {
  AvailabilityCalendar,
  type CalendarAvailabilityEntry,
  type RecurringAvailabilityEntry,
} from "@/components/disponibilidade/availability-calendar";
import type { AvailabilityPeriod, AvailabilityStatus } from "@/lib/actions/availability";
import {
  buildTeamAvailabilityOverview,
  type AvailabilityOverviewMember,
} from "@/lib/availability-overview";

export default async function DisponibilidadePage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const { active } = await getActiveMinistry(churchSlug);
  const supabase = await createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const initialMonth = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;

  const [calendarResult, recurringResult, eventResult, requestResult, campusResult] = await Promise.all([
    supabase
      .from("member_availability_calendar")
      .select("availability_date, period, status, campus_id")
      .eq("church_id", tenant.church.id)
      .eq("user_id", tenant.userId)
      .is("ministry_id", null)
      .gte("availability_date", initialMonth)
      .order("availability_date")
      .limit(500),
    supabase
      .from("member_availability_recurring")
      .select("weekday, period, status, campus_id")
      .eq("church_id", tenant.church.id)
      .eq("user_id", tenant.userId)
      .is("ministry_id", null)
      .order("weekday"),
    active
      ? supabase
          .from("events")
          .select("id, title, starts_at, location, campus_id, service_period, campuses(name)")
          .eq("church_id", tenant.church.id)
          .eq("ministry_id", active.id)
          .gte("starts_at", since.toISOString())
          .order("starts_at")
          .limit(40)
      : Promise.resolve({ data: [] }),
    active
      ? supabase
          .from("availability_requests")
          .select("id, title, respond_by, created_at")
          .eq("church_id", tenant.church.id)
          .eq("ministry_id", active.id)
          .is("closed_at", null)
          .order("created_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
    supabase
      .from("campuses")
      .select("id, name")
      .eq("church_id", tenant.church.id)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);

  const calendarEntries: CalendarAvailabilityEntry[] = (calendarResult.data ?? []).map((row) => ({
    date: row.availability_date,
    period: row.period as AvailabilityPeriod,
    status: row.status as AvailabilityStatus,
    campusId: row.campus_id,
  }));
  const recurringEntries: RecurringAvailabilityEntry[] = (recurringResult.data ?? []).map((row) => ({
    weekday: row.weekday,
    period: row.period as AvailabilityPeriod,
    status: row.status as AvailabilityStatus,
    campusId: row.campus_id,
  }));

  const eventRows = eventResult.data ?? [];
  const requestRows = requestResult.data ?? [];
  const eventIds = eventRows.map((event) => event.id);
  const requestIds = requestRows.map((request) => request.id);

  const [myResult, requestEventsResult, allResult, membersResult] = active
    ? await Promise.all([
        eventIds.length
          ? supabase
              .from("member_availability")
              .select("event_id, status")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .eq("user_id", tenant.userId)
              .in("event_id", eventIds)
          : Promise.resolve({ data: [] as Array<{ event_id: string; status: string }> }),
        requestIds.length && eventIds.length
          ? supabase
              .from("availability_request_events")
              .select("request_id, event_id")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .in("request_id", requestIds)
              .in("event_id", eventIds)
          : Promise.resolve({ data: [] as Array<{ request_id: string; event_id: string }> }),
        active.canManage && eventIds.length
          ? supabase
              .from("member_availability")
              .select("event_id, user_id, status")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .in("event_id", eventIds)
          : Promise.resolve({ data: [] as Array<{ event_id: string; user_id: string; status: string }> }),
        active.canManage
          ? supabase
              .from("ministry_members")
              .select("user_id, role, profiles!inner(full_name, avatar_url)")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .eq("active", true)
              .order("joined_at")
          : Promise.resolve({
              data: [] as Array<{
                user_id: string;
                role: string;
                profiles: { full_name: string; avatar_url: string | null };
              }>,
            }),
      ])
    : [
        { data: [] as Array<{ event_id: string; status: string }> },
        { data: [] as Array<{ request_id: string; event_id: string }> },
        { data: [] as Array<{ event_id: string; user_id: string; status: string }> },
        {
          data: [] as Array<{
            user_id: string;
            role: string;
            profiles: { full_name: string; avatar_url: string | null };
          }>,
        },
      ];

  const myByEvent = new Map(
    (myResult.data ?? []).map((row) => [row.event_id, row.status as AvailabilityStatus])
  );

  const teamMembers: AvailabilityOverviewMember[] = (membersResult.data ?? [])
    .map((row) => {
      const profile = row.profiles as unknown as {
        full_name: string;
        avatar_url: string | null;
      };
      return {
        userId: row.user_id,
        name: profile.full_name,
        avatarUrl: profile.avatar_url,
        role: row.role,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const teamUserIds = teamMembers.map((member) => member.userId);
  const finalEventDate = eventRows.at(-1)?.starts_at.slice(0, 10) ?? initialMonth;

  const [teamCalendarResult, teamRecurringResult] =
    active?.canManage && teamUserIds.length > 0 && eventIds.length > 0
      ? await Promise.all([
          supabase
            .from("member_availability_calendar")
            .select("user_id, ministry_id, campus_id, availability_date, period, status")
            .eq("church_id", tenant.church.id)
            .in("user_id", teamUserIds)
            .or(`ministry_id.is.null,ministry_id.eq.${active.id}`)
            .gte("availability_date", initialMonth)
            .lte("availability_date", finalEventDate)
            .limit(5000),
          supabase
            .from("member_availability_recurring")
            .select("user_id, ministry_id, campus_id, weekday, period, status")
            .eq("church_id", tenant.church.id)
            .in("user_id", teamUserIds)
            .or(`ministry_id.is.null,ministry_id.eq.${active.id}`)
            .limit(5000),
        ])
      : [
          {
            data: [] as Array<{
              user_id: string;
              ministry_id: string | null;
              campus_id: string | null;
              availability_date: string;
              period: string;
              status: string;
            }>,
          },
          {
            data: [] as Array<{
              user_id: string;
              ministry_id: string | null;
              campus_id: string | null;
              weekday: number;
              period: string;
              status: string;
            }>,
          },
        ];

  const teamByEvent = active?.canManage
    ? buildTeamAvailabilityOverview({
        ministryId: active.id,
        members: teamMembers,
        events: eventRows.map((event) => ({
          id: event.id,
          startsAt: event.starts_at,
          campusId: event.campus_id,
          servicePeriod: event.service_period,
        })),
        eventEntries: (allResult.data ?? []).map((row) => ({
          eventId: row.event_id,
          userId: row.user_id,
          status: row.status as AvailabilityStatus,
        })),
        calendarEntries: (teamCalendarResult.data ?? []).map((row) => ({
          userId: row.user_id,
          ministryId: row.ministry_id,
          campusId: row.campus_id,
          date: row.availability_date,
          period: row.period as AvailabilityPeriod,
          status: row.status as AvailabilityStatus,
        })),
        recurringEntries: (teamRecurringResult.data ?? []).map((row) => ({
          userId: row.user_id,
          ministryId: row.ministry_id,
          campusId: row.campus_id,
          weekday: row.weekday,
          period: row.period as AvailabilityPeriod,
          status: row.status as AvailabilityStatus,
        })),
      })
    : new Map();

  const events: AvailabilityEvent[] = eventRows.map((event) => {
    const campus = event.campuses as unknown as { name: string } | null;
    const team = active?.canManage ? teamByEvent.get(event.id) ?? [] : null;
    const available = team?.filter((member) => member.status === "available").length ?? 0;
    const unavailable = team?.filter((member) => member.status === "unavailable").length ?? 0;
    const notInformed = team?.filter((member) => member.status === null).length ?? 0;
    return {
      id: event.id,
      title: event.title,
      dateLabel: formatEventDate(event.starts_at),
      timeLabel: formatEventTime(event.starts_at),
      context: eventContextLabel({
        campusName: campus?.name,
        servicePeriod: event.service_period,
        fallbackLocation: event.location,
      }),
      myStatus: myByEvent.get(event.id) ?? null,
      counts: active?.canManage
        ? { available, unavailable, notInformed }
        : null,
      team,
    };
  });

  const eventIdsByRequest = new Map<string, string[]>();
  for (const row of requestEventsResult.data ?? []) {
    eventIdsByRequest.set(row.request_id, [
      ...(eventIdsByRequest.get(row.request_id) ?? []),
      row.event_id,
    ]);
  }

  const requests: AvailabilityRequestView[] = requestRows
    .map((request) => ({
      id: request.id,
      title: request.title,
      respondByLabel: request.respond_by
        ? new Date(request.respond_by).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
      eventIds: eventIdsByRequest.get(request.id) ?? [],
    }))
    .filter((request) => request.eventIds.length > 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {active?.canManage ? "Visão da liderança" : "Minha disponibilidade"}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {active?.canManage
            ? `Disponibilidade da equipe · ${active.name}`
            : "Disponibilidade geral"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {active?.canManage
            ? "Veja quem está disponível, quem não pode servir e quem ainda não respondeu antes de montar a escala."
            : "Organize seu calendário antes mesmo dos cultos serem criados. Depois, respostas específicas de um culto prevalecem sobre o padrão geral."}
        </p>
      </header>

      {!active?.canManage && (
        <AvailabilityCalendar
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          ministryId={null}
          scopeLabel="Geral da igreja"
          initialMonth={initialMonth}
          entries={calendarEntries}
          recurring={recurringEntries}
          campuses={campusResult.data ?? []}
        />
      )}

      {active && (
        <section className="space-y-4">
          <AvailabilityPanel
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            ministryId={active.id}
            ministryName={active.name}
            canManage={active.canManage}
            events={events}
            requests={requests}
          />
        </section>
      )}

      {active?.canManage && (
        <section className="space-y-5 border-t pt-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Área pessoal
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Minha disponibilidade geral</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Informe também quando você pode servir. Essa área não altera a disponibilidade dos voluntários.
            </p>
          </div>
          <AvailabilityCalendar
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            ministryId={null}
            scopeLabel="Geral da igreja"
            initialMonth={initialMonth}
            entries={calendarEntries}
            recurring={recurringEntries}
            campuses={campusResult.data ?? []}
          />
        </section>
      )}
    </div>
  );
}
