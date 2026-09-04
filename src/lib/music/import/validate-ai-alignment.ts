import { extractLyricsFromChordPro } from "./extract-lyrics";

/**
 * Normaliza para comparação tolerante a espaço: a IA pode legitimamente
 * mudar quantos espaços separam uma palavra da outra ao reposicionar um
 * acorde — o que não pode mudar é a sequência de palavras em si.
 */
function normalizeForComparison(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length > 0)
    .join("\n");
}

/**
 * Confirma que a correção de alinhamento feita pela IA preservou a letra
 * palavra por palavra — só a posição dos acordes pode mudar. Se a IA
 * inventou, removeu ou alterou uma palavra, a correção é rejeitada e o
 * import volta para o resultado determinístico do parser heurístico.
 */
export function alignmentFixPreservesLyrics(
  beforeChordProContent: string,
  afterChordProContent: string
): boolean {
  const before = normalizeForComparison(extractLyricsFromChordPro(beforeChordProContent));
  const after = normalizeForComparison(extractLyricsFromChordPro(afterChordProContent));
  return before.length > 0 && before === after;
}
