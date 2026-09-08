import { isKidsMinistryName } from "@/lib/ai/kids";
import type { SchedulingContext } from "@/lib/ai/scheduling";
import { loadOperationalSummary } from "@/lib/operational-summary-server";

export type AssistantMinistryScope = {
  id: string;
  name: string;
};

export type AppAwareAssistantContext = SchedulingContext & {
  allowedMinistries?: AssistantMinistryScope[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function ministryCapability(name: string) {
  const normalized = normalize(name);
  if (isKidsMinistryName(name)) return "kids" as const;
  if (
    normalized.includes("louvor") ||
    normalized.includes("worship") ||
    normalized.includes("musica")
  ) {
    return "worship" as const;
  }
  return "ministry" as const;
}

export function listAssistantMinistries(context: SchedulingContext) {
  const appContext = context as AppAwareAssistantContext;
  const configured = appContext.allowedMinistries ?? [];
  const ministries = configured.length
    ? configured
    : [{ id: context.ministryId, name: context.ministryName }];

  const unique = new Map<string, AssistantMinistryScope>();
  for (const ministry of ministries) unique.set(ministry.id, ministry);
  if (!unique.has(context.ministryId)) {
    unique.set(context.ministryId, {
      id: context.ministryId,
      name: context.ministryName,
    });
  }
  return [...unique.values()];
}

export function resolveAssistantMinistryContext(
  context: SchedulingContext,
  ministryId?: string
): SchedulingContext {
  if (!ministryId || ministryId === context.ministryId) return context;

  const target = listAssistantMinistries(context).find(
    (ministry) => ministry.id === ministryId
  );
  if (!target) throw new Error("ministry_scope_forbidden");

  return {
    ...context,
    ministryId: target.id,
    ministryName: target.name,
  };
}

export function assistantScopeDescription(context: SchedulingContext) {
  const ministries = listAssistantMinistries(context);
  return [
    `Contexto visual atual: ${context.ministryName}.`,
    "O contexto visual é somente uma pista de relevância, não limita o Assistente LUNOR.",
    `Ministérios que este usuário pode gerenciar e que podem ser consultados: ${ministries
      .map((ministry) => `${ministry.name} (${ministry.id})`)
      .join(", ")}.`,
  ].join("\n");
}

export function getAssistantAppContext(context: SchedulingContext) {
  return {
    kind: "app_context" as const,
    currentMinistry: {
      id: context.ministryId,
      name: context.ministryName,
    },
    ministries: listAssistantMinistries(context).map((ministry) => ({
      ...ministry,
      capability: ministryCapability(ministry.name),
      current: ministry.id === context.ministryId,
    })),
    guidance:
      "O ministério atual é apenas contexto visual. Use o ministryId retornado para consultar outro ministério quando a pergunta atravessar módulos.",
  };
}

export async function getAssistantAppOperationalOverview(
  context: SchedulingContext,
  input: { eventLimit?: number } = {}
) {
  const eventLimit = Math.min(Math.max(input.eventLimit ?? 2, 1), 4);
  const ministries = listAssistantMinistries(context);

  const results = await Promise.all(
    ministries.map(async (ministry) => {
      const target = resolveAssistantMinistryContext(context, ministry.id);
      try {
        const summary = await loadOperationalSummary({
          churchId: target.churchId,
          ministryId: target.ministryId,
          ministryName: target.ministryName,
          limit: eventLimit,
        });
        return {
          ministry: {
            id: ministry.id,
            name: ministry.name,
            capability: ministryCapability(ministry.name),
          },
          available: true as const,
          totals: summary.totals,
          events: summary.events.map((event) => ({
            id: event.id,
            title: event.title,
            startsAt: event.startsAt,
            readiness: event.readiness,
            assignments: event.assignments,
            availability: event.availability,
          })),
        };
      } catch {
        return {
          ministry: {
            id: ministry.id,
            name: ministry.name,
            capability: ministryCapability(ministry.name),
          },
          available: false as const,
          totals: null,
          events: [],
        };
      }
    })
  );

  return {
    kind: "app_operational_overview" as const,
    currentMinistryId: context.ministryId,
    ministries: results,
    attentionMinistries: results.filter(
      (item) =>
        item.available &&
        item.totals &&
        (item.totals.eventsAttention > 0 || item.totals.eventsWithoutAssignments > 0)
    ).length,
  };
}
