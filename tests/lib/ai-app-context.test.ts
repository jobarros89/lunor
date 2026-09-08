import { describe, expect, it, vi } from "vitest";
import {
  getAssistantAppContext,
  listAssistantMinistries,
  resolveAssistantMinistryContext,
} from "@/lib/ai/app-context";
import { runLunorAssistant } from "@/lib/ai/assistant";
import { executeInternalAiTool, internalAiTools } from "@/lib/ai/internal-tools";

describe("Assistente LUNOR transversal", () => {
  const context = {
    churchId: "church-1",
    ministryId: "11111111-1111-4111-8111-111111111111",
    ministryName: "Kids",
    allowedMinistries: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Kids",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Louvor",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Mídia",
      },
    ],
  };

  it("trata o ministério atual como contexto e lista todos os ministérios autorizados", () => {
    expect(listAssistantMinistries(context)).toEqual(context.allowedMinistries);

    const appContext = getAssistantAppContext(context);
    expect(appContext.currentMinistry.name).toBe("Kids");
    expect(appContext.ministries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Kids", capability: "kids", current: true }),
        expect.objectContaining({ name: "Louvor", capability: "worship", current: false }),
        expect.objectContaining({ name: "Mídia", capability: "ministry", current: false }),
      ])
    );
  });

  it("permite trocar o contexto somente para um ministério autorizado", () => {
    const worship = resolveAssistantMinistryContext(
      context,
      "22222222-2222-4222-8222-222222222222"
    );
    expect(worship.ministryName).toBe("Louvor");
    expect(worship.churchId).toBe("church-1");

    expect(() =>
      resolveAssistantMinistryContext(
        context,
        "99999999-9999-4999-8999-999999999999"
      )
    ).toThrow("ministry_scope_forbidden");
  });

  it("expõe ferramentas internas para visão global, insights e consultas entre ministérios", () => {
    const names = internalAiTools().map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "get_app_context",
        "get_app_operational_overview",
        "get_leadership_insights",
        "get_team_workload_insights",
        "get_ministry_operational_summary",
        "get_ministry_event_team",
        "get_ministry_event_availability",
      ])
    );
  });

  it("get_app_context não consulta banco e preserva somente o escopo autorizado", async () => {
    const result = await executeInternalAiTool("get_app_context", {}, context);
    expect(result).toEqual(
      expect.objectContaining({
        kind: "app_context",
        ministries: expect.arrayContaining([
          expect.objectContaining({ name: "Kids" }),
          expect.objectContaining({ name: "Louvor" }),
        ]),
      })
    );
  });

  it("informa ao modelo que a tela atual não limita o Assistente LUNOR", async () => {
    const runner = vi.fn().mockResolvedValue({
      text: "Posso consultar os módulos autorizados do LUNOR.",
      toolCalls: [],
    });

    await runLunorAssistant({
      question: "Como está a igreja como um todo?",
      context,
      runner,
    });

    const system = runner.mock.calls[0]?.[0]?.messages?.[0]?.content as string;
    expect(system).toContain("um único copiloto operacional da aplicação inteira");
    expect(system).toContain("NÃO limita");
    expect(system).toContain("Kids (11111111-1111-4111-8111-111111111111)");
    expect(system).toContain("Louvor (22222222-2222-4222-8222-222222222222)");
  });
});
