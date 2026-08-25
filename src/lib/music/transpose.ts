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

function pitchClass(note: string): number | null {
  const match = /^([A-Ga-g])([#b]?)$/.exec(note.trim());
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

function transposeLine(line: string, semitones: number, preferFlats: boolean) {
  const tokens = line.split(/(\s+)/);
  const content = tokens.filter((token) => token.trim().length > 0);
  if (content.length === 0) return line;

  const isChordLine = content.every(
    (token) => CHORD_PATTERN.test(token) || MUSICAL_MARKER.test(token)
  );
  if (!isChordLine) return line;

  return tokens
    .map((token) =>
      CHORD_PATTERN.test(token)
        ? transposeChord(token, semitones, preferFlats)
        : token
    )
    .join("");
}

/**
 * Transpõe as linhas de acordes de uma cifra sem modificar a letra.
 * Acordes são reconhecidos apenas quando a linha inteira tem conteúdo musical.
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
