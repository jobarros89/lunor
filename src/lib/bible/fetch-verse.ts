import type { VerseReference } from "./references";
import { fetchVerseTextFromFree } from "./fetch-verse-free";

/**
 * O LUNOR não mantém um acervo próprio de textos bíblicos no repositório ou
 * no banco. O texto é buscado no momento do envio na tradução configurada.
 *
 * Padrão: Bíblia Livre (BLIVRE), distribuída sob Creative Commons Atribuição
 * 3.0 Brasil. Nas notificações, onde o espaço é restrito, a sigla BLIVRE
 * identifica a tradução; no Admin exibimos também a licença.
 *
 * Alternativas configuradas (NVI, ACF e RA) são consultadas via
 * ABíbliaDigital quando a integração correspondente estiver disponível.
 */

const DEFAULT_BASE_URL = "https://www.abibliadigital.com.br/api";
const DEFAULT_VERSION = "blt";
const TIMEOUT_MS = 5_000;

export type FetchedVerse = {
  text: string;
  label: string;
  version: string;
};

export async function fetchVerseText({
  reference,
  version,
}: {
  reference: VerseReference;
  version?: string | null;
}): Promise<FetchedVerse | null> {
  const resolvedVersion = (version || DEFAULT_VERSION).toLowerCase();

  // Bíblia Livre: cliente direto da fonte oficial, sem ABíbliaDigital.
  if (resolvedVersion === "blt") {
    return await fetchVerseTextFromFree(reference);
  }

  // Outras versões: via ABíbliaDigital.
  const baseUrl = process.env.BIBLE_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const token = process.env.BIBLE_API_TOKEN?.trim();

  const url = `${baseUrl}/verses/${encodeURIComponent(resolvedVersion)}/${encodeURIComponent(reference.book)}/${reference.chapter}/${reference.verse}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("fetchVerseText: API recusou a consulta", response.status);
      return null;
    }

    const payload = (await response.json()) as { text?: unknown };
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    if (!text) return null;

    return { text, label: reference.label, version: resolvedVersion.toUpperCase() };
  } catch (error) {
    // Falha de rede ou timeout não pode derrubar o envio dos outros lembretes.
    console.error(
      "fetchVerseText: consulta falhou",
      error instanceof Error ? error.message : "desconhecido"
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
