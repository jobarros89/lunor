import {
  REFERENCES_BY_THEME,
  type VerseReference,
  type VerseTheme,
} from "./references";

/**
 * Seleção determinística: mesma igreja + mesma data + mesmo tema sempre
 * devolve a mesma referência. Isso torna o envio idempotente (o cron pode
 * rodar duas vezes sem trocar o versículo do dia) sem precisar guardar a
 * escolha antes de enviar.
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // força 32 bits
  }
  return Math.abs(hash);
}

/**
 * Escolhe a referência do dia dentro do tema, evitando as referências
 * enviadas recentemente para a mesma igreja. Se todas já saíram na janela
 * recente, o rodízio recomeça (melhor repetir do que não enviar nada).
 */
export function selectDailyVerse({
  theme,
  churchId,
  date,
  recentLabels = [],
}: {
  theme: VerseTheme;
  churchId: string;
  /** Data no formato YYYY-MM-DD (fuso da igreja). */
  date: string;
  /** Rótulos já enviados recentemente, ex.: ["Sl 100:2"]. */
  recentLabels?: string[];
}): VerseReference {
  const pool = REFERENCES_BY_THEME[theme];
  const recent = new Set(recentLabels);
  const available = pool.filter((reference) => !recent.has(reference.label));
  const candidates = available.length > 0 ? available : pool;

  const index = hashSeed(`${churchId}:${date}:${theme}`) % candidates.length;
  return candidates[index];
}
