import { describe, expect, it } from "vitest";

import { parseAppLocalDateTime } from "./local-datetime";

describe("parseAppLocalDateTime", () => {
  it("interpreta 10:25 em São Paulo como 13:25Z", () => {
    expect(parseAppLocalDateTime("2026-09-27T10:25")?.toISOString()).toBe(
      "2026-09-27T13:25:00.000Z"
    );
  });

  it("interpreta 09:00 em São Paulo como 12:00Z", () => {
    expect(parseAppLocalDateTime("2026-09-27T09:00")?.toISOString()).toBe(
      "2026-09-27T12:00:00.000Z"
    );
  });

  it("preserva valores que já possuem fuso explícito", () => {
    expect(parseAppLocalDateTime("2026-09-27T13:25:00.000Z")?.toISOString()).toBe(
      "2026-09-27T13:25:00.000Z"
    );
  });

  it("rejeita datas inválidas", () => {
    expect(parseAppLocalDateTime("2026-02-31T10:25")).toBeNull();
    expect(parseAppLocalDateTime("horario-invalido")).toBeNull();
  });
});
