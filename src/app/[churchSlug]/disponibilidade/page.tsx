import { redirect } from "next/navigation";
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
import type { AvailabilityStatus } from "@/lib/actions/availability";

export default async function DisponibilidadePage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const { active } = await getActiveMinistry(churchSlug);
  if (!active) redirect(`/${churchSlug}/escalas`);

  const supabase = await createClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [{ data: eventRows }, { data: requestRows }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, location, service_period, campuses(name)")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", active.id)
      .gte("starts_at", since.toISOString())
      .order("starts_at")
      .limit(40),
    supabase
      .from("availability_requests")
      .select("id, title, respond_by, created_at")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", active.id)
      .is("closed_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const eventIds = (eventRows ?? []).map((event) => event.id);
  const requestIds = (requestRows ?? []).map((request) => request.id);

  const [myResult, requestEventsResult, allResult, membersResult] = await Promise.all([
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
  ]);

  const myByEvent = new Map(
    (myResult.data ?? []).map((row) => [row.event_id, row.status as AvailabilityStatus])
  );
  const totalMembers = membersResult.count ?? 0;

  const countsByEvent = new Map<
    string,
    { available: number; unavailable: number; maybe: number; informed: Set<string> }
  >();
  for (const row of allResult.data ?? []) {
    const current = countsByEvent.get(row.event_id) ?? {
      available: 0,
      unavailable: 0,
      maybe: 0,
      informed: new Set<string>(),
    };
    if (row.status === "available") current.available++;
    if (row.status === "unavailable") current.unavailable++;
    if (row.status === "maybe") current.maybe++;
    current.informed.add(row.user_id);
    countsByEvent.set(row.event_id, current);
  }

  const events: AvailabilityEvent[] = (eventRows ?? []).map((event) => {
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
        active.canManage && counts
          ? {
              available: counts.available,
              unavailable: counts.unavailable,
              maybe: counts.maybe,
              notInformed: Math.max(0, totalMembers - counts.informed.size),
            }
          : active.canManage
            ? { available: 0, unavailable: 0, maybe: 0, notInformed: totalMembers }
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

  const requests: AvailabilityRequestView[] = (requestRows ?? [])
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
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {active.name}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Disponibilidade</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Informe quando você pode servir. A liderança usa estas respostas antes de montar as escalas.
        </p>
      </header>

      <AvailabilityPanel
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={active.id}
        ministryName={active.name}
        canManage={active.canManage}
        events={events}
        requests={requests}
      />
    </div>
  );
}
