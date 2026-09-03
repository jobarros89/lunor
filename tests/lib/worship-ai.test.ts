import { describe, expect, it } from "vitest";
import {
  buildWorshipTransitions,
  isWorshipMinistryName,
  keySemitoneDistance,
} from "@/lib/ai/worship";

describe("worship AI helpers", () => {
  it("reconhece contexto de Louvor sem depender de acentos", () => {
    expect(isWorshipMinistryName("Louvor")).toBe(true);
    expect(isWorshipMinistryName("Música")).toBe(true);
    expect(isWorshipMinistryName("Worship Team")).toBe(true);
    expect(isWorshipMinistryName("Kids")).toBe(false);
  });

  it("calcula a menor distância tonal entre raízes", () => {
    expect(keySemitoneDistance("C", "D")).toBe(2);
    expect(keySemitoneDistance("B", "C")).toBe(1);
    expect(keySemitoneDistance("F#m", "Gb")).toBe(0);
    expect(keySemitoneDistance(null, "G")).toBeNull();
  });

  it("classifica mudanças de tom e BPM sem rotular opinião musical", () => {
    const transitions = buildWorshipTransitions([
      { position: 1, title: "Primeira", effectiveKey: "G", bpm: 72 },
      { position: 2, title: "Segunda", effectiveKey: "A", bpm: 78 },
      { position: 3, title: "Terceira", effectiveKey: "Eb", bpm: 128 },
    ]);

    expect(transitions).toHaveLength(2);
    expect(transitions[0]).toMatchObject({
      fromTitle: "Primeira",
      toTitle: "Segunda",
      keyDistance: 2,
      keyChange: "near",
      bpmDelta: 6,
      tempoChange: "small",
    });
    expect(transitions[1]).toMatchObject({
      fromTitle: "Segunda",
      toTitle: "Terceira",
      keyDistance: 6,
      keyChange: "far",
      bpmDelta: 50,
      tempoChange: "large",
    });
  });
});
