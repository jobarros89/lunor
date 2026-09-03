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
    const secondCall = runner.mock.calls[1]?.[0];
    expect(secondCall.messages.some((message: { role: string }) => message.role === "tool")).toBe(true);
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
    expect(toolExecutor).not.toHaveBeenCalled();
  });
});
