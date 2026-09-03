import { z } from "zod";
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
import type { LunorAiTool } from "@/lib/ai/cloudflare";
import { ASSIGNMENT_STATUS_LABELS } from "@/lib/escalas";
import { loadOperationalSummary } from "@/lib/operational-summary-server";
import { resolveServiceWindow, timeLabel } from "@/lib/service-window";
import { createClient } from "@/lib/supabase/server";

export type LunorToolContext = {
  churchId: string;
  ministryId: string;
  ministryName: string;
};

export type LunorToolDescriptor = LunorAiTool & {
  annotations: {
    readOnlyHint: true;
    destructiveHint: false;
    idempotentHint: true;
    openWorldHint: false;
  };
};

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const LUNOR_TOOLS: LunorToolDescriptor[] = [
  {
    name: "get_operational_summary",
    description:
      "Retorna o resumo operacional determinístico dos próximos cultos do ministério: escalas, confirmações, pendências e disponibilidade.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 8,
          description: "Quantidade de próximos cultos a analisar. Padrão: 4.",
        },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "get_event_team",
    description:
      "Lista as pessoas escaladas em um culto específico do ministério, com função, status de confirmação e horários efetivos de serviço.",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          format: "uuid",
          description: "ID do culto retornado pelo resumo operacional.",
        },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: "get_event_availability",
    description:
      "Lista a disponibilidade resolvida de todos os membros ativos do ministério para um culto específico, incluindo quem ainda não respondeu.",
    parameters: {
      type: "object",
      properties: {
        eventId: {
          type: "string",
          format: "uuid",
          description: "ID do culto retornado pelo resumo operacional.",
        },
      },
      required: ["eventId"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
];

export function lunorAiTools(): LunorAiTool[] {
  return LUNOR_TOOLS.map(({ name, description, parameters }) => ({
    name,
    description,
    parameters,
  }));
}

const operationalSummaryInput = z.object({
  limit: z.number().int().min(1).max(8).optional(),
});
const eventInput = z.object({ eventId: z.string().uuid() });

function firstProfile(
  value:
    | { full_name: string; avatar_url: string | null }
    | { full_name: string; avatar_url: string | null }[]
    | null
) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getEventTeam(
  context: LunorToolContext,
  input: z.infer<typeof eventInput>
) {
  const supabase = await createClient();
  const [{ data: event }, { data: teamWindow }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at")
      .eq("church_id", context.churchId)
      .eq("id", input.eventId)
      .maybeSingle(),
    supabase
      .from("event_ministry_windows")
      .select("arrival_at, release_at")
      .eq("church_id", context.churchId)
      .eq("ministry_id", context.ministryId)
      .eq("event_id", input.eventId)
      .maybeSingle(),
  ]);
  if (!event) throw new Error("event_not_found");

  const { data: assignments, error } = await supabase
    .from("assignments")
    .select("id, user_id, role_name, status, arrival_time, release_time")
    .eq("church_id", context.churchId)
    .eq("ministry_id", context.ministryId)
    .eq("event_id", input.eventId)
    .neq("status", "substituido")
    .order("created_at");
  if (error) throw new Error("event_team_unavailable");

  const userIds = [...new Set((assignments ?? []).map((row) => row.user_id))];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string }[] };
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return {
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.starts_at,
    },
    ministry: context.ministryName,
    people: (assignments ?? []).map((assignment) => {
      const serviceWindow = resolveServiceWindow({
        eventStart: event.starts_at,
        eventEnd: event.ends_at,
        teamArrival: teamWindow?.arrival_at,
        teamRelease: teamWindow?.release_at,
        assignmentArrival: assignment.arrival_time,
        assignmentRelease: assignment.release_time,
      });
      return {
        assignmentId: assignment.id,
        userId: assignment.user_id,
        name: names.get(assignment.user_id) ?? "Sem nome",
        roleName: assignment.role_name,
        status: assignment.status,
        statusLabel: ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status,
        arrival: timeLabel(serviceWindow.arrivalAt),
        release: timeLabel(serviceWindow.releaseAt),
      };
    }),
  };
}

async function getEventAvailability(
  context: LunorToolContext,
  input: z.infer<typeof eventInput>
) {
  const supabase = await createClient();
  const [{ data: event }, { data: memberRows }] = await Promise.all([
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
  ]);
  if (!event) throw new Error("event_not_found");

  const members: AvailabilityOverviewMember[] = (memberRows ?? []).map((row) => {
    const profile = firstProfile(
      row.profiles as unknown as
        | { full_name: string; avatar_url: string | null }
        | { full_name: string; avatar_url: string | null }[]
        | null
    );
    return {
      userId: row.user_id,
      name: profile?.full_name ?? "Sem nome",
      avatarUrl: profile?.avatar_url ?? null,
      role: row.role,
    };
  });

  const date = event.starts_at.slice(0, 10);
  const [eventAvailability, calendar, recurring] = await Promise.all([
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
  ]);
  if (eventAvailability.error || calendar.error || recurring.error) {
    throw new Error("event_availability_unavailable");
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

  return {
    event: { id: event.id, title: event.title, startsAt: event.starts_at },
    ministry: context.ministryName,
    people: (overview.get(event.id) ?? []).map((member) => ({
      userId: member.userId,
      name: member.name,
      role: member.role,
      status: member.status,
      statusLabel:
        member.status === "available"
          ? "Disponível"
          : member.status === "unavailable"
            ? "Indisponível"
            : "Sem resposta",
      source: member.source,
    })),
  };
}

export async function executeLunorTool(
  name: string,
  args: Record<string, unknown>,
  context: LunorToolContext
): Promise<unknown> {
  switch (name) {
    case "get_operational_summary": {
      const input = operationalSummaryInput.parse(args);
      return loadOperationalSummary({
        churchId: context.churchId,
        ministryId: context.ministryId,
        ministryName: context.ministryName,
        limit: input.limit ?? 4,
      });
    }
    case "get_event_team":
      return getEventTeam(context, eventInput.parse(args));
    case "get_event_availability":
      return getEventAvailability(context, eventInput.parse(args));
    default:
      throw new Error("unknown_tool");
  }
}
