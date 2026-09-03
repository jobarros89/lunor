import { executeLunorTool, type LunorToolContext } from "@/lib/ai/tools";

export type DirectOperationalAnswer = {
  answer: string;
  usedTools: string[];
};

type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  context: LunorToolContext
) => Promise<unknown>;

type SummaryEvent = {
  id: string;
  title: string;
  startsAt: string;
  readiness: "ready" | "attention" | "no_assignments";
  assignments: {
    total: number;
    confirmed: number;
    awaitingConfirmation: number;
    wantsLeader: number;
    substitutionNeeded: number;
    absent: number;
    assignedUnavailable: number;
  };
};

type OperationalSummaryShape = {
  totals: {
    upcomingEvents: number;
    eventsAttention: number;
    eventsWithoutAssignments: number;
  };
  events: SummaryEvent[];
};

type TeamPerson = {
  name: string;
  roleName: string;
  status: string;
  statusLabel: string;
};

type TeamShape = {
  event: { id: string; title: string; startsAt: string };
  people: TeamPerson[];
};

type AvailabilityPerson = {
  name: string;
  role: string;
  status: "available" | "unavailable" | null;
  statusLabel: string;
};

type AvailabilityShape = {
  event: { id: string; title: string; startsAt: string };
  people: AvailabilityPerson[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function eventLabel(event: { title: string; startsAt: string }) {
  const date = new Date(event.startsAt);
  if (Number.isNaN(date.getTime())) return event.title;
  const when = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${event.title} · ${when}`;
}

function asSummary(value: unknown): OperationalSummaryShape | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<OperationalSummaryShape>;
  return record.totals && Array.isArray(record.events)
    ? (record as OperationalSummaryShape)
    : null;
}

function asTeam(value: unknown): TeamShape | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<TeamShape>;
  return record.event && Array.isArray(record.people) ? (record as TeamShape) : null;
}

function asAvailability(value: unknown): AvailabilityShape | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<AvailabilityShape>;
  return record.event && Array.isArray(record.people)
    ? (record as AvailabilityShape)
    : null;
}

function isNextServiceQuestion(question: string) {
  return question.includes("proximo culto") || question.includes("proxima escala") || question.includes("domingo");
}

function pendingStatus(status: string) {
  return ["convidado", "falar_lider", "substituicao_solicitada", "ausente"].includes(status);
}

export async function runDirectOperationalAnswer({
  question,
  context,
  toolExecutor = executeLunorTool,
}: {
  question: string;
  context: LunorToolContext;
  toolExecutor?: ToolExecutor;
}): Promise<DirectOperationalAnswer | null> {
  const normalized = normalize(question);

  const wantsAttention =
    normalized.includes("precisa da minha atencao") ||
    (normalized.includes("atencao") && normalized.includes("cult"));
  const wantsConfirmed = normalized.includes("confirm") && isNextServiceQuestion(normalized);
  const wantsUnavailable = normalized.includes("indispon") && isNextServiceQuestion(normalized);
  const wantsPending = normalized.includes("pendenc") && isNextServiceQuestion(normalized);

  if (!wantsAttention && !wantsConfirmed && !wantsUnavailable && !wantsPending) {
    return null;
  }

  const summary = asSummary(
    await toolExecutor("get_operational_summary", { limit: wantsAttention ? 4 : 1 }, context)
  );
  if (!summary) throw new Error("direct_summary_invalid");

  if (summary.events.length === 0) {
    return {
      answer: `Não há próximos cultos cadastrados para ${context.ministryName}.`,
      usedTools: ["get_operational_summary"],
    };
  }

  if (wantsAttention) {
    const attention = summary.events.filter((event) => event.readiness === "attention");
    const withoutAssignments = summary.events.filter((event) => event.readiness === "no_assignments");

    if (attention.length === 0 && withoutAssignments.length === 0) {
      return {
        answer: `Os próximos ${summary.events.length} culto${summary.events.length === 1 ? "" : "s"} de ${context.ministryName} estão sem pendências operacionais identificadas.`,
        usedTools: ["get_operational_summary"],
      };
    }

    const lines = [...attention, ...withoutAssignments].map((event) => {
      if (event.readiness === "no_assignments") {
        return `• ${eventLabel(event)} — ainda sem escala.`;
      }
      const a = event.assignments;
      const issues = [
        a.awaitingConfirmation ? `${a.awaitingConfirmation} aguardando confirmação` : "",
        a.wantsLeader ? `${a.wantsLeader} quer falar com o líder` : "",
        a.substitutionNeeded ? `${a.substitutionNeeded} pediu substituição` : "",
        a.absent ? `${a.absent} ausente` : "",
        a.assignedUnavailable ? `${a.assignedUnavailable} escalado indisponível` : "",
      ].filter(Boolean);
      return `• ${eventLabel(event)} — ${issues.join(" · ") || "requer atenção"}.`;
    });

    return {
      answer: `Encontrei ${attention.length + withoutAssignments.length} culto${attention.length + withoutAssignments.length === 1 ? "" : "s"} que merecem atenção:\n${lines.join("\n")}`,
      usedTools: ["get_operational_summary"],
    };
  }

  const nextEvent = summary.events[0];

  if (wantsConfirmed || wantsPending) {
    const team = asTeam(
      await toolExecutor("get_event_team", { eventId: nextEvent.id }, context)
    );
    if (!team) throw new Error("direct_team_invalid");

    const people = wantsConfirmed
      ? team.people.filter((person) => ["confirmado", "presente"].includes(person.status))
      : team.people.filter((person) => pendingStatus(person.status));

    if (people.length === 0) {
      return {
        answer: wantsConfirmed
          ? `No próximo culto — ${eventLabel(team.event)} — ainda não há ninguém confirmado em ${context.ministryName}.`
          : `No próximo culto — ${eventLabel(team.event)} — não há pendências de confirmação na equipe de ${context.ministryName}.`,
        usedTools: ["get_operational_summary", "get_event_team"],
      };
    }

    const lines = people.map((person) =>
      wantsConfirmed
        ? `• ${person.name} — ${person.roleName}`
        : `• ${person.name} — ${person.roleName} · ${person.statusLabel}`
    );

    return {
      answer: wantsConfirmed
        ? `Confirmados no próximo culto — ${eventLabel(team.event)}:\n${lines.join("\n")}`
        : `Pendências no próximo culto — ${eventLabel(team.event)}:\n${lines.join("\n")}`,
      usedTools: ["get_operational_summary", "get_event_team"],
    };
  }

  const availability = asAvailability(
    await toolExecutor("get_event_availability", { eventId: nextEvent.id }, context)
  );
  if (!availability) throw new Error("direct_availability_invalid");

  const unavailable = availability.people.filter((person) => person.status === "unavailable");
  if (unavailable.length === 0) {
    return {
      answer: `No próximo culto — ${eventLabel(availability.event)} — ninguém da equipe de ${context.ministryName} está marcado como indisponível.`,
      usedTools: ["get_operational_summary", "get_event_availability"],
    };
  }

  return {
    answer: `Indisponíveis no próximo culto — ${eventLabel(availability.event)}:\n${unavailable
      .map((person) => `• ${person.name}${person.role ? ` — ${person.role}` : ""}`)
      .join("\n")}`,
    usedTools: ["get_operational_summary", "get_event_availability"],
  };
}
