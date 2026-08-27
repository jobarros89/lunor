import { describe, expect, it } from "vitest";
import { extractLyricsFromChordPro } from "@/lib/music/import/extract-lyrics";

describe("extractLyricsFromChordPro", () => {
  it("remove acordes inline e preserva seções", () => {
    const chart = [
      "{start_of_verse: Verso 1}",
      "[C]Grande é o Senhor [G/B]sobre a terra",
      "{end_of_verse}",
      "{start_of_chorus: Refrão}",
      "[Am]Digno de [F]louvor",
      "{end_of_chorus}",
    ].join("\n");

    expect(extractLyricsFromChordPro(chart)).toBe(
      ["Verso 1", "Grande é o Senhor sobre a terra", "", "Refrão", "Digno de louvor"].join("\n")
    );
  });

  it("ignora grids puramente instrumentais", () => {
    const chart = [
      "{comment: Introdução}",
      "{start_of_grid}",
      "C G Am F",
      "{end_of_grid}",
      "{start_of_verse: Verso}",
      "[C]Eu canto",
      "{end_of_verse}",
    ].join("\n");

    expect(extractLyricsFromChordPro(chart)).toBe(
      ["Introdução", "", "Verso", "Eu canto"].join("\n")
    );
  });

  it("ignora metadados ChordPro", () => {
    const chart = [
      "{title: Música}",
      "{artist: Banda}",
      "{key: C}",
      "[C]Linha da letra",
    ].join("\n");

    expect(extractLyricsFromChordPro(chart)).toBe("Linha da letra");
  });
});
