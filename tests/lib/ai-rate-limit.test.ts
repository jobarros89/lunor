import { describe, expect, it } from "vitest";
import { checkRateLimit, DEFAULT_AI_RATE_LIMIT } from "@/lib/ai/rate-limit";

describe("checkRateLimit", () => {
  const baseTime = new Date("2026-09-04T18:00:00Z");
  const config = DEFAULT_AI_RATE_LIMIT; // 20 mensagens/hora

  it("permite requisição quando uso < limite", () => {
    const logs = [
      new Date("2026-09-04T17:55:00Z"),
      new Date("2026-09-04T17:50:00Z"),
      new Date("2026-09-04T17:45:00Z"),
    ]; // 3 requisições em 15min
    const result = checkRateLimit(logs, config, baseTime);
    expect(result.allowed).toBe(true);
  });

  it("nega requisição quando usa == limite", () => {
    const logs = Array.from({ length: 20 }, (_, i) => new Date(baseTime.getTime() - i * 60 * 1000));
    const result = checkRateLimit(logs, config, baseTime);
    expect(result.allowed).toBe(false);
  });

  it("calcula resetAt correto (quando a mais antiga sair da janela)", () => {
    const oldestRelevant = new Date("2026-09-04T17:00:10Z"); // 10 segundos de margem
    const logs = [
      new Date("2026-09-04T17:59:50Z"),
      ...Array.from({ length: 19 }, (_, i) => new Date(baseTime.getTime() - i * 60 * 1000)),
      oldestRelevant,
    ];
    const result = checkRateLimit(logs, config, baseTime);
    expect(result.allowed).toBe(false);
    // resetAt = oldestRelevant + 60min = 18:00:10
    if (!result.allowed) {
      expect(result.resetAt).toEqual(new Date("2026-09-04T18:00:10Z"));
    }
  });

  it("ignora logs fora da janela de 60 minutos", () => {
    const logsInside = Array.from({ length: 10 }, (_, i) => new Date(baseTime.getTime() - i * 60 * 1000));
    const logsOutside = [
      new Date("2026-09-04T16:59:00Z"), // 61 minutos atrás
      new Date("2026-09-04T16:00:00Z"), // 2 horas atrás
    ];
    const allLogs = [...logsInside, ...logsOutside];
    const result = checkRateLimit(allLogs, config, baseTime);
    // Só 10 dentro da janela < 20, então allow
    expect(result.allowed).toBe(true);
  });

  it("permite requisição com lista vazia", () => {
    const result = checkRateLimit([], config, baseTime);
    expect(result.allowed).toBe(true);
  });

  it("responde corretamente em diferentes config de limite", () => {
    const smallLimit = { maxMessagesPerHour: 5, windowMinutes: 60 };
    const logs = Array.from({ length: 5 }, (_, i) => new Date(baseTime.getTime() - i * 60 * 1000));
    const result = checkRateLimit(logs, smallLimit, baseTime);
    expect(result.allowed).toBe(false);
  });
});
