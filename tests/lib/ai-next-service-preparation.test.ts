import { describe, expect, it } from "vitest";
import { classifyAssistantRequest } from "@/lib/ai/intent-router";
import { lunorAiTools } from "@/lib/ai/tools";

describe("Preparação inteligente do próximo culto", () => {
  const ministries = [
    { id: "11111111-1111-4111-8111-111111111111", name: "Louvor" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Kids" },
  ];

  it("expõe uma ferramenta dedicada e somente de leitura para preparar o próximo culto", () => {
    const tool = lunorAiTools().find((item) => item.name === "prepare_next_service");

    expect(tool).toBeDefined();
    expect(tool?.description).toContain("Prepare meu próximo culto");
    expect(tool?.parameters).toEqual(
      expect.objectContaining({
        type: "object",
        additionalProperties: false,
      })
    );
  });

  it("trata ‘Prepare meu próximo culto’ como planejamento e envia ao orquestrador", () => {
    const profile = classifyAssistantRequest({
      question: "Prepare meu próximo culto",
      currentMinistryId: ministries[0]!.id,
      allowedMinistries: ministries,
    });

    expect(profile.intent).toBe("plan");
    expect(profile.scope).toBe("local");
    expect(profile.strategy).toBe("orchestrator");
  });

  it("mantém consultas factuais simples no caminho rápido", () => {
    const profile = classifyAssistantRequest({
      question: "Quem está disponível domingo?",
      currentMinistryId: ministries[0]!.id,
      allowedMinistries: ministries,
    });

    expect(profile.intent).toBe("lookup");
    expect(profile.strategy).toBe("direct_lookup");
  });
});
