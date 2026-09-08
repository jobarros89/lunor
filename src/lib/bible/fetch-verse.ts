import type { VerseReference } from "./references";
import { fetchVerseTextFromFree } from "./fetch-verse-free";

/**
 * O LUNOR não embute textos de traduções modernas no código. A tradução é
 * buscada no momento do envio conforme a configuração da igreja.
 *
 * A opção gratuita usa a Bíblia Livre (BLIVRE), pela fonte oficial sob
 * CC BY 3.0 BR. Outras traduções são consultadas pela API configurada no
 * ambiente e dependem do licenciamento/credenciais correspondentes.
 */

const DEFAULT_BASE_URL = "https://www.abibliadigital.com.br/api";
/** Valor histórico persistido no banco para a Bíblia Livre. */
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

  // "blt" é mantido como chave de configuração por compatibilidade.
  if (resolvedVersion === "blt") {
    return await fetchVerseTextFromFree(reference);
  }

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
    console.error(
      "fetchVerseText: consulta falhou",
      error instanceof Error ? error.message : "desconhecido"
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
