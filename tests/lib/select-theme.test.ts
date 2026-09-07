import { describe, expect, it } from "vitest";
import { rotateTheme } from "@/lib/bible/select-theme";
import { VERSE_THEMES, isVerseTheme } from "@/lib/bible/references";

describe("rotateTheme", () => {
  it("devolve sempre um tema válido do acervo", () => {
    for (const date of ["2026-01-01", "2026-06-15", "2026-09-05", "2026-12-31"]) {
      expect(isVerseTheme(rotateTheme(date))).toBe(true);
    }
  });

  it("é estável dentro da mesma semana", () => {
    expect(rotateTheme("2026-09-07")).toBe(rotateTheme("2026-09-08"));
  });

  it("percorre todos os temas ao longo do ano", () => {
    const seen = new Set<string>();
    for (let week = 0; week < 60; week++) {
      const date = new Date(Date.UTC(2026, 0, 1 + week * 7)).toISOString().slice(0, 10);
      seen.add(rotateTheme(date));
    }
    expect(seen.size).toBe(VERSE_THEMES.length);
  });
});
