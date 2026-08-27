const CHORDPRO_DIRECTIVE = /^\s*\{\s*([^}:]+)(?::\s*([^}]*))?\}\s*$/;

function sectionLabel(name: string, value: string | undefined): string | null {
  const normalized = name.trim().toLocaleLowerCase("en-US");
  if (["start_of_verse", "sov"].includes(normalized)) return value?.trim() || "Verso";
  if (["start_of_chorus", "soc"].includes(normalized)) return value?.trim() || "Refrão";
  if (["start_of_bridge", "sob"].includes(normalized)) return value?.trim() || "Ponte";
  if (["comment", "c"].includes(normalized)) return value?.trim() || null;
  return null;
}

/**
 * Extrai uma letra legível de uma cifra ChordPro sem carregar acordes,
 * grids instrumentais ou metadados. Mantém os nomes das seções para que a
 * letra continue útil no ensaio e na projeção/revisão.
 */
export function extractLyricsFromChordPro(chordProContent: string): string {
  const output: string[] = [];
  let insideGrid = false;

  for (const sourceLine of chordProContent.replace(/\r\n?/g, "\n").split("\n")) {
    const directive = CHORDPRO_DIRECTIVE.exec(sourceLine);
    if (directive) {
      const name = directive[1].trim().toLocaleLowerCase("en-US");
      if (["start_of_grid", "sog"].includes(name)) {
        insideGrid = true;
        continue;
      }
      if (["end_of_grid", "eog"].includes(name)) {
        insideGrid = false;
        continue;
      }
      if (insideGrid) continue;

      const label = sectionLabel(directive[1], directive[2]);
      if (label) {
        if (output.length && output.at(-1) !== "") output.push("");
        output.push(label);
      }
      continue;
    }

    if (insideGrid) continue;

    const withoutChords = sourceLine.replace(/\[[^\]\r\n]+\]/g, "").trimEnd();
    if (!withoutChords.trim()) {
      if (output.length && output.at(-1) !== "") output.push("");
      continue;
    }
    output.push(withoutChords);
  }

  while (output.at(-1) === "") output.pop();
  return output.join("\n").trim();
}
