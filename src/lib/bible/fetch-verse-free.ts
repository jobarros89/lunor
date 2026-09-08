/**
 * Cliente direto da Bíblia Livre (BLIVRE) pela fonte oficial.
 *
 * O texto vem do repositório blivre/BibliaLivre, nos arquivos F4 oficiais,
 * licenciados sob CC BY 3.0 BR. O LUNOR guarda apenas a referência e busca o
 * texto no momento do envio.
 */

import type { VerseReference } from "./references";

const BLIVRE_BASE_URL =
  "https://raw.githubusercontent.com/blivre/BibliaLivre/master/textos/f4/n4";
const TIMEOUT_MS = 8_000;

/**
 * As abreviações do acervo curado seguem o padrão usado pela API do LUNOR;
 * os arquivos oficiais da BLIVRE usam nomes próprios em alguns livros.
 */
const BOOK_FILE_BY_ABBREV: Record<string, string> = {
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

const cachedBooks = new Map<string, string>();

async function getBookSource(book: string): Promise<string> {
  const normalized = book.trim().toLowerCase();
  const file = BOOK_FILE_BY_ABBREV[normalized] ?? normalized;
  const cached = cachedBooks.get(file);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BLIVRE_BASE_URL}/${file}.txt`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.text();
    cachedBooks.set(file, source);
    return source;
  } finally {
    clearTimeout(timeout);
  }
}

function extractVerse(source: string, reference: VerseReference): string | null {
  // Exemplo do F4 oficial: "\\v Ef.4.3" seguido pelo texto na linha abaixo.
  const marker = new RegExp(
    `^\\\\v\\s+\\S+\\.${reference.chapter}\\.${reference.verse}\\s*$`,
    "m"
  );
  const match = marker.exec(source);
  if (!match) return null;

  const afterMarker = source.slice(match.index + match[0].length);
  const nextVerse = afterMarker.search(/^\\v\s+/m);
  const raw = nextVerse >= 0 ? afterMarker.slice(0, nextVerse) : afterMarker;

  // Remove notas e marcadores F4, preservando apenas o texto legível.
  const text = raw
    .replace(/\\fn[\s\S]*?\\\*fn/g, " ")
    .replace(/\\\*?[a-z0-9-]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text || null;
}

export async function fetchVerseTextFromFree(
  reference: VerseReference
): Promise<{ text: string; label: string; version: string } | null> {
  try {
    const source = await getBookSource(reference.book);
    const text = extractVerse(source, reference);
    if (!text) {
      console.error("fetchVerseTextFromFree: referência não encontrada", reference.label);
      return null;
    }

    return {
      text,
      label: reference.label,
      version: "BLIVRE",
    };
  } catch (error) {
    console.error(
      "fetchVerseTextFromFree: falha ao buscar Bíblia Livre",
      error instanceof Error ? error.message : "unknown"
    );
    return null;
  }
}
