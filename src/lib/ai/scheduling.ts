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
import { createClient } from "@/lib/supabase/server";

export type SchedulingContext = {
  churchId: string;
  ministryId: string;
  ministryName: string;
};

export type ScheduleCandidate = {
  userId: string;
  name: string;
  ministryRole: string;
  availability: "available" | "unavailable" | "unknown";
  availabilityLabel: string;
  availabilitySource: string | null;
  alreadyAssignedRoles: string[];
  matchingRoleExperience: number;
  eligible: boolean;
  score: number;
};

export type AssignmentProposal = {
  kind: "assignment";
  eventId: string;
  eventTitle: string;
  startsAt: string;
  userId: string;
  userName: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  availability: "available" | "unknown";
  availabilityLabel: string;
  rationale: string;
};

type RelatedName = { name: string } | { name: string }[] | null;

function firstRelated(value: RelatedName) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function availabilityLabel(status: ScheduleCandidate["availability"]) {
  if (status === "available") return "Disponível";
  if (status === "unavailable") return "Indisponível";
  return "Sem resposta";
}

export async function loadScheduleCandidates(
  context: SchedulingContext,
  input: { eventId: string; roleName?: string; limit?: number }
) {
  const supabase = await createClient();
  const limit = Math.min(Math.max(input.limit ?? 8, 1), 50);
  const requestedRole = input.roleName?.trim() ?? "";
  const normalizedRole = normalize(requestedRole);

  const [{ data: event }, { data: memberRows }, { data: currentAssignments }, { data: departments }] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, title, starts_at, campus_id, service_period")
        .eq("church_id", context.churchId)
        .eq("id", input.eventId)
        .maybeSingle(),
      supabase
        .from("ministry_members")
        .select("user_id, role, profiles!inner(full_name, avatar_url)")
        .eq("church_id", context.churchId)
        .eq("ministry_id", context.ministryId)
        .eq("active", true),
      supabase
        .from("assignments")
        .select("user_id, role_name")
        .eq("church_id", context.churchId)
        .eq("ministry_id", context.ministryId)
        .eq("event_id", input.eventId)
        .neq("status", "substituido"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("church_id", context.churchId)
        .eq("ministry_id", context.ministryId)
        .eq("active", true),
    ]);

  if (!event) throw new Error("event_not_found");

  const members: AvailabilityOverviewMember[] = (memberRows ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles;
    return {
      userId: row.user_id,
      name: profile?.full_name ?? "Sem nome",
      avatarUrl: profile?.avatar_url ?? null,
      role: row.role,
    };
  });

  const date = event.starts_at.slice(0, 10);
  const [eventAvailability, calendar, recurring, historicalAssignments] = await Promise.all([
    supabase
      .from("member_availability")
      .select("event_id, user_id, status")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .eq("event_id", event.id),
    supabase
      .from("member_availability_calendar")
      .select("user_id, ministry_id, campus_id, availability_date, period, status")
      .eq("church_id", context.churchId)
      .eq("availability_date", date)
      .or(`ministry_id.eq.${context.ministryId},ministry_id.is.null`),
    supabase
      .from("member_availability_recurring")
      .select("user_id, ministry_id, campus_id, weekday, period, status")
      .eq("church_id", context.churchId)
      .or(`ministry_id.eq.${context.ministryId},ministry_id.is.null`),
    requestedRole
      ? supabase
          .from("assignments")
          .select("user_id, role_name, departments(name), events!inner(starts_at)")
          .eq("church_id", context.churchId)
          .eq("ministry_id", context.ministryId)
          .neq("status", "substituido")
          .lt("events.starts_at", new Date().toISOString())
          .order("starts_at", { referencedTable: "events", ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (
    eventAvailability.error ||
    calendar.error ||
    recurring.error ||
    historicalAssignments.error
  ) {
    throw new Error("schedule_candidates_unavailable");
  }

  const overview = buildTeamAvailabilityOverview({
    ministryId: context.ministryId,
    members,
    events: [
      {
        id: event.id,
        startsAt: event.starts_at,
        campusId: event.campus_id,
        servicePeriod: event.service_period,
      },
    ],
    eventEntries: (eventAvailability.data ?? []).map<EventAvailabilityEntry>((entry) => ({
      eventId: entry.event_id,
      userId: entry.user_id,
      status: entry.status as AvailabilityStatus,
    })),
    calendarEntries: (calendar.data ?? []).map<TeamCalendarAvailabilityEntry>((entry) => ({
      userId: entry.user_id,
      ministryId: entry.ministry_id,
      campusId: entry.campus_id,
      date: entry.availability_date,
      period: entry.period as AvailabilityPeriod,
      status: entry.status as AvailabilityStatus,
    })),
    recurringEntries: (recurring.data ?? []).map<TeamRecurringAvailabilityEntry>((entry) => ({
      userId: entry.user_id,
      ministryId: entry.ministry_id,
      campusId: entry.campus_id,
      weekday: entry.weekday,
      period: entry.period as AvailabilityPeriod,
      status: entry.status as AvailabilityStatus,
    })),
  });

  const currentRoles = new Map<string, string[]>();
  for (const assignment of currentAssignments ?? []) {
    const roles = currentRoles.get(assignment.user_id) ?? [];
    roles.push(assignment.role_name);
    currentRoles.set(assignment.user_id, roles);
  }

  const experience = new Map<string, number>();
  if (normalizedRole) {
    for (const assignment of historicalAssignments.data ?? []) {
      const departmentName = firstRelated(assignment.departments as unknown as RelatedName)?.name ?? "";
      if (
        normalize(assignment.role_name) === normalizedRole ||
        (departmentName && normalize(departmentName) === normalizedRole)
      ) {
        experience.set(assignment.user_id, (experience.get(assignment.user_id) ?? 0) + 1);
      }
    }
  }

  const resolved = overview.get(event.id) ?? [];
  const candidates: ScheduleCandidate[] = resolved.map((member) => {
    const availability = member.status;
    const alreadyAssignedRoles = currentRoles.get(member.userId) ?? [];
    const matchingRoleExperience = experience.get(member.userId) ?? 0;
    const duplicateRole = normalizedRole
      ? alreadyAssignedRoles.some((role) => normalize(role) === normalizedRole)
      : false;
    const eligible = availability !== "unavailable" && !duplicateRole;
    const availabilityScore = availability === "available" ? 100 : availability === "unknown" ? 55 : 0;
    const score =
      availabilityScore +
      Math.min(matchingRoleExperience, 5) * 5 -
      alreadyAssignedRoles.length * 8 -
      (duplicateRole ? 100 : 0);

    return {
      userId: member.userId,
      name: member.name,
      ministryRole: member.role,
      availability,
      availabilityLabel: availabilityLabel(availability),
      availabilitySource: member.source,
      alreadyAssignedRoles,
      matchingRoleExperience,
      eligible,
      score,
    };
  });

  candidates.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.name.localeCompare(b.name, "pt-BR");
  });

  const matchedDepartment = requestedRole
    ? (departments ?? []).find((department) => normalize(department.name) === normalizedRole) ?? null
    : null;

  return {
    event: { id: event.id, title: event.title, startsAt: event.starts_at },
    ministry: context.ministryName,
    requestedRole: requestedRole || null,
    matchedDepartment,
    candidates: candidates.slice(0, limit),
  };
}

export async function buildAssignmentProposal(
  context: SchedulingContext,
  input: { eventId: string; userId: string; roleName: string }
): Promise<AssignmentProposal> {
  const roleName = input.roleName.trim();
  if (roleName.length < 2 || roleName.length > 80) throw new Error("invalid_role_name");

  const result = await loadScheduleCandidates(context, {
    eventId: input.eventId,
    roleName,
    limit: 50,
  });
  const candidate = result.candidates.find((item) => item.userId === input.userId);
  if (!candidate) throw new Error("candidate_not_found");
  if (!candidate.eligible) {
    throw new Error(
      candidate.availability === "unavailable"
        ? "candidate_unavailable"
        : "candidate_already_assigned_role"
    );
  }

  const rationaleParts = [candidate.availabilityLabel];
  if (candidate.matchingRoleExperience > 0) {
    rationaleParts.push(
      `${candidate.matchingRoleExperience} escala${candidate.matchingRoleExperience === 1 ? "" : "s"} anterior${candidate.matchingRoleExperience === 1 ? "" : "es"} nessa função`
    );
  }
  if (candidate.alreadyAssignedRoles.length > 0) {
    rationaleParts.push(`já serve como ${candidate.alreadyAssignedRoles.join(", ")} neste culto`);
  }

  return {
    kind: "assignment",
    eventId: result.event.id,
    eventTitle: result.event.title,
    startsAt: result.event.startsAt,
    userId: candidate.userId,
    userName: candidate.name,
    roleName,
    departmentId: result.matchedDepartment?.id ?? null,
    departmentName: result.matchedDepartment?.name ?? null,
    availability: candidate.availability === "available" ? "available" : "unknown",
    availabilityLabel: candidate.availabilityLabel,
    rationale: rationaleParts.join(" · "),
  };
}
