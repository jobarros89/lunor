import type {
  ChordChartMetadata,
  ChordSectionType,
  ContentParseResult,
  ImportWarning,
  ParsedChordSection,
} from "./types";
import {
  assignMetadata,
  detectSectionHeader,
  isChordToken,
} from "./parse-plain-chart";

type Directive = {
  name: string;
  value: string;
};

type OpenSection = {
  type: ChordSectionType;
  label: string | null;
  startIndex: number;
  contentStartIndex: number;
  expectsEnd: boolean;
};

const RECOGNIZED_DIRECTIVES = new Set([
  "title",
  "t",
  "subtitle",
  "st",
  "artist",
  "key",
  "tempo",
  "time",
  "meta",
  "comment",
  "c",
  "new_song",
  "ns",
  "start_of_verse",
  "sov",
  "end_of_verse",
  "eov",
  "start_of_chorus",
  "soc",
  "end_of_chorus",
  "eoc",
  "start_of_bridge",
  "sob",
  "end_of_bridge",
  "eob",
  "start_of_grid",
  "sog",
  "end_of_grid",
  "eog",
  "start_of_tab",
  "sot",
  "end_of_tab",
  "eot",
]);

const SECTION_STARTS: Record<string, ChordSectionType> = {
  start_of_verse: "VERSE",
  sov: "VERSE",
  start_of_chorus: "CHORUS",
  soc: "CHORUS",
  start_of_bridge: "BRIDGE",
  sob: "BRIDGE",
};

const SECTION_ENDS = new Set([
  "end_of_verse",
  "eov",
  "end_of_chorus",
  "eoc",
  "end_of_bridge",
  "eob",
]);

const EMPTY_METADATA = (): ChordChartMetadata => ({
  title: null,
  artist: null,
  key: null,
  bpm: null,
  timeSignature: null,
});

export function parseDirective(line: string): Directive | null {
  const match = /^\s*\{([a-zA-Z][\w-]*)(?:(?::|\s)\s*(.*?))?\}\s*$/.exec(
    line
  );
  if (!match) return null;
  return { name: match[1].toLocaleLowerCase("en-US"), value: match[2] ?? "" };
}

export function isRecognizedChordProDirectiveName(name: string): boolean {
  return RECOGNIZED_DIRECTIVES.has(name.toLocaleLowerCase("en-US"));
}

export function hasInlineChord(line: string): boolean {
  const matches = line.matchAll(/\[([^\]\n]+)\]/g);
  for (const match of matches) {
    if (isChordToken(match[1].trim())) return true;
  }
  return false;
}

function directiveMetadata(directive: Directive): {
  key: keyof ChordChartMetadata;
  value: string;
} | null {
  const directNames: Record<string, keyof ChordChartMetadata> = {
    title: "title",
    t: "title",
    artist: "artist",
    key: "key",
    tempo: "bpm",
    time: "timeSignature",
  };
  const directKey = directNames[directive.name];
  if (directKey) return { key: directKey, value: directive.value };
  if (directive.name !== "meta") return null;

  const match = /^(title|artist|key|tempo|time)\s+(.+)$/i.exec(
    directive.value.trim()
  );
  if (!match) return null;
  const metaKeys: Record<string, keyof ChordChartMetadata> = {
    title: "title",
    artist: "artist",
    key: "key",
    tempo: "bpm",
    time: "timeSignature",
  };
  return {
    key: metaKeys[match[1].toLocaleLowerCase("en-US")],
    value: match[2],
  };
}

function labelFromDirective(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const attribute = /^(?:label=)?["'](.+)["']$/.exec(trimmed);
  return attribute?.[1] ?? trimmed;
}

export function parseChordPro(normalizedSource: string): ContentParseResult {
  const lines = normalizedSource.split("\n");
  const metadata = EMPTY_METADATA();
  const warnings: ImportWarning[] = [];
  const sections: ParsedChordSection[] = [];
  let current: OpenSection | null = null;

  const closeCurrent = (
    contentEndIndexExclusive: number,
    sourceEndLine = contentEndIndexExclusive
  ) => {
    if (!current) return;
    sections.push({
      type: current.type,
      label: current.label,
      position: sections.length,
      sourceStartLine: current.startIndex + 1,
      sourceEndLine: Math.max(current.startIndex + 1, sourceEndLine),
      content: lines
        .slice(current.contentStartIndex, contentEndIndexExclusive)
        .join("\n"),
    });
    current = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const directive = parseDirective(line);
    if (!directive) continue;

    if (!isRecognizedChordProDirectiveName(directive.name)) {
      warnings.push({
        code: "UNKNOWN_DIRECTIVE",
        message: `A diretiva "${directive.name}" foi preservada, mas não é reconhecida.`,
        line: index + 1,
      });
      continue;
    }

    const metadataCandidate = directiveMetadata(directive);
    if (metadataCandidate) {
      assignMetadata(metadata, metadataCandidate, index + 1, warnings);
    }

    const sectionStart = SECTION_STARTS[directive.name];
    const commentHeader = ["comment", "c"].includes(directive.name)
      ? detectSectionHeader(directive.value)
      : null;
    if (sectionStart || commentHeader) {
      if (current) {
        if (current.expectsEnd) {
          warnings.push({
            code: "UNCLOSED_SECTION",
            message: "Uma nova seção começou antes do fechamento da anterior.",
            line: current.startIndex + 1,
          });
        }
        closeCurrent(index);
      }
      current = sectionStart
        ? {
            type: sectionStart,
            label: labelFromDirective(directive.value),
            startIndex: index,
            contentStartIndex: index + 1,
            expectsEnd: true,
          }
        : {
            type: commentHeader!.type,
            label: commentHeader!.label,
            startIndex: index,
            contentStartIndex: index + 1,
            expectsEnd: false,
          };
      continue;
    }

    if (SECTION_ENDS.has(directive.name)) {
      if (!current || !current.expectsEnd) {
        warnings.push({
          code: "UNCLOSED_SECTION",
          message: "Foi encontrado um fechamento de seção sem abertura correspondente.",
          line: index + 1,
        });
        continue;
      }
      closeCurrent(index, index + 1);
    }
  }

  if (current) {
    if (current.expectsEnd) {
      warnings.push({
        code: "UNCLOSED_SECTION",
        message: "A seção chegou ao fim do arquivo sem diretiva de fechamento.",
        line: current.startIndex + 1,
      });
    }
    closeCurrent(lines.length);
  }

  return {
    chordProContent: normalizedSource,
    metadata,
    sections,
    warnings,
  };
}
