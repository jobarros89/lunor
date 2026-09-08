import { describe, expect, it } from "vitest";
import { classifyAssistantRequest } from "@/lib/ai/intent-router";

describe("roteador de intenção do Assistente LUNOR", () => {
  const currentMinistryId = "11111111-1111-4111-8111-111111111111";
  const allowedMinistries = [
    { id: currentMinistryId, name: "Kids" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Louvor" },
    { id: "33333333-3333-4333-8333-333333333333", name: "Mídia" },
  ];

  function route(question: string) {
    return classifyAssistantRequest({
      question,
      currentMinistryId,
      allowedMinistries,
    });
  }

  it("mantém consultas factuais locais no caminho determinístico", () => {
    expect(route("Quem está disponível no próximo culto?")).toEqual(
      expect.objectContaining({
        intent: "lookup",
        scope: "local",
        strategy: "direct_lookup",
        needsLeadershipInsights: false,
      })
    );

    expect(route("Qual o repertório do próximo culto?")).toEqual(
      expect.objectContaining({
        intent: "lookup",
        strategy: "direct_lookup",
      })
    );

    expect(route("Quem falta confirmar?")).toEqual(
      expect.objectContaining({
        intent: "lookup",
        strategy: "direct_lookup",
      })
    );
  });

  it("manda análises de carga e prioridade para o orquestrador com insights", () => {
    expect(route("Quem está sendo muito escalado ultimamente?")).toEqual(
      expect.objectContaining({
        intent: "analysis",
        strategy: "orchestrator",
        needsLeadershipInsights: true,
      })
    );

    expect(route("Quais são os maiores riscos e prioridades agora?")).toEqual(
      expect.objectContaining({
        intent: "analysis",
        strategy: "orchestrator",
        needsLeadershipInsights: true,
      })
    );
  });

  it("identifica planejamento sem confundir simples leitura de repertório", () => {
    expect(route("Monte um repertório para domingo")).toEqual(
      expect.objectContaining({
        intent: "plan",
        strategy: "orchestrator",
      })
    );
  });

  it("trata pedido de escrita como ação confirmável", () => {
    expect(route("Confirme a escala de domingo")).toEqual(
      expect.objectContaining({
        intent: "action",
        strategy: "orchestrator",
      })
    );
  });

  it("detecta outro ministério mesmo quando a pergunta parece simples", () => {
    const result = route("Como está o Louvor?");
    expect(result.scope).toBe("cross_module");
    expect(result.strategy).toBe("orchestrator");
    expect(result.reasons).toContain(
      "other_ministry:22222222-2222-4222-8222-222222222222"
    );
  });

  it("trata panorama da igreja como visão global de liderança", () => {
    expect(route("Como está a igreja como um todo?")).toEqual(
      expect.objectContaining({
        scope: "global",
        strategy: "orchestrator",
        needsLeadershipInsights: true,
      })
    );
  });
});
