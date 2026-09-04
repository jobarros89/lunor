import { describe, expect, it } from "vitest";
import { alignmentFixPreservesLyrics } from "@/lib/music/import/validate-ai-alignment";

describe("alignmentFixPreservesLyrics", () => {
  it("aceita quando a IA só moveu a posição dos acordes", () => {
    const before = "{start_of_grid}\nC          G\n{end_of_grid}\nGrande é o Senhor";
    const after = "[C]Grande é [G]o Senhor";
    expect(alignmentFixPreservesLyrics(before, after)).toBe(true);
  });

  it("aceita diferença de espaçamento entre as palavras", () => {
    const before = "[C]Grande   é   [G]o Senhor";
    const after = "[C]Grande é [G]o Senhor";
    expect(alignmentFixPreservesLyrics(before, after)).toBe(true);
  });

  it("rejeita quando a IA troca uma palavra da letra", () => {
    const before = "[C]Grande é [G]o Senhor";
    const after = "[C]Imenso é [G]o Senhor";
    expect(alignmentFixPreservesLyrics(before, after)).toBe(false);
  });

  it("rejeita quando a IA remove uma linha inteira", () => {
    const before = "[C]Grande é o Senhor\n[G]Digno de louvor";
    const after = "[C]Grande é o Senhor";
    expect(alignmentFixPreservesLyrics(before, after)).toBe(false);
  });

  it("rejeita quando a IA acrescenta conteúdo que não existia", () => {
    const before = "[C]Grande é o Senhor";
    const after = "[C]Grande é o Senhor\n[G]Aleluia, aleluia";
    expect(alignmentFixPreservesLyrics(before, after)).toBe(false);
  });

  it("rejeita quando não sobra nenhuma letra reconhecível", () => {
    expect(alignmentFixPreservesLyrics("{start_of_grid}\nC G\n{end_of_grid}", "")).toBe(false);
  });
});
