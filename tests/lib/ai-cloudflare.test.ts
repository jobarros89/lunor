import { describe, expect, it } from "vitest";
import { extractWorkersAiText } from "@/lib/ai/cloudflare";

describe("Cloudflare Workers AI provider", () => {
  it("extrai resposta textual do formato response", () => {
    expect(extractWorkersAiText({ response: "  OK  " })).toBe("OK");
  });

  it("extrai resposta textual simples", () => {
    expect(extractWorkersAiText("  resumo  ")).toBe("resumo");
  });

  it("retorna vazio para payload inesperado", () => {
    expect(extractWorkersAiText({ foo: "bar" })).toBe("");
    expect(extractWorkersAiText(null)).toBe("");
  });
});
