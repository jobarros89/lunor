import { describe, expect, it, vi } from "vitest";
import { runLunorAssistant } from "@/lib/ai/assistant";
import { internalAiTools } from "@/lib/ai/internal-tools";
import { isKidsMinistryName } from "@/lib/ai/kids";

describe("Kids + IA", () => {
  it("reconhece nomes do ministério Kids/Infantil", () => {
    expect(isKidsMinistryName("Kids")).toBe(true);
    expect(isKidsMinistryName("Infantil")).toBe(true);
    expect(isKidsMinistryName("Ministério de Crianças")).toBe(true);
    expect(isKidsMinistryName("Louvor")).toBe(false);
  });

  it("expõe insights do Kids somente como ferramenta interna e de leitura", () => {
    const tool = internalAiTools().find(
      (item) => item.name === "get_kids_operational_insights"
    );

    expect(tool).toBeDefined();
    expect(tool?.description).toContain("agregados");
    expect(tool?.description).toContain("Nunca retorna nomes");
    expect(tool?.description).toContain("Não altera dados");
  });

  it("permite consultar operação agregada do Kids sem gerar proposta de escrita", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          {
            id: "kids-call",
            name: "get_kids_operational_insights",
            arguments: { historyDays: 90 },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Há 12 crianças presentes, distribuídas em 4 turmas.",
        toolCalls: [],
      });

    const toolExecutor = vi.fn().mockResolvedValue({
      kind: "kids_operational_insights",
      privacy: { aggregatedOnly: true },
      registration: { activeChildren: 40 },
      session: { present: 12, classes: 4 },
      attention: [],
    });

    const result = await runLunorAssistant({
      question: "Como está a operação do Kids agora?",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Kids",
      },
      runner,
      toolExecutor,
    });

    expect(toolExecutor).toHaveBeenCalledWith(
      "get_kids_operational_insights",
      { historyDays: 90 },
      expect.objectContaining({ ministryName: "Kids" })
    );
    expect(result.usedTools).toEqual(["get_kids_operational_insights"]);
    expect(result.proposals).toEqual([]);
    expect(result.worshipSetlistProposals).toEqual([]);

    const firstCall = runner.mock.calls[0]?.[0];
    expect(
      firstCall.tools.some(
        (tool: { name: string }) => tool.name === "get_kids_operational_insights"
      )
    ).toBe(true);
    expect(firstCall.messages[0].content).toContain("Dados do Kids envolvem menores");
    expect(firstCall.messages[0].content).toContain("indicadores agregados");
  });
});
