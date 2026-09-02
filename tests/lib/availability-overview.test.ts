import { describe, expect, it } from "vitest";
import { buildTeamAvailabilityOverview } from "@/lib/availability-overview";

const ministryId = "ministry-louvor";
const campusId = "campus-botafogo";
const events = [
  {
    id: "event-sunday",
    startsAt: "2026-09-06T13:00:00.000Z",
    campusId,
    servicePeriod: "morning",
  },
];
const members = [
  { userId: "a", name: "Ana", avatarUrl: null, role: "voluntario" },
  { userId: "b", name: "Bia", avatarUrl: null, role: "voluntario" },
  { userId: "c", name: "Caio", avatarUrl: null, role: "voluntario" },
  { userId: "d", name: "Davi", avatarUrl: null, role: "voluntario" },
];

describe("visão consolidada de disponibilidade da equipe", () => {
  it("prioriza culto, calendário do ministério, calendário geral e recorrência", () => {
    const result = buildTeamAvailabilityOverview({
      ministryId,
      members,
      events,
      eventEntries: [
        { eventId: "event-sunday", userId: "a", status: "available" },
      ],
      calendarEntries: [
        {
          userId: "a",
          ministryId,
          campusId,
          date: "2026-09-06",
          period: "morning",
          status: "unavailable",
        },
        {
          userId: "b",
          ministryId,
          campusId: null,
          date: "2026-09-06",
          period: "all_day",
          status: "available",
        },
        {
          userId: "c",
          ministryId: null,
          campusId: null,
          date: "2026-09-06",
          period: "all_day",
          status: "unavailable",
        },
      ],
      recurringEntries: [
        {
          userId: "c",
          ministryId: null,
          campusId: null,
          weekday: 0,
          period: "all_day",
          status: "available",
        },
      ],
    });

    expect(result.get("event-sunday")).toEqual([
      expect.objectContaining({ userId: "a", status: "available", source: "event" }),
      expect.objectContaining({
        userId: "b",
        status: "available",
        source: "ministry_calendar",
      }),
      expect.objectContaining({
        userId: "c",
        status: "unavailable",
        source: "general_calendar",
      }),
      expect.objectContaining({ userId: "d", status: null, source: null }),
    ]);
  });

  it("usa o campus e o período específicos antes dos padrões gerais", () => {
    const result = buildTeamAvailabilityOverview({
      ministryId,
      members: [members[0]!],
      events,
      eventEntries: [],
      calendarEntries: [
        {
          userId: "a",
          ministryId,
          campusId: null,
          date: "2026-09-06",
          period: "morning",
          status: "unavailable",
        },
        {
          userId: "a",
          ministryId,
          campusId,
          date: "2026-09-06",
          period: "all_day",
          status: "available",
        },
      ],
      recurringEntries: [],
    });

    expect(result.get("event-sunday")?.[0]).toEqual(
      expect.objectContaining({ status: "available", source: "ministry_calendar" })
    );
  });
});
