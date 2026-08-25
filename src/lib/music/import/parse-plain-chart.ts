import type {
  ChordChartMetadata,
  ChordSectionType,
  ContentParseResult,
  ImportWarning,
  ParsedChordSection,
} from "./types";

type MetadataKey = keyof ChordChartMetadata;

type MetadataCandidate = {
  key: MetadataKey;
  value: string;
};

type SectionHeader = {
  type: ChordSectionType;
  label: string;
};

const CHORD_PATTERN = new RegExp(
  "^[A-Ga-g](?:#|b)?(?:maj|min|m|dim|aug)?(?:5|6|7|9|11|13)?" +
    "(?:sus2|sus4|add9)?(?:\\([^()\\s]+\\))?(?:/[A-Ga-g](?:#|b)?)?$"
);

const MUSICAL_MARKER = /^(?:\|+|:+|%|-+|\d+x|N\.C\.)$/i;

const SECTION_NAMES: Array<{
  pattern: RegExp;
  type: ChordSectionType;
}> = [
  { pattern: /^(?:intro|introducao)\b/i, type: "INTRO" },
  { pattern: /^(?:pre[- ]?refrao|pre[- ]?chorus)\b/i, type: "PRE_CHORUS" },
  { pattern: /^(?:verso|verse)\b/i, type: "VERSE" },
  { pattern: /^(?:refrao|chorus|coro)\b/i, type: "CHORUS" },
  { pattern: /^(?:ponte|bridge)\b/i, type: "BRIDGE" },
  { pattern: /^(?:instrumental|solo)\b/i, type: "INSTRUMENTAL" },
  { pattern: /^(?:espontaneo|spontaneous)\b/i, type: "SPONTANEOUS" },
  { pattern: /^(?:final|ending|outro)\b/i, type: "ENDING" },
];

const EMPTY_METADATA = (): ChordChartMetadata => ({
  title: null,
  artist: null,
  key: null,
  bpm: null,
  timeSignature: null,
});

function comparable(value: string | number): string {
  return String(value).trim().toLocaleLowerCase("pt-BR");
}

function warningForConflict(
  key: MetadataKey,
  line: number
): ImportWarning {
  const labels: Record<MetadataKey, string> = {
    title: "título",
    artist: "artista",
    key: "tom",
    bpm: "BPM",
    timeSignature: "compasso",
  };
  return {
    code: "CONFLICTING_METADATA",
    message: `O ${labels[key]} difere de um valor válido informado anteriormente.`,
    line,
  };
}

export function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isValidKey(value: string): boolean {
  return /^[A-Ga-g](?:#|b)?m?$/.test(value.trim());
}

export function normalizeKey(value: string): string {
  const trimmed = value.trim();
  return `${trimmed[0].toUpperCase()}${trimmed.slice(1)}`;
}

export function parseValidBpm(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const bpm = Number(value);
  return bpm >= 20 && bpm <= 300 ? bpm : null;
}

export function isValidTimeSignature(value: string): boolean {
  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(value.trim());
  if (!match) return false;
  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  return (
    numerator >= 1 &&
    numerator <= 32 &&
    [1, 2, 4, 8, 16, 32].includes(denominator)
  );
}

export function isChordToken(token: string): boolean {
  return CHORD_PATTERN.test(token) || /^N\.C\.$/i.test(token);
}

function lineTokens(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

export function isChordLine(line: string): boolean {
  const tokens = lineTokens(line);
  if (tokens.length === 0) return false;
  const hasChord = tokens.some(isChordToken);
  return (
    hasChord &&
    tokens.every((token) => isChordToken(token) || MUSICAL_MARKER.test(token))
  );
}

function isAmbiguousChordLine(line: string): boolean {
  const tokens = lineTokens(line);
  if (tokens.length < 2) return false;
  const chordCount = tokens.filter(isChordToken).length;
  return chordCount >= 2 && chordCount < tokens.length;
}

export function detectSectionHeader(line: string): SectionHeader | null {
  const trimmed = line.trim();
  const bracketed = /^\[([^\]]+)\]$/.exec(trimmed);
  const candidate = (bracketed?.[1] ?? trimmed.replace(/:$/, "")).trim();
  const normalized = normalizeForMatching(candidate);

  for (const section of SECTION_NAMES) {
    if (section.pattern.test(normalized)) {
      return { type: section.type, label: candidate };
    }
  }
  return null;
}

function metadataCandidate(line: string): MetadataCandidate | null {
  const match = /^\s*([^:]{2,24}):\s*(.*?)\s*$/.exec(line);
  if (!match) return null;
  const label = normalizeForMatching(match[1]).toLocaleLowerCase("pt-BR");
  const value = match[2];
  const keys: Record<string, MetadataKey> = {
    titulo: "title",
    title: "title",
    artista: "artist",
    artist: "artist",
    tom: "key",
    key: "key",
    bpm: "bpm",
    tempo: "bpm",
    compasso: "timeSignature",
    time: "timeSignature",
  };
  const key = keys[label];
  return key ? { key, value } : null;
}

export function assignMetadata(
  metadata: ChordChartMetadata,
  candidate: MetadataCandidate,
  line: number,
  warnings: ImportWarning[]
): void {
  const raw = candidate.value.trim();
  let validValue: string | number | null = raw;

  if (candidate.key === "key") {
    if (!isValidKey(raw)) {
      warnings.push({
        code: "INVALID_KEY",
        message: `O tom "${raw}" não foi reconhecido.`,
        line,
      });
      return;
    }
    validValue = normalizeKey(raw);
  } else if (candidate.key === "bpm") {
    validValue = parseValidBpm(raw);
    if (validValue === null) {
      warnings.push({
        code: "INVALID_BPM",
        message: "O BPM deve ser um número inteiro entre 20 e 300.",
        line,
      });
      return;
    }
  } else if (candidate.key === "timeSignature") {
    if (!isValidTimeSignature(raw)) {
      warnings.push({
        code: "INVALID_TIME_SIGNATURE",
        message: `O compasso "${raw}" não é válido.`,
        line,
      });
      return;
    }
    validValue = raw;
  } else if (!raw) {
    return;
  }

  const current = metadata[candidate.key];
  if (current !== null && comparable(current) !== comparable(validValue)) {
    warnings.push(warningForConflict(candidate.key, line));
    return;
  }
  if (current === null) {
    if (candidate.key === "bpm") metadata.bpm = validValue as number;
    else if (candidate.key === "title") metadata.title = String(validValue);
    else if (candidate.key === "artist") metadata.artist = String(validValue);
    else if (candidate.key === "key") metadata.key = String(validValue);
    else metadata.timeSignature = String(validValue);
  }
}

function collectSections(lines: string[]): ParsedChordSection[] {
  const sections: ParsedChordSection[] = [];
  let current:
    | { header: SectionHeader; startIndex: number; contentStartIndex: number }
    | null = null;

  const closeCurrent = (endIndexExclusive: number) => {
    if (!current) return;
    sections.push({
      type: current.header.type,
      label: current.header.label,
      position: sections.length,
      sourceStartLine: current.startIndex + 1,
      sourceEndLine: Math.max(current.startIndex + 1, endIndexExclusive),
      content: lines
        .slice(current.contentStartIndex, endIndexExclusive)
        .join("\n"),
    });
    current = null;
  };

  lines.forEach((line, index) => {
    const header = detectSectionHeader(line);
    if (!header) return;
    closeCurrent(index);
    current = { header, startIndex: index, contentStartIndex: index + 1 };
  });
  closeCurrent(lines.length);
  return sections;
}

function sectionDirectives(header: SectionHeader): {
  open: string;
  close: string | null;
} {
  const escapedLabel = header.label.replace(/[{}]/g, "");
  if (header.type === "VERSE") {
    return {
      open: `{start_of_verse: ${escapedLabel}}`,
      close: "{end_of_verse}",
    };
  }
  if (header.type === "CHORUS") {
    return {
      open: `{start_of_chorus: ${escapedLabel}}`,
      close: "{end_of_chorus}",
    };
  }
  if (header.type === "BRIDGE") {
    return {
      open: `{start_of_bridge: ${escapedLabel}}`,
      close: "{end_of_bridge}",
    };
  }
  return { open: `{comment: ${escapedLabel}}`, close: null };
}

function metadataDirective(candidate: MetadataCandidate): string {
  const names: Record<MetadataKey, string> = {
    title: "title",
    artist: "artist",
    key: "key",
    bpm: "tempo",
    timeSignature: "time",
  };
  return `{${names[candidate.key]}: ${candidate.value.trim()}}`;
}

function chordPositions(line: string): Array<{ chord: string; column: number }> {
  const positions: Array<{ chord: string; column: number }> = [];
  const tokenPattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(line)) !== null) {
    if (isChordToken(match[0])) {
      positions.push({ chord: match[0], column: match.index });
    }
  }
  return positions;
}

