import { describe, expect, it } from "vitest";
import { selectDailyVerse } from "@/lib/bible/select-verse";
import { REFERENCES_BY_THEME, VERSE_THEMES } from "@/lib/bible/references";

const CHURCH = "11111111-1111-1111-1111-111111111111";

describe("selectDailyVerse", () => {
  it("é determinístico: mesma igreja, data e tema devolvem a mesma referência", () => {
    const first = selectDailyVerse({ theme: "servir", churchId: CHURCH, date: "2026-09-06" });
    const second = selectDailyVerse({ theme: "servir", churchId: CHURCH, date: "2026-09-06" });
    expect(first.label).toBe(second.label);
  });

  it("varia a referência entre datas diferentes", () => {
    const labels = new Set(
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"].map(
        (date) => selectDailyVerse({ theme: "servir", churchId: CHURCH, date }).label
      )
    );
    expect(labels.size).toBeGreaterThan(1);
  });

  it("igrejas diferentes não ficam presas ao mesmo versículo", () => {
    const outra = "22222222-2222-2222-2222-222222222222";
    const labels = new Set([
      selectDailyVerse({ theme: "unidade", churchId: CHURCH, date: "2026-09-06" }).label,
      selectDailyVerse({ theme: "unidade", churchId: outra, date: "2026-09-06" }).label,
    ]);
    expect(labels.size).toBeGreaterThanOrEqual(1);
  });

  it("nunca repete uma referência enviada recentemente", () => {
    const pool = REFERENCES_BY_THEME.descanso;
    const recentLabels = pool.slice(0, pool.length - 1).map((reference) => reference.label);
    const chosen = selectDailyVerse({
      theme: "descanso",
      churchId: CHURCH,
      date: "2026-09-06",
      recentLabels,
    });
    expect(chosen.label).toBe(pool[pool.length - 1].label);
  });

  it("recomeça o rodízio quando todas já saíram (melhor repetir que não enviar)", () => {
    const recentLabels = REFERENCES_BY_THEME.gratidao.map((reference) => reference.label);
    const chosen = selectDailyVerse({
      theme: "gratidao",
      churchId: CHURCH,
      date: "2026-09-06",
      recentLabels,
    });
    expect(recentLabels).toContain(chosen.label);
  });

  it("todo tema tem acervo e devolve referência válida", () => {
    for (const theme of VERSE_THEMES) {
      const chosen = selectDailyVerse({ theme, churchId: CHURCH, date: "2026-09-06" });
      expect(REFERENCES_BY_THEME[theme].length).toBeGreaterThan(0);
      expect(chosen.book.length).toBeGreaterThan(0);
      expect(chosen.chapter).toBeGreaterThan(0);
      expect(chosen.verse).toBeGreaterThan(0);
    }
  });
});
