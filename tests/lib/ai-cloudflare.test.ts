import { describe, expect, it } from "vitest";
import {
  extractWorkersAiText,
  normalizeWorkersAiTurnForTools,
  parseWorkersAiTurn,
} from "@/lib/ai/cloudflare";

describe("Cloudflare Workers AI provider", () => {
  it("extrai resposta textual do formato response", () => {
    expect(extractWorkersAiText({ response: "  OK  " })).toBe("OK");
  });

  it("extrai resposta textual simples", () => {
    expect(extractWorkersAiText("  resumo  ")).toBe("resumo");
  });

  it("normaliza tool call do binding direto", () => {
    const turn = parseWorkersAiTurn({
      tool_calls: [
        {
          name: "get_event_team",
          arguments: { eventId: "11111111-1111-4111-8111-111111111111" },
        },
      ],
    });

    expect(turn.text).toBe("");
    expect(turn.toolCalls).toEqual([
      {
        id: "tool-1",
        name: "get_event_team",
        arguments: { eventId: "11111111-1111-4111-8111-111111111111" },
      },
    ]);
  });

  it("normaliza formato compatível com Chat Completions", () => {
    const turn = parseWorkersAiTurn({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: "call_1",
                function: {
                  name: "get_operational_summary",
                  arguments: '{"limit":4}',
                },
              },
            ],
          },
        },
      ],
    });

    expect(turn.toolCalls[0]).toEqual({
      id: "call_1",
      name: "get_operational_summary",
      arguments: { limit: 4 },
    });
  });

  it("recupera tool call que o modelo devolveu serializada em response", () => {
    const turn = normalizeWorkersAiTurnForTools(
      parseWorkersAiTurn({
        response:
          '{"name":"get_team_workload_insights","arguments":{"historyDays":14,"ministryId":"6325c147-de7b-41d3-b67a-c3d8cf0b92af","limit":8}}',
      }),
      [
        {
          name: "get_team_workload_insights",
          description: "Analisa carga recente do time",
          parameters: { type: "object" },
        },
      ]
    );

    expect(turn.text).toBe("");
    expect(turn.toolCalls).toEqual([
      {
        id: "tool-1",
        name: "get_team_workload_insights",
        arguments: {
          historyDays: 14,
          ministryId: "6325c147-de7b-41d3-b67a-c3d8cf0b92af",
          limit: 8,
        },
      },
    ]);
  });

  it("recupera tool call serializada dentro de bloco JSON", () => {
    const turn = normalizeWorkersAiTurnForTools(
      parseWorkersAiTurn({
        response:
          '```json\n{"name":"get_event_team","arguments":{"eventId":"11111111-1111-4111-8111-111111111111"}}\n```',
      }),
      [
        {
          name: "get_event_team",
          description: "Consulta equipe",
          parameters: { type: "object" },
        },
      ]
    );

    expect(turn.text).toBe("");
    expect(turn.toolCalls[0]).toMatchObject({
      name: "get_event_team",
      arguments: { eventId: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("não converte JSON textual quando a ferramenta não foi oferecida", () => {
    const raw =
      '{"name":"get_team_workload_insights","arguments":{"historyDays":14}}';
    const turn = normalizeWorkersAiTurnForTools(
      parseWorkersAiTurn({ response: raw }),
      [
        {
          name: "get_event_team",
          description: "Consulta equipe",
          parameters: { type: "object" },
        },
      ]
    );

    expect(turn.text).toBe(raw);
    expect(turn.toolCalls).toEqual([]);
  });

  it("retorna vazio para payload inesperado", () => {
    expect(extractWorkersAiText({ foo: "bar" })).toBe("");
    expect(extractWorkersAiText(null)).toBe("");
  });
});
