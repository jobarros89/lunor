import type {
  AvailabilityPeriod,
  AvailabilityStatus,
} from "@/lib/actions/availability";

export type AvailabilitySource =
  | "event"
  | "ministry_calendar"
  | "general_calendar"
  | "ministry_recurring"
  | "general_recurring";

export type AvailabilityOverviewMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: string;
};

export type AvailabilityOverviewEvent = {
  id: string;
  startsAt: string;
  campusId: string | null;
  servicePeriod: string | null;
};

export type EventAvailabilityEntry = {
  eventId: string;
  userId: string;
  status: AvailabilityStatus;
};

export type TeamCalendarAvailabilityEntry = {
  userId: string;
  ministryId: string | null;
  campusId: string | null;
  date: string;
  period: AvailabilityPeriod;
  status: AvailabilityStatus;
};

export type TeamRecurringAvailabilityEntry = {
  userId: string;
  ministryId: string | null;
  campusId: string | null;
  weekday: number;
  period: AvailabilityPeriod;
  status: AvailabilityStatus;
};

export type TeamMemberAvailability = AvailabilityOverviewMember & {
  status: AvailabilityStatus | null;
  source: AvailabilitySource | null;
};

const periods = new Set<AvailabilityPeriod>([
  "all_day",
  "morning",
  "afternoon",
  "evening",
]);

function periodCandidates(period: string | null): AvailabilityPeriod[] {
  if (period && periods.has(period as AvailabilityPeriod) && period !== "all_day") {
    return [period as AvailabilityPeriod, "all_day"];
  }
  return ["all_day"];
}

function campusCandidates(campusId: string | null): Array<string | null> {
  return campusId ? [campusId, null] : [null];
}

function calendarKey(
  userId: string,
  ministryId: string | null,
  campusId: string | null,
  date: string,
  period: AvailabilityPeriod
) {
  return [userId, ministryId ?? "general", campusId ?? "all", date, period].join(":");
}

function recurringKey(
  userId: string,
  ministryId: string | null,
  campusId: string | null,
  weekday: number,
  period: AvailabilityPeriod
) {
  return [userId, ministryId ?? "general", campusId ?? "all", weekday, period].join(":");
}

function eventDate(startsAt: string) {
  return startsAt.slice(0, 10);
}

function eventWeekday(startsAt: string) {
  const date = eventDate(startsAt);
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function buildTeamAvailabilityOverview({
  ministryId,
  members,
  events,
  eventEntries,
  calendarEntries,
  recurringEntries,
}: {
  ministryId: string;
  members: AvailabilityOverviewMember[];
  events: AvailabilityOverviewEvent[];
  eventEntries: EventAvailabilityEntry[];
  calendarEntries: TeamCalendarAvailabilityEntry[];
  recurringEntries: TeamRecurringAvailabilityEntry[];
}) {
  const byEvent = new Map(
    eventEntries.map((entry) => [
      `${entry.eventId}:${entry.userId}`,
      entry.status,
    ])
  );
  const byCalendar = new Map(
    calendarEntries.map((entry) => [
      calendarKey(
        entry.userId,
        entry.ministryId,
        entry.campusId,
        entry.date,
        entry.period
      ),
      entry.status,
    ])
  );
  const byRecurring = new Map(
    recurringEntries.map((entry) => [
      recurringKey(
        entry.userId,
        entry.ministryId,
        entry.campusId,
        entry.weekday,
        entry.period
      ),
      entry.status,
    ])
  );

  return new Map(
    events.map((event) => {
      const date = eventDate(event.startsAt);
      const weekday = eventWeekday(event.startsAt);
      const eventPeriods = periodCandidates(event.servicePeriod);
      const eventCampuses = campusCandidates(event.campusId);

      const resolved = members.map<TeamMemberAvailability>((member) => {
        const direct = byEvent.get(`${event.id}:${member.userId}`);
        if (direct) {
          return { ...member, status: direct, source: "event" };
        }

        for (const scope of [ministryId, null]) {
          for (const campusId of eventCampuses) {
            for (const period of eventPeriods) {
              const status = byCalendar.get(
                calendarKey(member.userId, scope, campusId, date, period)
              );
              if (status) {
                return {
                  ...member,
                  status,
                  source: scope ? "ministry_calendar" : "general_calendar",
                };
              }
            }
          }
        }

        for (const scope of [ministryId, null]) {
          for (const campusId of eventCampuses) {
            for (const period of eventPeriods) {
              const status = byRecurring.get(
                recurringKey(member.userId, scope, campusId, weekday, period)
              );
              if (status) {
                return {
                  ...member,
                  status,
                  source: scope ? "ministry_recurring" : "general_recurring",
                };
              }
            }
          }
        }

        return { ...member, status: null, source: null };
      });

      return [event.id, resolved] as const;
    })
  );
}
