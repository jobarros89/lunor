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
          .select("id, title, starts_at, location, service_period, campuses(name)")
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
              .select("user_id", { count: "exact", head: true })
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .eq("active", true)
          : Promise.resolve({ count: null }),
      ])
    : [
        { data: [] as Array<{ event_id: string; status: string }> },
        { data: [] as Array<{ request_id: string; event_id: string }> },
        { data: [] as Array<{ event_id: string; user_id: string; status: string }> },
        { count: null },
      ];

  const myByEvent = new Map(
    (myResult.data ?? []).map((row) => [row.event_id, row.status as AvailabilityStatus])
  );
  const totalMembers = membersResult.count ?? 0;
  const countsByEvent = new Map<
    string,
    { available: number; unavailable: number; informed: Set<string> }
  >();

  for (const row of allResult.data ?? []) {
    const current = countsByEvent.get(row.event_id) ?? {
      available: 0,
      unavailable: 0,
      informed: new Set<string>(),
    };
    if (row.status === "available") current.available++;
    if (row.status === "unavailable") current.unavailable++;
    current.informed.add(row.user_id);
    countsByEvent.set(row.event_id, current);
  }

  const events: AvailabilityEvent[] = eventRows.map((event) => {
    const campus = event.campuses as unknown as { name: string } | null;
    const counts = countsByEvent.get(event.id);
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
      counts:
        active?.canManage && counts
          ? {
              available: counts.available,
              unavailable: counts.unavailable,
              notInformed: Math.max(0, totalMembers - counts.informed.size),
            }
          : active?.canManage
            ? { available: 0, unavailable: 0, notInformed: totalMembers }
            : null,
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
          Minha disponibilidade
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Disponibilidade geral</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Organize seu calendário antes mesmo dos cultos serem criados. Depois, respostas específicas de um culto prevalecem sobre o padrão geral.
        </p>
      </header>

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

      {active && (
        <section className="space-y-4 border-t pt-7">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{active.name}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Disponibilidade por culto</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Para cultos já criados, sua resposta aqui é a regra mais específica.
            </p>
          </div>
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
    </div>
  );
}
