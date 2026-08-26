import { describe, expect, it } from "vitest";
import { transposeChordChart } from "@/lib/music/transpose";

describe("transposeChordChart", () => {
  it("transpõe C para D", () => {
    expect(transposeChordChart("C G Am F", "C", "D")).toBe("D A Bm G");
  });

  it("transpõe D para C", () => {
    expect(transposeChordChart("D A Bm G", "D", "C")).toBe("C G Am F");
  });

  it("preserva acordes menores", () => {
    expect(transposeChordChart("Am Dm Em", "C", "D")).toBe("Bm Em F#m");
  });

  it("aceita tonalidades menores como origem e destino", () => {
    expect(transposeChordChart("Cm Fm G", "Cm", "Dm")).toBe("Dm Gm A");
  });

  it("suporta sustenidos", () => {
    expect(transposeChordChart("C# F#m G#", "C#", "D#")).toBe("D# G#m A#");
  });

  it("prefere bemóis quando o destino usa bemol", () => {
    expect(transposeChordChart("C G Am", "C", "Db")).toBe("Db Ab Bbm");
  });

  it("transpõe a raiz e o baixo de acordes slash", () => {
    expect(transposeChordChart("D/F# G A Bm", "D", "E")).toBe(
      "E/G# A B C#m"
    );
  });

  it("preserva extensões e modificadores", () => {
    expect(
      transposeChordChart("Cmaj7 Am7 Dsus4 G7 Asus4", "C", "D")
    ).toBe("Dmaj7 Bm7 Esus4 A7 Bsus4");
  });

  it("transpõe acordes na mesma linha de um marcador de seção", () => {
    expect(transposeChordChart("[Intro] C  G  Am F", "C", "D")).toBe(
      "[Intro] D  A  Bm G"
    );
    expect(transposeChordChart("Refrão: C G Am F", "C", "D")).toBe(
      "Refrão: D A Bm G"
    );
  });

  it("atualiza a declaração de tom da cifra", () => {
    expect(transposeChordChart("Tom: C", "C", "D")).toBe("Tom: D");
    expect(transposeChordChart("  Key : Cm  ", "Cm", "Dm")).toBe(
      "  Key : Dm  "
    );
  });

  it("transpõe acordes inline e a tonalidade em CHORDPRO", () => {
    const chart = "{key: C}\n[C]Eu olho para a [G/B]cruz";
    expect(transposeChordChart(chart, "C", "D")).toBe(
      "{key: D}\n[D]Eu olho para a [A/C#]cruz"
    );
  });

  it("não altera texto normal da letra nem títulos de seção", () => {
    const chart = [
      "[Verso]",
      "C",
      "Grande é o Senhor",
      "G/B",
      "Digno de louvor",
      "Intro",
      "2x",
      "N.C.",
    ].join("\n");

    expect(transposeChordChart(chart, "C", "D")).toBe(
      [
        "[Verso]",
        "D",
        "Grande é o Senhor",
        "A/C#",
        "Digno de louvor",
        "Intro",
        "2x",
        "N.C.",
      ].join("\n")
    );
  });

  it("não confunde títulos entre colchetes com acordes CHORDPRO", () => {
    const chart = "[Ponte]\n[C]Canto [Am]outra vez";
    expect(transposeChordChart(chart, "C", "D")).toBe(
      "[Ponte]\n[D]Canto [Bm]outra vez"
    );
  });

  it("mantém a cifra idêntica quando origem e destino são iguais", () => {
    const chart = "[Refrão]\nC   G/B\nGrande é o Senhor";
    expect(transposeChordChart(chart, "C", "C")).toBe(chart);
  });

  it("mantém cifra vazia", () => {
    expect(transposeChordChart("", "C", "D")).toBe("");
  });
});
