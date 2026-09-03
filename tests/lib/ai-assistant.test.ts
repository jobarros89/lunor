import { describe, expect, it, vi } from "vitest";
import { runLunorAssistant } from "@/lib/ai/assistant";

describe("runLunorAssistant", () => {
  it("executa ferramenta e responde com o resultado", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          {
            id: "call-1",
            name: "get_operational_summary",
            arguments: { limit: 2 },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Há 1 culto em atenção.",
        toolCalls: [],
      });
    const toolExecutor = vi.fn().mockResolvedValue({
      totals: { eventsAttention: 1 },
    });

    const result = await runLunorAssistant({
      question: "O que precisa de atenção?",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Louvor",
      },
      runner,
      toolExecutor,
    });

    expect(toolExecutor).toHaveBeenCalledWith(
      "get_operational_summary",
      { limit: 2 },
      expect.objectContaining({ ministryName: "Louvor" })
    );
    expect(result.answer).toBe("Há 1 culto em atenção.");
    expect(result.usedTools).toEqual(["get_operational_summary"]);
    expect(result.proposals).toEqual([]);

    const secondCall = runner.mock.calls[1]?.[0];
    const assistantToolCall = secondCall.messages.find(
      (message: { role: string }) => message.role === "assistant"
    );
    const toolResult = secondCall.messages.find(
      (message: { role: string }) => message.role === "tool"
    );

    expect(JSON.parse(assistantToolCall.content)).toEqual({
      name: "get_operational_summary",
      arguments: { limit: 2 },
    });
    expect(toolResult).toEqual({
      role: "tool",
      content: JSON.stringify({ ok: true, data: { totals: { eventsAttention: 1 } } }),
    });
  });

  it("não chama ferramenta quando o modelo já tem resposta não factual", async () => {
    const runner = vi.fn().mockResolvedValue({
      text: "Posso consultar escalas, confirmações e disponibilidade.",
      toolCalls: [],
    });
    const toolExecutor = vi.fn();

    const result = await runLunorAssistant({
      question: "O que você consegue fazer?",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Kids",
      },
      runner,
      toolExecutor,
    });

    expect(result.answer).toContain("consultar");
    expect(result.proposals).toEqual([]);
    expect(toolExecutor).not.toHaveBeenCalled();
  });

  it("retorna proposta revisável sem gravar a escala automaticamente", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          {
            id: "call-2",
            name: "propose_assignment",
            arguments: {
              eventId: "11111111-1111-4111-8111-111111111111",
              userId: "22222222-2222-4222-8222-222222222222",
              roleName: "Baixo",
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Preparei uma sugestão para sua revisão.",
        toolCalls: [],
      });
    const proposal = {
      kind: "assignment" as const,
      eventId: "11111111-1111-4111-8111-111111111111",
      eventTitle: "Culto de Domingo",
      startsAt: "2026-09-06T10:30:00.000Z",
      userId: "22222222-2222-4222-8222-222222222222",
      userName: "Pessoa Teste",
      roleName: "Baixo",
      departmentId: null,
      departmentName: null,
      availability: "available" as const,
      availabilityLabel: "Disponível",
      rationale: "Disponível",
    };
    const toolExecutor = vi.fn().mockResolvedValue(proposal);

    const result = await runLunorAssistant({
      question: "Sugira alguém para o baixo",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Louvor",
      },
      runner,
      toolExecutor,
    });

    expect(result.proposals).toEqual([proposal]);
    expect(result.usedTools).toEqual(["propose_assignment"]);
    expect(toolExecutor).toHaveBeenCalledTimes(1);
  });

  it("coleta todas as sugestões do rascunho completo e informa o modelo usado", async () => {
    const proposal = {
      kind: "assignment" as const,
      eventId: "11111111-1111-4111-8111-111111111111",
      eventTitle: "Culto",
      startsAt: "2026-09-06T10:30:00.000Z",
      userId: "22222222-2222-4222-8222-222222222222",
      userName: "Pessoa Teste",
      roleName: "Bateria",
      departmentId: null,
      departmentName: null,
      availability: "available" as const,
      availabilityLabel: "Disponível",
      rationale: "Disponível",
    };
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          {
            id: "call-draft",
            name: "draft_schedule_from_previous_service",
            arguments: { eventId: proposal.eventId },
          },
        ],
        model: "fallback-model",
      })
      .mockResolvedValueOnce({
        text: "Preparei o rascunho.",
        toolCalls: [],
        model: "fallback-model",
      });
    const toolExecutor = vi.fn().mockResolvedValue({
      kind: "schedule_draft",
      event: { id: proposal.eventId, title: "Culto", startsAt: proposal.startsAt },
      referenceEvent: { id: "ref", title: "Culto anterior", startsAt: "2026-08-30T10:30:00.000Z" },
      proposals: [proposal],
      skippedRoles: [],
    });

    const result = await runLunorAssistant({
      question: "Monte a escala completa",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Louvor",
      },
      runner,
      toolExecutor,
    });

    expect(result.proposals).toEqual([proposal]);
    expect(result.usedTools).toEqual(["draft_schedule_from_previous_service"]);
    expect(result.model).toBe("fallback-model");
  });
});
