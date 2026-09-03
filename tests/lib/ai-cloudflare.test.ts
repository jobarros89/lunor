import { describe, expect, it } from "vitest";
import {
  extractWorkersAiText,
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

  it("retorna vazio para payload inesperado", () => {
    expect(extractWorkersAiText({ foo: "bar" })).toBe("");
    expect(extractWorkersAiText(null)).toBe("");
  });
});
