import { describe, expect, it } from "vitest";
import {
  buildOperationalSummary,
  type OperationalAssignment,
  type OperationalEvent,
} from "@/lib/operational-summary";
import type {
  AvailabilityOverviewMember,
  TeamMemberAvailability,
} from "@/lib/availability-overview";

const members: AvailabilityOverviewMember[] = [
  { userId: "a", name: "Ana", avatarUrl: null, role: "voluntario" },
  { userId: "b", name: "Bia", avatarUrl: null, role: "voluntario" },
  { userId: "c", name: "Caio", avatarUrl: null, role: "voluntario" },
];

const events: OperationalEvent[] = [
  {
    id: "event-1",
    title: "Culto manhã",
    startsAt: "2026-09-06T13:00:00.000Z",
    campusId: "campus-central",
    servicePeriod: "morning",
  },
  {
    id: "event-2",
    title: "Culto noite",
    startsAt: "2026-09-06T21:00:00.000Z",
    campusId: "campus-central",
    servicePeriod: "evening",
  },
];

function availability(
  eventId: string,
  values: Array<[string, "available" | "unavailable" | null]>
) {
  return [
    eventId,
    values.map<TeamMemberAvailability>(([userId, status]) => {
      const member = members.find((item) => item.userId === userId)!;
      return { ...member, status, source: status ? "ministry_calendar" : null };
    }),
  ] as const;
}

describe("contrato do resumo operacional", () => {
  it("distingue culto sem escala de culto com problema", () => {
    const summary = buildOperationalSummary({
      ministryId: "louvor",
      ministryName: "Louvor",
      members,
      events: [events[0]!],
      assignments: [],
      availabilityByEvent: new Map([
        availability("event-1", [
          ["a", "available"],
          ["b", "unavailable"],
          ["c", null],
        ]),
      ]),
      generatedAt: "2026-09-02T22:00:00.000Z",
    });

    expect(summary.contractVersion).toBe(1);
    expect(summary.events[0]).toMatchObject({
      readiness: "no_assignments",
      assignments: { total: 0 },
      availability: { available: 1, unavailable: 1, unknown: 1 },
    });
    expect(summary.totals.eventsWithoutAssignments).toBe(1);
    expect(summary.totals.eventsAttention).toBe(0);
  });

  it("marca atenção quando há confirmação pendente ou escalado indisponível", () => {
    const assignments: OperationalAssignment[] = [
      { eventId: "event-1", userId: "a", status: "confirmado" },
      { eventId: "event-1", userId: "b", status: "convidado" },
    ];

    const summary = buildOperationalSummary({
      ministryId: "louvor",
      ministryName: "Louvor",
      members,
      events: [events[0]!],
      assignments,
      availabilityByEvent: new Map([
        availability("event-1", [
          ["a", "available"],
          ["b", "unavailable"],
          ["c", null],
        ]),
      ]),
      generatedAt: "2026-09-02T22:00:00.000Z",
    });

    expect(summary.events[0]).toMatchObject({
      readiness: "attention",
      assignments: {
        total: 2,
        confirmed: 1,
        awaitingConfirmation: 1,
        assignedUnavailable: 1,
      },
    });
    expect(summary.totals.eventsAttention).toBe(1);
  });

  it("considera pronto quando a escala existe e não há pendências nem conflito explícito", () => {
    const summary = buildOperationalSummary({
      ministryId: "louvor",
      ministryName: "Louvor",
      members,
      events,
      assignments: [
        { eventId: "event-1", userId: "a", status: "confirmado" },
        { eventId: "event-2", userId: "b", status: "presente" },
      ],
      availabilityByEvent: new Map([
        availability("event-1", [
          ["a", "available"],
          ["b", null],
          ["c", null],
        ]),
        availability("event-2", [
          ["a", null],
          ["b", "available"],
          ["c", null],
        ]),
      ]),
      generatedAt: "2026-09-02T22:00:00.000Z",
    });

    expect(summary.totals).toMatchObject({
      upcomingEvents: 2,
      activeMembers: 3,
      assignments: 2,
      confirmedAssignments: 2,
      eventsReady: 2,
      eventsAttention: 0,
      eventsWithoutAssignments: 0,
    });
  });
});
