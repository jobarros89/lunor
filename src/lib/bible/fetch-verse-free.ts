/**
 * Cliente da Bíblia Livre (BLIVRE) usando a fonte oficial do projeto.
 *
 * A Bíblia Livre é distribuída sob Creative Commons Atribuição 3.0 Brasil.
 * Para o envio diário, buscamos somente o livro necessário e extraímos o
 * versículo selecionado; o texto completo não é persistido pelo LUNOR.
 *
 * Fonte oficial: https://github.com/blivre/BibliaLivre
 */

import type { VerseReference } from "./references";

const BLIVRE_BASE =
  "https://raw.githubusercontent.com/blivre/BibliaLivre/master/textos/f4/n4";
const TIMEOUT_MS = 8_000;

/**
 * As referências internas seguem as abreviações da ABíbliaDigital. O projeto
 * oficial da Bíblia Livre usa outros nomes de arquivo, então mantemos somente
 * o pequeno mapa necessário ao acervo curado de Versículo do Dia.
 */
const BOOK_FILES: Record<string, string> = {
  sl: "sal",
  cl: "col",
  gl: "gal",
  "1pe": "1ped",
  mt: "mat",
  hb: "heb",
  js: "jos",
  is: "isa",
  fp: "fil",
  "2co": "2cor",
  dt: "deut",
  mc: "mar",
  ex: "exod",
  "1ts": "1tes",
  ef: "efes",
  tg: "tiag",
  "1co": "1cor",
  rm: "rom",
};

const bookCache = new Map<string, string>();

async function getBookSource(file: string): Promise<string> {
  const cached = bookCache.get(file);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BLIVRE_BASE}/${file}.txt`, {
      signal: controller.signal,
      cache: "force-cache",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const source = await response.text();
    bookCache.set(file, source);
    return source;
  } finally {
    clearTimeout(timeout);
  }
}

function cleanF4Verse(raw: string): string {
  return raw
    .replace(/\\fn[\s\S]*?\\\*fn/g, " ")
    .replace(/\\ref[\s\S]*?\\\*ref/g, " ")
    .replace(/\\key[\s\S]*?\\\*key/g, " ")
    .replace(/\\\*?[a-z0-9-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractVerse(
  source: string,
  chapter: number,
  verse: number
): string | null {
  // O F4 usa marcadores como: \\v Ef.4.3, \\v Sl.100.2 etc.
  // O prefixo do livro varia, então capítulo/versículo são a parte estável.
  const marker = new RegExp(
    `\\\\v\\s+\\S+\\.${chapter}\\.${verse}\\s*\\r?\\n([\\s\\S]*?)(?=\\r?\\n\\\\v\\s+|$)`,
    "i"
  );
  const match = source.match(marker);
  if (!match?.[1]) return null;

  const text = cleanF4Verse(match[1]);
  return text || null;
}

export async function fetchVerseTextFromFree(
  reference: VerseReference
): Promise<{ text: string; label: string; version: string } | null> {
  try {
    const file = BOOK_FILES[reference.book.toLowerCase()];
    if (!file) {
      console.error("fetchVerseTextFromFree: livro sem mapeamento", reference.book);
      return null;
    }

    const source = await getBookSource(file);
    const text = extractVerse(source, reference.chapter, reference.verse);
    if (!text) {
      console.error("fetchVerseTextFromFree: versículo não encontrado", reference.label);
      return null;
    }

    return {
      text,
      label: reference.label,
      version: "BLIVRE",
    };
  } catch (error) {
    console.error(
      "fetchVerseTextFromFree failed:",
      error instanceof Error ? error.message : "unknown"
    );
    return null;
  }
}
