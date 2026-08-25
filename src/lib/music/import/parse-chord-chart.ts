import { parseChordPro, hasInlineChord, parseDirective, isRecognizedChordProDirectiveName } from "./parse-chordpro";
import { parsePlainChart } from "./parse-plain-chart";
import type {
  ChordChartFormat,
  ParseChordChartInput,
  ParsedChordChart,
} from "./types";
const CHORDPRO_EXTENSIONS = new Set(["cho", "chordpro", "pro", "crd"]);

function expandTabs(line: string): string {
  let column = 0;
  let result = "";
  for (const character of line) {
    if (character === "\t") {
      const spaces = 4 - (column % 4);
      result += " ".repeat(spaces);
      column += spaces;
    } else {
      result += character;
      column += 1;
    }
  }
  return result;
}

function normalizeSource(content: string): string {
  const withoutBom = content.startsWith("\uFEFF") ? content.slice(1) : content;
  return withoutBom
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => expandTabs(line).replace(/\s+$/, ""))
    .join("\n");
}

function normalizedExtension(input: ParseChordChartInput): string | null {
  const explicit = input.extension?.trim().replace(/^\./, "");
  if (explicit) return explicit.toLocaleLowerCase("en-US");
  const match = /\.([^.\/\\]+)$/.exec(input.filename ?? "");
  return match?.[1].toLocaleLowerCase("en-US") ?? null;
}

function contentHasChordProEvidence(content: string): boolean {
  return content.split("\n").some((line) => {
    const directive = parseDirective(line);
    return (
      (directive !== null &&
        isRecognizedChordProDirectiveName(directive.name)) ||
      hasInlineChord(line)
    );
  });
}

function detectFormat(
  normalizedSource: string,
  input: ParseChordChartInput
): { format: ChordChartFormat; extensionOnlyEvidence: boolean } {
  const contentEvidence = contentHasChordProEvidence(normalizedSource);
  const extension = normalizedExtension(input);
  const extensionEvidence = extension
    ? CHORDPRO_EXTENSIONS.has(extension)
    : false;
  return {
    format: contentEvidence || extensionEvidence ? "CHORDPRO" : "PLAIN",
    extensionOnlyEvidence: extensionEvidence && !contentEvidence,
  };
}

export function parseChordChart(
  input: ParseChordChartInput
): ParsedChordChart {
  const originalContent = input.content;
  const normalizedSource = normalizeSource(originalContent);
  const detection = detectFormat(normalizedSource, input);
  const parsed =
    detection.format === "CHORDPRO"
      ? parseChordPro(normalizedSource)
      : parsePlainChart(normalizedSource);

  const warnings = [...parsed.warnings];
  if (normalizedSource.trim().length === 0) {
    warnings.unshift({
      code: "EMPTY_CONTENT",
      message: "Nenhum conteúdo foi informado para importação.",
    });
  } else if (detection.extensionOnlyEvidence) {
    warnings.unshift({
      code: "UNRECOGNIZED_CONTENT",
      message:
        "A extensão indica ChordPro, mas o conteúdo não possui diretivas ou acordes inline reconhecidos.",
    });
  }

  return {
    detectedFormat: detection.format,
    originalContent,
    normalizedSource,
    chordProContent: parsed.chordProContent,
    metadata: parsed.metadata,
    sections: parsed.sections,
    warnings,
  };
}

export type {
  ChordChartFormat,
  ChordChartMetadata,
  ChordSectionType,
  ImportWarning,
  ImportWarningCode,
  ParseChordChartInput,
  ParsedChordChart,
  ParsedChordSection,
} from "./types";
