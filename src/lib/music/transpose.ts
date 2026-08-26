const SHARP_NOTES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

const FLAT_NOTES = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

const NATURAL_PITCH: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const CHORD_PATTERN =
  /^([A-Ga-g])([#b]?)((?:(?:maj|min|m|dim|aug|sus|add)?\d*(?:sus\d+|add\d+)?(?:\([^)]*\))?))(?:\/([A-Ga-g])([#b]?))?$/;

const MUSICAL_MARKER = /^(?:\|+|:+|%|-+|\d+x|N\.C\.)$/i;
const BRACKET_SECTION_PREFIX = /^(\s*\[[^\]\r\n]+\]\s*)(.*)$/;
const NAMED_SECTION_PREFIX =
  /^(\s*(?:Intro|Introdução|Verso|Estrofe|Pré-Refrão|Pre-Refrão|Refrão|Coro|Ponte|Interlúdio|Interludio|Solo|Final|Outro)(?:\s+\d+)?\s*:\s*)(.*)$/i;
const KEY_LINE_PATTERN = /^(\s*(?:Tom|Key)\s*:\s*)([A-Ga-g][#b]?(?:m)?)(\s*)$/i;
const CHORDPRO_KEY_PATTERN = /(\{\s*key\s*:\s*)([A-Ga-g][#b]?(?:m)?)(\s*\})/gi;

function pitchClass(note: string): number | null {
  const match = /^([A-Ga-g])([#b]?)(?:m)?$/.exec(note.trim());
  if (!match) return null;

  const natural = NATURAL_PITCH[match[1].toUpperCase()];
  const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
  return (natural + accidental + 12) % 12;
}

function transposeNote(note: string, semitones: number, preferFlats: boolean) {
  const pitch = pitchClass(note);
  if (pitch === null) return note;
  const notes = preferFlats ? FLAT_NOTES : SHARP_NOTES;
  return notes[(pitch + semitones + 12) % 12];
}

function transposeChord(chord: string, semitones: number, preferFlats: boolean) {
  const match = CHORD_PATTERN.exec(chord);
  if (!match) return chord;

  const [, root, accidental, suffix, bassRoot, bassAccidental] = match;
  const transposedRoot = transposeNote(
    `${root}${accidental}`,
    semitones,
    preferFlats
  );
  const bass = bassRoot
    ? `/${transposeNote(`${bassRoot}${bassAccidental}`, semitones, preferFlats)}`
    : "";
  return `${transposedRoot}${suffix}${bass}`;
}

function transposeMusicalContent(
  content: string,
  semitones: number,
  preferFlats: boolean
): string | null {
  const tokens = content.split(/(\s+)/);
  const musicalTokens = tokens.filter((token) => token.trim().length > 0);
  if (
    musicalTokens.length === 0 ||
    !musicalTokens.every(
      (token) => CHORD_PATTERN.test(token) || MUSICAL_MARKER.test(token)
    )
  ) {
    return null;
  }

  return tokens
    .map((token) =>
      CHORD_PATTERN.test(token)
        ? transposeChord(token, semitones, preferFlats)
        : token
    )
    .join("");
}

function transposeChordProInline(
  line: string,
  semitones: number,
  preferFlats: boolean
): { line: string; changed: boolean } {
  let changed = false;
  const transposed = line.replace(/\[([^\]\r\n]+)\]/g, (match, candidate) => {
    if (!CHORD_PATTERN.test(candidate)) return match;
    changed = true;
    return `[${transposeChord(candidate, semitones, preferFlats)}]`;
  });

  return { line: transposed, changed };
}

function transposeLine(line: string, semitones: number, preferFlats: boolean) {
  const keyLine = KEY_LINE_PATTERN.exec(line);
  if (keyLine) {
    return `${keyLine[1]}${transposeChord(
      keyLine[2],
      semitones,
      preferFlats
    )}${keyLine[3]}`;
  }

  let chordProKeyChanged = false;
  const withChordProKey = line.replace(
    CHORDPRO_KEY_PATTERN,
    (_match, prefix, key, suffix) => {
      chordProKeyChanged = true;
      return `${prefix}${transposeChord(key, semitones, preferFlats)}${suffix}`;
    }
  );

  const chordPro = transposeChordProInline(
    withChordProKey,
    semitones,
    preferFlats
  );
  if (chordProKeyChanged || chordPro.changed) return chordPro.line;

  for (const prefixPattern of [
    BRACKET_SECTION_PREFIX,
    NAMED_SECTION_PREFIX,
  ]) {
    const sectionLine = prefixPattern.exec(line);
    if (!sectionLine) continue;

    const transposed = transposeMusicalContent(
      sectionLine[2],
      semitones,
      preferFlats
    );
    if (transposed !== null) return `${sectionLine[1]}${transposed}`;
  }

  return transposeMusicalContent(line, semitones, preferFlats) ?? line;
}

/**
 * Transpõe cifras PLAIN e CHORDPRO sem modificar a letra.
 * Linhas comuns só são transpostas quando todo o conteúdo é musical.
 */
export function transposeChordChart(
  chordChart: string,
  originalKey: string,
  targetKey: string
): string {
  if (!chordChart || originalKey.trim() === targetKey.trim()) return chordChart;

  const originalPitch = pitchClass(originalKey);
  const targetPitch = pitchClass(targetKey);
  if (originalPitch === null || targetPitch === null) return chordChart;

  const semitones = (targetPitch - originalPitch + 12) % 12;
  const preferFlats = targetKey.includes("b");

  return chordChart
    .split(/(\r?\n)/)
    .map((part) =>
      part === "\n" || part === "\r\n"
        ? part
        : transposeLine(part, semitones, preferFlats)
    )
    .join("");
}
