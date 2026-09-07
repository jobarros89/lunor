import type { VerseReference } from "./references";
import { fetchVerseTextFromFree } from "./fetch-verse-free";

/**
 * O LUNOR nunca armazena o texto bíblico no repositório nem no banco além
 * do cache de envio do dia. O texto é sempre buscado na API, na tradução
 * que a igreja configurou.
 *
 * Isso é deliberado: as traduções modernas em português (NVI, ARA, ACF, AA)
 * são obras protegidas das respectivas sociedades bíblicas, e vários dos
 * datasets públicos disponíveis são licenciados como não-comercial — o que
 * seria incompatível com um SaaS pago. Mantendo o texto fora do nosso código
 * e deixando a tradução configurável, cada igreja usa a versão que tem
 * direito de usar.
 *
 * Padrão: Bíblia Livre (BLT, CC0, permissiva, sem custo, risco zero de licença).
 * Alternativas: nvi, acf, ra, etc. via ABíbliaDigital (se configurado).
 */

const DEFAULT_BASE_URL = "https://www.abibliadigital.com.br/api";
/** Tradução padrão: Bíblia Livre, CC0, permissiva. */
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

  // Bíblia Livre: cliente direto (sem ABíbliaDigital)
  if (resolvedVersion === "blt") {
    return await fetchVerseTextFromFree(reference);
  }

  // Outras versões: via ABíbliaDigital
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
