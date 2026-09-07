/**
 * Cliente direto da Bíblia Livre (BLT) via repositório público.
 *
 * A Bíblia Livre é uma tradução sob licença permissiva, perfeita para uso
 * comercial. Fonte: https://github.com/thiagobodruk/biblia
 *
 * Em produção, o JSON seria cachado localmente (no build ou via CDN);
 * para MVP, validamos via fetch do repositório com rate-limit sensato.
 */

import type { VerseReference } from "./references";

const BLT_REPO = "https://raw.githubusercontent.com/thiagobodruk/biblia/master/biblia_blt.json";
const TIMEOUT_MS = 8_000;

type BibliaJSON = Array<{
  abbrev: string;
  book: string;
  chapters: string[][];
}>;

/**
 * Cache em memória: uma única instância do JSON durante o processo.
 * Em produção, seria Redis ou cache de build. Aqui é MVP.
 */
let cachedBiblia: BibliaJSON | null = null;

async function getBiblia(): Promise<BibliaJSON> {
  if (cachedBiblia) return cachedBiblia;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(BLT_REPO, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    cachedBiblia = (await response.json()) as BibliaJSON;
    return cachedBiblia;
  } catch (error) {
    console.error(
      "getBiblia failed:",
      error instanceof Error ? error.message : "unknown error"
    );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca um versículo específico na Bíblia Livre.
 *
 * A Bíblia Livre no thiagobodruk/biblia usa abreviações de livro
 * padronizadas, mas o mapeamento precisa de cuidado: "jo" é João,
 * "sl" é Salmos, "mt" é Mateus, etc.
 */
export async function fetchVerseTextFromFree(
  reference: VerseReference
): Promise<{ text: string; label: string; version: string } | null> {
  try {
    const biblia = await getBiblia();

    // Procura o livro por abreviação
    const livro = biblia.find(
      (b) => b.abbrev.toLowerCase() === reference.book.toLowerCase()
    );
    if (!livro) {
      console.error("libro not found:", reference.book);
      return null;
    }

    // Capítulo é 0-indexado no JSON
    const capitulo = livro.chapters[reference.chapter - 1];
    if (!capitulo) {
      console.error("chapter not found:", reference.chapter);
      return null;
    }

    // Versículo é 0-indexado no JSON
    const versiculo = capitulo[reference.verse - 1];
    if (!versiculo) {
      console.error("verse not found:", reference.verse);
      return null;
    }

    return {
      text: versiculo.trim(),
      label: reference.label,
      version: "BLT",
    };
  } catch (error) {
    console.error(
      "fetchVerseTextFromFree failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return null;
  }
}
