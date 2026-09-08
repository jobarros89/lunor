import { describe, expect, it } from "vitest";
import { buildLeadershipInsights } from "@/lib/ai/leadership-insights";

describe("insights de liderança", () => {
  it("prioriza ausência de escala, substituição e indisponibilidade", () => {
    const overview = {
      kind: "app_operational_overview" as const,
      currentMinistryId: "kids",
      attentionMinistries: 2,
      ministries: [
        {
          ministry: { id: "kids", name: "Kids", capability: "kids" as const },
          available: true as const,
          totals: {
            upcomingEvents: 1,
            activeMembers: 4,
            assignments: 0,
            confirmedAssignments: 0,
            eventsReady: 0,
            eventsAttention: 0,
            eventsWithoutAssignments: 1,
          },
          events: [
            {
              id: "event-kids",
              title: "Culto Kids",
              startsAt: "2026-09-13T12:00:00.000Z",
              readiness: "no_assignments" as const,
              assignments: {
                total: 0,
                confirmed: 0,
                awaitingConfirmation: 0,
                wantsLeader: 0,
                substitutionNeeded: 0,
                absent: 0,
                assignedUnavailable: 0,
              },
              availability: {
                totalMembers: 4,
                available: 2,
                unavailable: 0,
                unknown: 2,
              },
            },
          ],
        },
        {
          ministry: { id: "worship", name: "Louvor", capability: "worship" as const },
          available: true as const,
          totals: {
            upcomingEvents: 1,
            activeMembers: 6,
            assignments: 4,
            confirmedAssignments: 1,
            eventsReady: 0,
            eventsAttention: 1,
            eventsWithoutAssignments: 0,
          },
          events: [
            {
              id: "event-worship",
              title: "Culto de Domingo",
              startsAt: "2026-09-13T13:00:00.000Z",
              readiness: "attention" as const,
              assignments: {
                total: 4,
                confirmed: 1,
                awaitingConfirmation: 3,
                wantsLeader: 0,
                substitutionNeeded: 1,
                absent: 0,
                assignedUnavailable: 1,
              },
              availability: {
                totalMembers: 6,
                available: 3,
                unavailable: 1,
                unknown: 2,
              },
            },
          ],
        },
      ],
    };

    const result = buildLeadershipInsights(overview, { limit: 12 });
    const ids = result.insights.map((item) => item.id);

    expect(ids).toContain("kids:event-kids:no-assignments");
    expect(ids).toContain("worship:event-worship:substitution");
    expect(ids).toContain("worship:event-worship:assigned-unavailable");
    expect(ids).toContain("worship:event-worship:low-confirmation");
    expect(result.summary.critical).toBeGreaterThanOrEqual(3);
    expect(result.insights[0]?.severity).toBe("critical");
  });

  it("retorna um sinal estável quando não encontra pendências", () => {
    const overview = {
      kind: "app_operational_overview" as const,
      currentMinistryId: "worship",
      attentionMinistries: 0,
      ministries: [
        {
          ministry: { id: "worship", name: "Louvor", capability: "worship" as const },
          available: true as const,
          totals: {
            upcomingEvents: 1,
            activeMembers: 6,
            assignments: 4,
            confirmedAssignments: 4,
            eventsReady: 1,
            eventsAttention: 0,
            eventsWithoutAssignments: 0,
          },
          events: [
            {
              id: "event-worship",
              title: "Culto de Domingo",
              startsAt: "2026-09-13T13:00:00.000Z",
              readiness: "ready" as const,
              assignments: {
                total: 4,
                confirmed: 4,
                awaitingConfirmation: 0,
                wantsLeader: 0,
                substitutionNeeded: 0,
                absent: 0,
                assignedUnavailable: 0,
              },
              availability: {
                totalMembers: 6,
                available: 5,
                unavailable: 1,
                unknown: 0,
              },
            },
          ],
        },
      ],
    };

    const result = buildLeadershipInsights(overview);
    expect(result.insights).toHaveLength(1);
    expect(result.insights[0]).toEqual(
      expect.objectContaining({
        severity: "info",
        title: "Nenhum alerta operacional relevante",
      })
    );
  });
});
