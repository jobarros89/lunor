import { getAssistantAppOperationalOverview } from "@/lib/ai/app-context";
import type { SchedulingContext } from "@/lib/ai/scheduling";

export type LeadershipInsightSeverity = "critical" | "warning" | "info";
export type LeadershipInsightCategory =
  | "staffing"
  | "availability"
  | "confirmation"
  | "substitution"
  | "readiness";

export type LeadershipInsight = {
  id: string;
  severity: LeadershipInsightSeverity;
  category: LeadershipInsightCategory;
  ministry: { id: string; name: string };
  event?: { id: string; title: string; startsAt: string };
  title: string;
  detail: string;
  suggestedAction: string;
  evidence: Record<string, number | string | boolean | null>;
};

type AppOverview = Awaited<ReturnType<typeof getAssistantAppOperationalOverview>>;

const SEVERITY_WEIGHT: Record<LeadershipInsightSeverity, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function eventInsightId(ministryId: string, eventId: string, kind: string) {
  return `${ministryId}:${eventId}:${kind}`;
}

export function buildLeadershipInsights(
  overview: AppOverview,
  { limit = 8 }: { limit?: number } = {}
) {
  const insights: LeadershipInsight[] = [];

  for (const ministryItem of overview.ministries) {
    if (!ministryItem.available) continue;
    const ministry = {
      id: ministryItem.ministry.id,
      name: ministryItem.ministry.name,
    };

    for (const event of ministryItem.events) {
      const eventRef = {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
      };

      if (event.assignments.total === 0) {
        insights.push({
          id: eventInsightId(ministry.id, event.id, "no-assignments"),
          severity: "critical",
          category: "staffing",
          ministry,
          event: eventRef,
          title: "Culto ainda sem escala",
          detail: `${event.title} ainda não possui ninguém escalado em ${ministry.name}.`,
          suggestedAction:
            "Montar um rascunho de escala e revisar disponibilidade antes de convidar o time.",
          evidence: {
            assignments: 0,
            availableMembers: event.availability.available,
            unknownAvailability: event.availability.unknown,
          },
        });
      }

      if (event.assignments.substitutionNeeded > 0) {
        insights.push({
          id: eventInsightId(ministry.id, event.id, "substitution"),
          severity: "critical",
          category: "substitution",
          ministry,
          event: eventRef,
          title: "Substituição pendente",
          detail: `${event.assignments.substitutionNeeded} posição(ões) precisam de substituição em ${event.title}.`,
          suggestedAction:
            "Priorizar candidatos disponíveis para as funções afetadas e gerar propostas de substituição.",
          evidence: {
            substitutionNeeded: event.assignments.substitutionNeeded,
            assignments: event.assignments.total,
          },
        });
      }

      if (event.assignments.assignedUnavailable > 0) {
        insights.push({
          id: eventInsightId(ministry.id, event.id, "assigned-unavailable"),
          severity: "critical",
          category: "availability",
          ministry,
          event: eventRef,
          title: "Pessoa escalada marcou indisponibilidade",
          detail: `${event.assignments.assignedUnavailable} pessoa(s) da escala aparecem como indisponíveis para ${event.title}.`,
          suggestedAction:
            "Revisar essas posições antes do culto e buscar substitutos entre os disponíveis.",
          evidence: {
            assignedUnavailable: event.assignments.assignedUnavailable,
            availableMembers: event.availability.available,
          },
        });
      }

      const humanAttention = event.assignments.wantsLeader + event.assignments.absent;
      if (humanAttention > 0) {
        insights.push({
          id: eventInsightId(ministry.id, event.id, "leader-attention"),
          severity: "warning",
          category: "readiness",
          ministry,
          event: eventRef,
          title: "Há respostas que precisam da liderança",
          detail: `${humanAttention} resposta(s) exigem acompanhamento do líder em ${event.title}.`,
          suggestedAction:
            "Abrir a escala e resolver primeiro pedidos para falar com o líder e ausências registradas.",
          evidence: {
            wantsLeader: event.assignments.wantsLeader,
            absent: event.assignments.absent,
          },
        });
      }

      const confirmationRate = percentage(
        event.assignments.confirmed,
        event.assignments.total
      );
      if (
        event.assignments.total >= 2 &&
        event.assignments.awaitingConfirmation > 0 &&
        confirmationRate < 60
      ) {
        insights.push({
          id: eventInsightId(ministry.id, event.id, "low-confirmation"),
          severity: "warning",
          category: "confirmation",
          ministry,
          event: eventRef,
          title: "Confirmação da escala ainda baixa",
          detail: `Apenas ${confirmationRate}% das posições estão confirmadas em ${event.title}.`,
          suggestedAction:
            "Reforçar as confirmações agora para reduzir substituições de última hora.",
          evidence: {
            confirmationRate,
            confirmed: event.assignments.confirmed,
            awaitingConfirmation: event.assignments.awaitingConfirmation,
            assignments: event.assignments.total,
          },
        });
      }

      const unknownRate = percentage(
        event.availability.unknown,
        event.availability.totalMembers
      );
      if (
        event.availability.totalMembers >= 4 &&
        event.availability.unknown >= 2 &&
        unknownRate >= 50
      ) {
        insights.push({
          id: eventInsightId(ministry.id, event.id, "availability-unknown"),
          severity: "warning",
          category: "availability",
          ministry,
          event: eventRef,
          title: "Disponibilidade do time pouco conhecida",
          detail: `${unknownRate}% do time ainda não informou disponibilidade para ${event.title}.`,
          suggestedAction:
            "Solicitar disponibilidade antes de completar ou ajustar a escala.",
          evidence: {
            unknownRate,
            unknownAvailability: event.availability.unknown,
            totalMembers: event.availability.totalMembers,
          },
        });
      }
    }
  }

  insights.sort((a, b) => {
    const severityDiff = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (severityDiff !== 0) return severityDiff;
    const aDate = a.event?.startsAt ? new Date(a.event.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bDate = b.event?.startsAt ? new Date(b.event.startsAt).getTime() : Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  });

  if (insights.length === 0) {
    const firstAvailable = overview.ministries.find((item) => item.available);
    if (firstAvailable) {
      insights.push({
        id: "operation:stable",
        severity: "info",
        category: "readiness",
        ministry: {
          id: firstAvailable.ministry.id,
          name: firstAvailable.ministry.name,
        },
        title: "Nenhum alerta operacional relevante",
        detail:
          "Nos próximos cultos consultados, o LUNOR não encontrou pendências críticas de escala, confirmação ou disponibilidade.",
        suggestedAction:
          "Manter o acompanhamento das confirmações e revisar novamente conforme o próximo culto se aproxima.",
        evidence: {
          ministriesChecked: overview.ministries.filter((item) => item.available).length,
          attentionMinistries: overview.attentionMinistries,
        },
      });
    }
  }

  const selected = insights.slice(0, Math.min(Math.max(limit, 1), 12));
  const critical = selected.filter((item) => item.severity === "critical").length;
  const warning = selected.filter((item) => item.severity === "warning").length;
  const info = selected.filter((item) => item.severity === "info").length;

  return {
    kind: "leadership_insights" as const,
    generatedAt: new Date().toISOString(),
    summary: {
      critical,
      warning,
      info,
      attentionScore: critical * 5 + warning * 2 + info,
      ministriesWithOperationalAttention: overview.attentionMinistries,
    },
    insights: selected,
  };
}

export async function getLeadershipInsights(
  context: SchedulingContext,
  { eventLimit = 3, limit = 8 }: { eventLimit?: number; limit?: number } = {}
) {
  const overview = await getAssistantAppOperationalOverview(context, {
    eventLimit: Math.min(Math.max(eventLimit, 1), 4),
  });
  return buildLeadershipInsights(overview, {
    limit: Math.min(Math.max(limit, 1), 12),
  });
}