function alignChordsWithLyrics(chords: string, lyrics: string): string | null {
  const positions = chordPositions(chords);
  if (positions.length === 0) return null;
  if (positions.some(({ column }) => column > lyrics.length)) return null;

  let result = lyrics;
  for (const { chord, column } of [...positions].reverse()) {
    result = `${result.slice(0, column)}[${chord}]${result.slice(column)}`;
  }
  return result;
}

function chordGrid(line: string): string[] {
  return ["{start_of_grid}", line, "{end_of_grid}"];
}

export function parsePlainChart(normalizedSource: string): ContentParseResult {
  const lines = normalizedSource.split("\n");
  const metadata = EMPTY_METADATA();
  const warnings: ImportWarning[] = [];
  const sections = collectSections(lines);

  lines.forEach((line, index) => {
    const candidate = metadataCandidate(line);
    if (candidate) assignMetadata(metadata, candidate, index + 1, warnings);
  });

  const output: string[] = [];
  let closeSection: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const candidate = metadataCandidate(line);
    if (candidate) {
      output.push(metadataDirective(candidate));
      continue;
    }

    const header = detectSectionHeader(line);
    if (header) {
      if (closeSection) output.push(closeSection);
      const directives = sectionDirectives(header);
      output.push(directives.open);
      closeSection = directives.close;
      continue;
    }

    if (isChordLine(line)) {
      const nextLine = lines[index + 1];
      const nextIsLyrics =
        nextLine !== undefined &&
        nextLine.trim().length > 0 &&
        !isChordLine(nextLine) &&
        !detectSectionHeader(nextLine) &&
        !metadataCandidate(nextLine);

      if (nextIsLyrics) {
        const aligned = alignChordsWithLyrics(line, nextLine);
        if (aligned !== null) {
          output.push(aligned);
          index += 1;
          continue;
        }
        warnings.push({
          code: "UNALIGNED_CHORDS",
          message:
            "Os acordes ultrapassam a linha de letra e foram preservados sem associação automática.",
          line: index + 1,
        });
      }
      output.push(...chordGrid(line));
      continue;
    }

    if (isAmbiguousChordLine(line)) {
      warnings.push({
        code: "AMBIGUOUS_CHORD_LINE",
        message:
          "A linha mistura acordes e texto; o conteúdo foi preservado sem conversão.",
        line: index + 1,
      });
    }
    output.push(line);
  }

  if (closeSection) output.push(closeSection);

  return {
    chordProContent: output.join("\n"),
    metadata,
    sections,
    warnings,
  };
}
