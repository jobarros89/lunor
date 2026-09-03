import { describe, expect, it, vi } from "vitest";
import { runDirectOperationalAnswer } from "@/lib/ai/direct-operational-answer";

const context = {
  churchId: "church-1",
  ministryId: "ministry-1",
  ministryName: "Kids",
};

const summary = {
  totals: {
    upcomingEvents: 1,
    eventsAttention: 0,
    eventsWithoutAssignments: 0,
  },
  events: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Culto de Domingo",
      startsAt: "2026-09-06T13:00:00.000Z",
      readiness: "ready",
      assignments: {
        total: 2,
        confirmed: 1,
        awaitingConfirmation: 1,
        wantsLeader: 0,
        substitutionNeeded: 0,
        absent: 0,
        assignedUnavailable: 0,
      },
    },
  ],
};

describe("runDirectOperationalAnswer", () => {
  it("responde quem confirmou o próximo culto sem chamar LLM", async () => {
    const executor = vi
      .fn()
      .mockResolvedValueOnce(summary)
      .mockResolvedValueOnce({
        event: summary.events[0],
        people: [
          {
            name: "Josué",
            roleName: "Líder",
            status: "confirmado",
            statusLabel: "Confirmado",
          },
          {
            name: "Pessoa Pendente",
            roleName: "Apoio",
            status: "convidado",
            statusLabel: "Aguardando confirmação",
          },
        ],
      });

    const result = await runDirectOperationalAnswer({
      question: "Quem confirmou o próximo culto?",
      context,
      toolExecutor: executor,
    });

    expect(result?.answer).toContain("Josué — Líder");
    expect(result?.answer).not.toContain("Pessoa Pendente");
    expect(result?.usedTools).toEqual(["get_operational_summary", "get_event_team"]);
  });

  it("responde indisponibilidade do próximo culto usando os dados resolvidos", async () => {
    const executor = vi
      .fn()
      .mockResolvedValueOnce(summary)
      .mockResolvedValueOnce({
        event: summary.events[0],
        people: [
          {
            name: "Pessoa A",
            role: "member",
            status: "unavailable",
            statusLabel: "Indisponível",
          },
          {
            name: "Pessoa B",
            role: "member",
            status: "available",
            statusLabel: "Disponível",
          },
        ],
      });

    const result = await runDirectOperationalAnswer({
      question: "Quem está indisponível para o próximo culto?",
      context,
      toolExecutor: executor,
    });

    expect(result?.answer).toContain("Pessoa A");
    expect(result?.answer).not.toContain("Pessoa B");
    expect(result?.usedTools).toEqual([
      "get_operational_summary",
      "get_event_availability",
    ]);
  });

  it("não intercepta perguntas livres que devem seguir para o LLM", async () => {
    const executor = vi.fn();
    const result = await runDirectOperationalAnswer({
      question: "Pode sugerir uma pessoa para o baixo?",
      context,
      toolExecutor: executor,
    });

    expect(result).toBeNull();
    expect(executor).not.toHaveBeenCalled();
  });
});
