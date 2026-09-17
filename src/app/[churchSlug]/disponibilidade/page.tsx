import Link from "next/link";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import type { AvailabilityPeriod, AvailabilityStatus } from "@/lib/actions/availability";
import {
  AvailabilityPanel,
  type AvailabilityEvent,
  type AvailabilityRequestView,
} from "@/components/escalas/availability-panel";
import {
  AvailabilityCalendar,
  type CalendarAvailabilityEntry,
} from "@/components/disponibilidade/availability-calendar";
import {
  buildTeamAvailabilityOverview,
  type AvailabilityOverviewMember,
  type TeamMemberAvailability,
} from "@/lib/availability-overview";

export default async function DisponibilidadePage({
  params,
  searchParams,
}: {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<{ ministry?: string; module?: "louvor" | "kids"; view?: "mine" | "team" }>;
}) {
  const [{ churchSlug }, query] = await Promise.all([params, searchParams]);
  const tenant = await getTenant(churchSlug);
  const { options } = await getActiveMinistry(churchSlug);
  const active = query.ministry
    ? options.find((option) => option.id === query.ministry) ?? null
    : null;
  const supabase = await createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const initialMonth = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-01`;

  const [eventResult, requestResult, calendarResult, campusResult] = await Promise.all([
    active
      ? supabase
          .from("events")
          .select("id, title, starts_at, location, campus_id, service_period, campuses(name)")
          .eq("church_id", tenant.church.id)
          .or(`ministry_id.eq.${active.id},ministry_id.is.null`)
          .gte("starts_at", since.toISOString())
          .order("starts_at")
          .limit(200)
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
    active
      ? supabase
          .from("member_availability_calendar")
          .select("availability_date, period, status, campus_id")
          .eq("church_id", tenant.church.id)
          .eq("ministry_id", active.id)
          .eq("user_id", tenant.userId)
          .gte("availability_date", initialMonth)
          .order("availability_date")
          .limit(500)
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

  const eventRows = eventResult.data ?? [];
  const requestRows = requestResult.data ?? [];
  const eventIds = eventRows.map((event) => event.id);
  const requestIds = requestRows.map((request) => request.id);

  const [myResult, requestEventsResult, allResult, membersResult, assignmentsResult] = active
    ? await Promise.all([
        eventIds.length && requestIds.length
          ? supabase
              .from("member_availability")
              .select("request_id, event_id, status")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .eq("user_id", tenant.userId)
              .in("request_id", requestIds)
              .in("event_id", eventIds)
          : Promise.resolve({
              data: [] as Array<{ request_id: string; event_id: string; status: string }>,
            }),
        requestIds.length && eventIds.length
          ? supabase
              .from("availability_request_events")
              .select("request_id, event_id")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .in("request_id", requestIds)
              .in("event_id", eventIds)
          : Promise.resolve({ data: [] as Array<{ request_id: string; event_id: string }> }),
        active.canManage && eventIds.length && requestIds.length
          ? supabase
              .from("member_availability")
              .select("event_id, user_id, status")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .in("request_id", requestIds)
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
        active.canManage && eventIds.length
          ? supabase
              .from("assignments")
              .select("event_id, user_id, role_name")
              .eq("church_id", tenant.church.id)
              .eq("ministry_id", active.id)
              .in("event_id", eventIds)
          : Promise.resolve({
              data: [] as Array<{ event_id: string; user_id: string; role_name: string }>,
            }),
      ])
    : [
        {
          data: [] as Array<{ request_id: string; event_id: string; status: string }>,
        },
        { data: [] as Array<{ request_id: string; event_id: string }> },
        { data: [] as Array<{ event_id: string; user_id: string; status: string }> },
        {
          data: [] as Array<{
            user_id: string;
            role: string;
            profiles: { full_name: string; avatar_url: string | null };
          }>,
        },
        { data: [] as Array<{ event_id: string; user_id: string; role_name: string }> },
      ];

  const myByRequestEvent = new Map(
    (myResult.data ?? []).map((row) => [
      `${row.request_id}:${row.event_id}`,
      row.status as AvailabilityStatus,
    ])
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
  const teamCalendarResult =
    active?.canManage && teamUserIds.length > 0 && eventIds.length > 0
      ? await supabase
          .from("member_availability_calendar")
          .select("user_id, ministry_id, campus_id, availability_date, period, status")
          .eq("church_id", tenant.church.id)
          .eq("ministry_id", active.id)
          .in("user_id", teamUserIds)
          .gte("availability_date", initialMonth)
          .lte("availability_date", finalEventDate)
          .limit(5000)
      : {
          data: [] as Array<{
            user_id: string;
            ministry_id: string | null;
            campus_id: string | null;
            availability_date: string;
            period: string;
            status: string;
          }>,
        };

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
        recurringEntries: [],
      })
    : new Map<string, TeamMemberAvailability[]>();

  const events: AvailabilityEvent[] = eventRows.map((event) => {
    const campus = event.campuses as unknown as { name: string } | null;
    const team = active?.canManage ? teamByEvent.get(event.id) ?? [] : null;
    return {
      id: event.id,
      title: event.title,
      dateLabel: formatEventDate(event.starts_at),
      timeLabel: formatEventTime(event.starts_at),
      monthKey: event.starts_at.slice(0, 7),
      monthLabel: new Date(event.starts_at).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      serviceRoles: Object.fromEntries(
        (assignmentsResult.data ?? [])
          .filter((assignment) => assignment.event_id === event.id)
          .map((assignment) => [assignment.user_id, assignment.role_name])
      ),
      context: eventContextLabel({
        campusName: campus?.name,
        servicePeriod: event.service_period,
        fallbackLocation: event.location,
      }),
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
      responses: Object.fromEntries(
        (eventIdsByRequest.get(request.id) ?? []).flatMap((eventId) => {
          const status = myByRequestEvent.get(`${request.id}:${eventId}`);
          return status ? [[eventId, status] as const] : [];
        })
      ),
    }))
    .filter((request) => request.eventIds.length > 0);

  if (!active) {
    return (
      <div className="space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Disponibilidade
          </p>
          <h1 className="page-title mt-2">Escolha o ministério</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Cada equipe mantém sua própria disponibilidade. Escolha onde você vai informar ou consultar as respostas.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => {
            const isLouvor = option.slug === "louvor" || /louvor/i.test(option.name);
            const isKids = ["kids", "infantil", "criancas", "crianças"].includes(option.slug.toLocaleLowerCase("pt-BR"))
              || /(kids|infantil|crian[cç]as)/i.test(option.name);
            const href = isLouvor
              ? `/${churchSlug}/louvor/disponibilidade`
              : isKids
                ? `/${churchSlug}/infantil/disponibilidade`
                : `/${churchSlug}/disponibilidade?ministry=${option.id}`;
            return (
              <Link key={option.id} href={href} className="rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40">
                <span className="font-medium">{option.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {option.canManage ? "Minha disponibilidade e visão da equipe" : "Minha disponibilidade"}
                </span>
              </Link>
            );
          })}
        </div>
        {options.length === 0 && (
          <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
            Você ainda não participa de um ministério com disponibilidade ativa.
          </p>
        )}
      </div>
    );
  }

  const view = active.canManage && query.view !== "mine" ? "team" : "mine";
  const availabilityPath = query.module === "louvor"
    ? `/${churchSlug}/louvor/disponibilidade`
    : query.module === "kids"
      ? `/${churchSlug}/infantil/disponibilidade`
      : `/${churchSlug}/disponibilidade?ministry=${active.id}`;
  const viewHref = (nextView: "mine" | "team") =>
    `${availabilityPath}${availabilityPath.includes("?") ? "&" : "?"}view=${nextView}`;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
{query.module && active
            ? `${query.module === "kids" ? "Kids" : "Louvor"} · Disponibilidade`
            : active?.canManage
              ? "Visão da liderança"
              : "Área pessoal"}
        </p>
        <h1 className="page-title mt-2">
{query.module && active
            ? `Disponibilidade do ${active.name}`
            : active?.canManage
              ? `Disponibilidade da equipe · ${active.name}`
              : "Minha disponibilidade"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {active?.canManage
            ? "Consulte a disponibilidade mensal da equipe, solicite respostas para eventos e informe também a sua disponibilidade."
            : "Informe sua disponibilidade mensal e responda separadamente aos eventos enviados pela liderança."}
        </p>
      </header>

      {active.canManage && (
        <nav className="inline-flex rounded-full border p-1" aria-label="Visão da disponibilidade">
          <Link
            href={viewHref("mine")}
            aria-current={view === "mine" ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${view === "mine" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            Minha disponibilidade
          </Link>
          <Link
            href={viewHref("team")}
            aria-current={view === "team" ? "page" : undefined}
            className={`flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors ${view === "team" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            Equipe
          </Link>
        </nav>
      )}

      {view === "mine" ? (
        <div className="space-y-8">
          <AvailabilityCalendar
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            ministryId={active.id}
            scopeLabel={`Minha disponibilidade · ${active.name}`}
            initialMonth={initialMonth}
            entries={calendarEntries}
            campuses={campusResult.data ?? []}
          />

          {requests.length > 0 && (
            <AvailabilityPanel
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              ministryId={active.id}
              ministryName={active.name}
              canManage={false}
              events={events}
              requests={requests}
            />
          )}
        </div>
      ) : (
        <AvailabilityPanel
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          ministryId={active.id}
          ministryName={active.name}
          canManage
          events={events}
          requests={requests}
        />
      )}
    </div>
  );
}
