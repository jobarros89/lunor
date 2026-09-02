import type {
  AvailabilityOverviewMember,
  TeamMemberAvailability,
} from "@/lib/availability-overview";

export type OperationalReadiness = "ready" | "attention" | "no_assignments";

export type OperationalEvent = {
  id: string;
  title: string;
  startsAt: string;
  campusId: string | null;
  servicePeriod: string | null;
};

export type OperationalAssignment = {
  eventId: string;
  userId: string;
  status: string;
};

export type OperationalEventSummary = {
  id: string;
  title: string;
  startsAt: string;
  readiness: OperationalReadiness;
  assignments: {
    total: number;
    confirmed: number;
    awaitingConfirmation: number;
    wantsLeader: number;
    substitutionNeeded: number;
    absent: number;
    assignedUnavailable: number;
  };
  availability: {
    totalMembers: number;
    available: number;
    unavailable: number;
    unknown: number;
  };
};

export type OperationalSummary = {
  contractVersion: 1;
  generatedAt: string;
  scope: {
    ministryId: string;
    ministryName: string;
  };
  totals: {
    upcomingEvents: number;
    activeMembers: number;
    assignments: number;
    confirmedAssignments: number;
    eventsReady: number;
    eventsAttention: number;
    eventsWithoutAssignments: number;
  };
  events: OperationalEventSummary[];
};

const ATTENTION_STATUSES = new Set([
  "convidado",
  "falar_lider",
  "substituicao_solicitada",
  "ausente",
]);

function uniqueUserIds(assignments: OperationalAssignment[]) {
  return new Set(assignments.map((assignment) => assignment.userId));
}

export function buildOperationalSummary({
  ministryId,
  ministryName,
  members,
  events,
  assignments,
  availabilityByEvent,
  generatedAt = new Date().toISOString(),
}: {
  ministryId: string;
  ministryName: string;
  members: AvailabilityOverviewMember[];
  events: OperationalEvent[];
  assignments: OperationalAssignment[];
  availabilityByEvent: Map<string, TeamMemberAvailability[]>;
  generatedAt?: string;
}): OperationalSummary {
  const eventSummaries = events.map<OperationalEventSummary>((event) => {
    const eventAssignments = assignments.filter(
      (assignment) => assignment.eventId === event.id && assignment.status !== "substituido"
    );
    const availability = availabilityByEvent.get(event.id) ?? [];
    const unavailableUsers = new Set(
      availability
        .filter((member) => member.status === "unavailable")
        .map((member) => member.userId)
    );
    const assignedUsers = uniqueUserIds(eventAssignments);
    const assignedUnavailable = [...assignedUsers].filter((userId) =>
      unavailableUsers.has(userId)
    ).length;

    const confirmed = eventAssignments.filter((assignment) =>
      ["confirmado", "presente"].includes(assignment.status)
    ).length;
    const awaitingConfirmation = eventAssignments.filter(
      (assignment) => assignment.status === "convidado"
    ).length;
    const wantsLeader = eventAssignments.filter(
      (assignment) => assignment.status === "falar_lider"
    ).length;
    const substitutionNeeded = eventAssignments.filter(
      (assignment) => assignment.status === "substituicao_solicitada"
    ).length;
    const absent = eventAssignments.filter(
      (assignment) => assignment.status === "ausente"
    ).length;
    const hasAttentionStatus = eventAssignments.some((assignment) =>
      ATTENTION_STATUSES.has(assignment.status)
    );

    const readiness: OperationalReadiness =
      eventAssignments.length === 0
        ? "no_assignments"
        : hasAttentionStatus || assignedUnavailable > 0
          ? "attention"
          : "ready";

    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      readiness,
      assignments: {
        total: eventAssignments.length,
        confirmed,
        awaitingConfirmation,
        wantsLeader,
        substitutionNeeded,
        absent,
        assignedUnavailable,
      },
      availability: {
        totalMembers: members.length,
        available: availability.filter((member) => member.status === "available").length,
        unavailable: availability.filter((member) => member.status === "unavailable").length,
        unknown: availability.filter((member) => member.status === null).length,
      },
    };
  });

  return {
    contractVersion: 1,
    generatedAt,
    scope: { ministryId, ministryName },
    totals: {
      upcomingEvents: eventSummaries.length,
      activeMembers: members.length,
      assignments: eventSummaries.reduce((total, event) => total + event.assignments.total, 0),
      confirmedAssignments: eventSummaries.reduce(
        (total, event) => total + event.assignments.confirmed,
        0
      ),
      eventsReady: eventSummaries.filter((event) => event.readiness === "ready").length,
      eventsAttention: eventSummaries.filter((event) => event.readiness === "attention").length,
      eventsWithoutAssignments: eventSummaries.filter(
        (event) => event.readiness === "no_assignments"
      ).length,
    },
    events: eventSummaries,
  };
}
