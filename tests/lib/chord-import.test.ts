import { describe, expect, it } from "vitest";
import { parseChordChart } from "@/lib/music/import/parse-chord-chart";

const warningCodes = (content: string, filename?: string) =>
  parseChordChart({ content, filename }).warnings.map((warning) => warning.code);

describe("parseChordChart", () => {
  it("processa conteúdo ChordPro completo", () => {
    const content = [
      "{title: Bondade de Deus}",
      "{artist: Isaias Saad}",
      "{key: G}",
      "{tempo: 72}",
      "{time: 4/4}",
      "{start_of_verse: Verso 1}",
      "[G]Eu te amo, [C]Deus",
      "{end_of_verse}",
    ].join("\n");

    const parsed = parseChordChart({ content });

    expect(parsed.detectedFormat).toBe("CHORDPRO");
    expect(parsed.metadata).toEqual({
      title: "Bondade de Deus",
      artist: "Isaias Saad",
      key: "G",
      bpm: 72,
      timeSignature: "4/4",
    });
    expect(parsed.sections[0]).toMatchObject({
      type: "VERSE",
      label: "Verso 1",
      position: 0,
      content: "[G]Eu te amo, [C]Deus",
    });
    expect(parsed.chordProContent).toBe(content);
  });

  it("reconhece diretivas abreviadas", () => {
    const parsed = parseChordChart({
      content: "{t: Minha Canção}\n{sov}\n[C]Letra\n{eov}",
    });

    expect(parsed.metadata.title).toBe("Minha Canção");
    expect(parsed.sections).toHaveLength(1);
    expect(parsed.sections[0].type).toBe("VERSE");
    expect(parsed.warnings).toEqual([]);
  });

  it("detecta cifra comum e seções em português", () => {
    const content = [
      "Título: Grande é o Senhor",
      "Artista: Comunidade",
      "Tom: G",
      "BPM: 80",
      "Compasso: 4/4",
      "",
      "[Introdução]",
      "G  D/F#  Em  C",
      "",
      "Verso 2:",
      "G          D",
      "Grande é o Senhor",
      "",
      "Pré-Refrão:",
      "Em  C",
      "",
      "Refrão:",
      "G  D  C",
      "",
      "Ponte final:",
      "Am  C",
      "",
      "Instrumental:",
      "G  D",
      "",
      "Espontâneo:",
      "C",
      "",
      "Final:",
      "G",
    ].join("\n");

    const parsed = parseChordChart({ content, filename: "musica.txt" });

    expect(parsed.detectedFormat).toBe("PLAIN");
    expect(parsed.metadata).toMatchObject({
      title: "Grande é o Senhor",
      artist: "Comunidade",
      key: "G",
      bpm: 80,
      timeSignature: "4/4",
    });
    expect(parsed.sections.map((section) => section.type)).toEqual([
      "INTRO",
      "VERSE",
      "PRE_CHORUS",
      "CHORUS",
      "BRIDGE",
      "INSTRUMENTAL",
      "SPONTANEOUS",
      "ENDING",
    ]);
    expect(parsed.sections[1].label).toBe("Verso 2");
  });

  it("detecta seções em inglês", () => {
    const content = [
      "Intro:",
      "C G",
      "VERSE 1",
      "C",
      "Pre Chorus:",
      "Am F",
      "Chorus:",
      "C G",
      "Bridge:",
      "F G",
      "Solo:",
      "Am",
      "Spontaneous:",
      "F",
      "Outro:",
      "C",
    ].join("\n");

    expect(
      parseChordChart({ content }).sections.map((section) => section.type)
    ).toEqual([
      "INTRO",
      "VERSE",
      "PRE_CHORUS",
      "CHORUS",
      "BRIDGE",
      "INSTRUMENTAL",
      "SPONTANEOUS",
      "ENDING",
    ]);
  });

  it("preserva linha apenas com acordes em bloco de grade", () => {
    const parsed = parseChordChart({ content: "G  D/F#  Em  C" });

    expect(parsed.chordProContent).toBe(
      "{start_of_grid}\nG  D/F#  Em  C\n{end_of_grid}"
    );
  });

  it("posiciona acordes sobre a letra quando o alinhamento é determinístico", () => {
    const parsed = parseChordChart({
      content: "G          D\nGrande é o Senhor",
    });

    expect(parsed.chordProContent).toBe("[G]Grande é o [D]Senhor");
    expect(parsed.warnings).toEqual([]);
  });

  it("reconhece slash chords", () => {
    const parsed = parseChordChart({ content: "D/F#  G  A/C#  Bm7" });
    expect(parsed.chordProContent).toContain("D/F#  G  A/C#  Bm7");
    expect(parsed.warnings).toEqual([]);
  });

  it("reconhece sustenidos, bemóis e extensões", () => {
    const parsed = parseChordChart({
      content: "F#m7  Bbmaj7  C#sus4  Ebadd9  G7(b9)",
    });
    expect(parsed.chordProContent).toContain(
      "F#m7  Bbmaj7  C#sus4  Ebadd9  G7(b9)"
    );
    expect(parsed.warnings).toEqual([]);
  });

  it("não trata frases comuns iniciadas de A a G como acordes", () => {
    const content = "A graça de Deus me alcançou\nCaminho em tua luz";
    const parsed = parseChordChart({ content });

    expect(parsed.chordProContent).toBe(content);
    expect(parsed.warnings).toEqual([]);
  });

  it("normaliza CRLF e CR para LF", () => {
    const parsed = parseChordChart({ content: "Verso:\r\nC\rLetra" });
    expect(parsed.normalizedSource).toBe("Verso:\nC\nLetra");
  });

  it("remove BOM somente da cópia normalizada", () => {
    const content = "\uFEFFTítulo: Canção\nC";
    const parsed = parseChordChart({ content });

    expect(parsed.originalContent.startsWith("\uFEFF")).toBe(true);
    expect(parsed.normalizedSource).toBe("Título: Canção\nC");
  });

  it("expande tabs usando paradas estáveis de quatro colunas", () => {
    const parsed = parseChordChart({ content: "G\tD\nDeus é bom" });
    expect(parsed.normalizedSource).toBe("G   D\nDeus é bom");
    expect(parsed.chordProContent).toBe("[G]Deus[D] é bom");
  });

  it("retorna warning para arquivo vazio", () => {
    const parsed = parseChordChart({ content: " \r\n\t" });
    expect(parsed.warnings[0].code).toBe("EMPTY_CONTENT");
  });

  it("usa extensão ChordPro como evidência e avisa sobre conteúdo comum", () => {
    const parsed = parseChordChart({
      content: "Verso:\nG  D\nGrande é o Senhor",
      filename: "musica.cho",
    });

    expect(parsed.detectedFormat).toBe("CHORDPRO");
    expect(parsed.chordProContent).toBe(parsed.normalizedSource);
    expect(parsed.warnings[0].code).toBe("UNRECOGNIZED_CONTENT");
  });

  it("preserva e avisa sobre diretiva desconhecida", () => {
    const content = "{title: Canção}\n{x-custom: valor}\n[C]Letra";
    const parsed = parseChordChart({ content });

    expect(parsed.chordProContent).toBe(content);
    expect(warningCodes(content)).toContain("UNKNOWN_DIRECTIVE");
  });

  it("avisa sobre seção ChordPro não fechada", () => {
    const content = "{start_of_chorus: Refrão}\n[C]Letra";
    const parsed = parseChordChart({ content });

    expect(warningCodes(content)).toContain("UNCLOSED_SECTION");
    expect(parsed.sections[0].content).toBe("[C]Letra");
  });

  it("rejeita BPM inválido", () => {
    const parsed = parseChordChart({ content: "BPM: 999\nC" });
    expect(parsed.metadata.bpm).toBeNull();
    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "INVALID_BPM"
    );
  });

  it("rejeita tom inválido", () => {
    const parsed = parseChordChart({ content: "Tom: H#\nC" });
    expect(parsed.metadata.key).toBeNull();
    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "INVALID_KEY"
    );
  });

  it("rejeita compasso inválido", () => {
    const parsed = parseChordChart({ content: "Compasso: 4/3\nC" });
    expect(parsed.metadata.timeSignature).toBeNull();
    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "INVALID_TIME_SIGNATURE"
    );
  });

  it("preserva o primeiro metadado válido e avisa sobre conflito", () => {
    const parsed = parseChordChart({
      content: "{key: C}\n{key: D}\n{tempo: 80}\n{tempo: 90}",
    });

    expect(parsed.metadata.key).toBe("C");
    expect(parsed.metadata.bpm).toBe(80);
    expect(
      parsed.warnings.filter(
        (warning) => warning.code === "CONFLICTING_METADATA"
      )
    ).toHaveLength(2);
  });

  it("preserva conteúdo ambíguo sem inventar posições", () => {
    const content = "C talvez G\nOutra linha";
    const parsed = parseChordChart({ content });

    expect(parsed.chordProContent).toBe(content);
    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "AMBIGUOUS_CHORD_LINE"
    );
  });

  it("preserva Unicode e acentos", () => {
    const content = "Título: Águas Purificadoras\nEspontâneo:\nCoração rendido";
    const parsed = parseChordChart({ content });

    expect(parsed.metadata.title).toBe("Águas Purificadoras");
    expect(parsed.sections[0]).toMatchObject({
      type: "SPONTANEOUS",
      label: "Espontâneo",
    });
    expect(parsed.chordProContent).toContain("Coração rendido");
  });

  it("mantém a saída ChordPro estável em round-trip", () => {
    const first = parseChordChart({
      content: "Título: Canção\nVerso:\nG          D\nGrande é o Senhor",
    });
    const second = parseChordChart({ content: first.chordProContent });

    expect(second.detectedFormat).toBe("CHORDPRO");
    expect(second.chordProContent).toBe(first.chordProContent);
  });

  it("preserva originalContent byte a byte como string", () => {
    const content = "\uFEFFTítulo:\tCanção  \r\nC\tG  \r\n";
    expect(parseChordChart({ content }).originalContent).toBe(content);
  });

  it("é determinístico para a mesma entrada", () => {
    const input = {
      content: "Tom: Bb\n[Verso]\nBb  F/A\nGrande é o Senhor",
      filename: "canção.txt",
    };
    expect(parseChordChart(input)).toEqual(parseChordChart(input));
  });

  it("não associa acordes quando as colunas ultrapassam a letra", () => {
    const content = "C                    G\nCurta";
    const parsed = parseChordChart({ content });

    expect(parsed.warnings.map((warning) => warning.code)).toContain(
      "UNALIGNED_CHORDS"
    );
    expect(parsed.chordProContent).toContain(content.split("\n")[0]);
    expect(parsed.chordProContent).toContain("Curta");
  });
});
