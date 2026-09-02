import type {
  AvailabilityPeriod,
  AvailabilityStatus,
} from "@/lib/actions/availability";
import {
  buildTeamAvailabilityOverview,
  type AvailabilityOverviewMember,
  type EventAvailabilityEntry,
  type TeamCalendarAvailabilityEntry,
  type TeamRecurringAvailabilityEntry,
} from "@/lib/availability-overview";
import {
  buildOperationalSummary,
  type OperationalAssignment,
  type OperationalEvent,
  type OperationalSummary,
} from "@/lib/operational-summary";
import { createClient } from "@/lib/supabase/server";

type ProfileRelation =
  | { full_name: string; avatar_url: string | null }
  | { full_name: string; avatar_url: string | null }[]
  | null;

type MemberRow = {
  user_id: string;
  role: string;
  profiles: ProfileRelation;
};

function firstProfile(value: ProfileRelation) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadOperationalSummary({
  churchId,
  ministryId,
  ministryName,
  limit = 4,
}: {
  churchId: string;
  ministryId: string;
  ministryName: string;
  limit?: number;
}): Promise<OperationalSummary> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [eventsResult, membersResult] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, campus_id, service_period")
      .eq("church_id", churchId)
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(limit),
    supabase
      .from("ministry_members")
      .select("user_id, role, profiles!inner(full_name, avatar_url)")
      .eq("church_id", churchId)
      .eq("ministry_id", ministryId)
      .eq("active", true),
  ]);

  if (eventsResult.error) console.error("operational-summary events:", eventsResult.error);
  if (membersResult.error) console.error("operational-summary members:", membersResult.error);

  const events: OperationalEvent[] = (eventsResult.data ?? []).map((event) => ({
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    campusId: event.campus_id,
    servicePeriod: event.service_period,
  }));
  const members: AvailabilityOverviewMember[] = (
    (membersResult.data ?? []) as unknown as MemberRow[]
  ).map((member) => {
    const profile = firstProfile(member.profiles);
    return {
      userId: member.user_id,
      name: profile?.full_name ?? "Sem nome",
      avatarUrl: profile?.avatar_url ?? null,
      role: member.role,
    };
  });

  if (events.length === 0) {
    return buildOperationalSummary({
      ministryId,
      ministryName,
      members,
      events: [],
      assignments: [],
      availabilityByEvent: new Map(),
    });
  }

  const eventIds = events.map((event) => event.id);
  const firstDate = events[0]!.startsAt.slice(0, 10);
  const lastDate = events.at(-1)!.startsAt.slice(0, 10);

  const [assignmentsResult, eventAvailabilityResult, calendarResult, recurringResult] =
    await Promise.all([
      supabase
        .from("assignments")
        .select("event_id, user_id, status")
        .eq("church_id", churchId)
        .eq("ministry_id", ministryId)
        .in("event_id", eventIds),
      supabase
        .from("member_availability_event")
        .select("event_id, user_id, status")
        .eq("church_id", churchId)
        .eq("ministry_id", ministryId)
        .in("event_id", eventIds),
      supabase
        .from("member_availability_calendar")
        .select("user_id, ministry_id, campus_id, availability_date, period, status")
        .eq("church_id", churchId)
        .gte("availability_date", firstDate)
        .lte("availability_date", lastDate)
        .or(`ministry_id.eq.${ministryId},ministry_id.is.null`),
      supabase
        .from("member_availability_recurring")
        .select("user_id, ministry_id, campus_id, weekday, period, status")
        .eq("church_id", churchId)
        .or(`ministry_id.eq.${ministryId},ministry_id.is.null`),
    ]);

  if (assignmentsResult.error)
    console.error("operational-summary assignments:", assignmentsResult.error);
  if (eventAvailabilityResult.error)
    console.error("operational-summary event availability:", eventAvailabilityResult.error);
  if (calendarResult.error)
    console.error("operational-summary calendar availability:", calendarResult.error);
  if (recurringResult.error)
    console.error("operational-summary recurring availability:", recurringResult.error);

  const assignments: OperationalAssignment[] = (assignmentsResult.data ?? []).map(
    (assignment) => ({
      eventId: assignment.event_id,
      userId: assignment.user_id,
      status: assignment.status,
    })
  );
  const eventEntries: EventAvailabilityEntry[] = (eventAvailabilityResult.data ?? []).map(
    (entry) => ({
      eventId: entry.event_id,
      userId: entry.user_id,
      status: entry.status as AvailabilityStatus,
    })
  );
  const calendarEntries: TeamCalendarAvailabilityEntry[] = (calendarResult.data ?? []).map(
    (entry) => ({
      userId: entry.user_id,
      ministryId: entry.ministry_id,
      campusId: entry.campus_id,
      date: entry.availability_date,
      period: entry.period as AvailabilityPeriod,
      status: entry.status as AvailabilityStatus,
    })
  );
  const recurringEntries: TeamRecurringAvailabilityEntry[] = (recurringResult.data ?? []).map(
    (entry) => ({
      userId: entry.user_id,
      ministryId: entry.ministry_id,
      campusId: entry.campus_id,
      weekday: entry.weekday,
      period: entry.period as AvailabilityPeriod,
      status: entry.status as AvailabilityStatus,
    })
  );

  const availabilityByEvent = buildTeamAvailabilityOverview({
    ministryId,
    members,
    events: events.map((event) => ({
      id: event.id,
      startsAt: event.startsAt,
      campusId: event.campusId,
      servicePeriod: event.servicePeriod,
    })),
    eventEntries,
    calendarEntries,
    recurringEntries,
  });

  return buildOperationalSummary({
    ministryId,
    ministryName,
    members,
    events,
    assignments,
    availabilityByEvent,
  });
}
