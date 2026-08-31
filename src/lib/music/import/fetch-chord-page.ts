const MAX_SOURCE_BYTES = 1_200_000;
const MAX_EXTRACTED_CHARS = 20_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 8_000;

export type ChordPageCandidate = {
  content: string;
  score: number;
  source: "pre" | "code" | "targeted" | "main" | "article" | "body" | "text";
};

export type FetchedChordPage = {
  finalUrl: string;
  title: string | null;
  candidates: ChordPageCandidate[];
};

export type ChordPageImportErrorCode =
  | "INVALID_URL"
  | "PRIVATE_URL"
  | "FETCH_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "UNSUPPORTED_CONTENT"
  | "SOURCE_TOO_LARGE"
  | "EMPTY_CONTENT";

export class ChordPageImportError extends Error {
  constructor(
    public readonly code: ChordPageImportErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ChordPageImportError";
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
}

function privateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const octets = parts.map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return false;
  const [a, b] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function privateIpv6(hostname: string): boolean {
  const value = normalizeHostname(hostname);
  if (!value.includes(":")) return false;
  if (value === "::" || value === "::1") return true;

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped) return privateIpv4(mapped[1]);

  const first = value.split(":", 1)[0];
  if (first === "fc" || first === "fd" || first.startsWith("fc") || first.startsWith("fd")) {
    return true;
  }

  // fe80::/10 cobre endereços link-local fe80 até febf.
  if (/^fe[89ab][0-9a-f]:/i.test(value)) return true;
  return false;
}

export function parsePublicChordUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new ChordPageImportError("INVALID_URL", "Informe uma URL válida.");
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ChordPageImportError(
      "INVALID_URL",
      "A importação aceita apenas páginas públicas HTTP ou HTTPS."
    );
  }

  const hostname = normalizeHostname(url.hostname);
  const blockedName =
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".lan") ||
    hostname.endsWith(".home") ||
    hostname.endsWith(".arpa");

  if (!hostname || blockedName || privateIpv4(hostname) || privateIpv6(hostname)) {
    throw new ChordPageImportError(
      "PRIVATE_URL",
      "Endereços locais, privados ou internos não podem ser importados."
    );
  }

  url.hash = "";
  return url;
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ensp: " ",
    emsp: "  ",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#x") || token.startsWith("#X")) {
      const point = Number.parseInt(token.slice(2), 16);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    if (token.startsWith("#")) {
      const point = Number.parseInt(token.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : entity;
    }
    return named[token.toLowerCase()] ?? entity;
  });
}

export function htmlFragmentToText(fragment: string): string {
  const withoutNoise = fragment
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<hr\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|section|article|main|pre|code|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const decoded = decodeHtmlEntities(withoutNoise)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n");

  const lines = decoded.split("\n").map((line) => line.replace(/[ \t]+$/g, ""));
  const compact: string[] = [];
  let blankRun = 0;
  for (const line of lines) {
    if (!line.trim()) {
      blankRun += 1;
      if (blankRun <= 2) compact.push("");
    } else {
      blankRun = 0;
      compact.push(line);
    }
  }

  return compact.join("\n").trim();
}

function looksLikeChordToken(token: string): boolean {
  return /^[A-G](?:#|b)?(?:m|maj|min|sus|dim|aug|add)?\d*(?:\([^)]*\))?(?:\/[A-G](?:#|b)?)?$/.test(
    token.replace(/[|,:;]+$/g, "")
  );
}

function candidateScore(content: string): number {
  const lines = content.split("\n");
  let chordLines = 0;
  let sectionLines = 0;

  for (const line of lines) {
    const tokens = line.trim().split(/\s+/).filter(Boolean);
    const chordTokens = tokens.filter(looksLikeChordToken).length;
    if (chordTokens >= 2 || (tokens.length <= 3 && chordTokens >= 1)) chordLines += 1;
    if (/^(?:tom|key|intro|introdu[cç][aã]o|verso|verse|refr[aã]o|chorus|ponte|bridge|final|ending)\b/i.test(line.trim())) {
      sectionLines += 1;
    }
  }

  const usefulLength = Math.min(content.length, 8_000) / 100;
  const lineBonus = Math.min(lines.length, 120) * 0.4;
  const noisePenalty = /(?:pol[ií]tica de privacidade|aceitar cookies|newsletter|fa[cç]a login|sign in)/i.test(content)
    ? 25
    : 0;

  return usefulLength + lineBonus + chordLines * 18 + sectionLines * 10 - noisePenalty;
}

function pushCandidate(
  list: ChordPageCandidate[],
  content: string,
  source: ChordPageCandidate["source"]
) {
  const normalized = htmlFragmentToText(content);
  if (normalized.length < 60) return;

  const clipped = normalized.slice(0, MAX_EXTRACTED_CHARS);
  if (list.some((candidate) => candidate.content === clipped)) return;
  list.push({ content: clipped, score: candidateScore(clipped), source });
}

function captureBlocks(
  html: string,
  regex: RegExp,
  source: ChordPageCandidate["source"],
  list: ChordPageCandidate[]
) {
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    pushCandidate(list, match[match.length - 1], source);
    if (list.length >= 30) break;
  }
}

export function extractChordPageCandidates(html: string): ChordPageCandidate[] {
  const candidates: ChordPageCandidate[] = [];

  captureBlocks(html, /<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, "pre", candidates);
  captureBlocks(html, /<code\b[^>]*>([\s\S]*?)<\/code>/gi, "code", candidates);

  captureBlocks(
    html,
    /<(?:div|section|article)\b[^>]*(?:id|class)=["'][^"']*(?:chord|cifra|lyrics|letra|song|tab)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/gi,
    "targeted",
    candidates
  );
  captureBlocks(html, /<main\b[^>]*>([\s\S]*?)<\/main>/gi, "main", candidates);
  captureBlocks(html, /<article\b[^>]*>([\s\S]*?)<\/article>/gi, "article", candidates);

  const body = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html;
  const bodyWithoutChrome = body
    .replace(/<(?:nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/(?:nav|header|footer|aside)>/gi, "")
    .replace(/<(script|style|svg|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  pushCandidate(candidates, bodyWithoutChrome, "body");

  return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
}

function pageTitle(html: string): string | null {
  const raw = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!raw) return null;
  const title = htmlFragmentToText(raw).replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 200) : null;
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SOURCE_BYTES) {
    throw new ChordPageImportError("SOURCE_TOO_LARGE", "A página é grande demais para importação automática.");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new ChordPageImportError("SOURCE_TOO_LARGE", "A página é grande demais para importação automática.");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

async function fetchOnce(url: URL): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain;q=0.9,application/xhtml+xml;q=0.8,*/*;q=0.1",
        "User-Agent": "LUNOR/1.0 (+https://lunorservice.com)",
      },
    });
  } catch {
    throw new ChordPageImportError("FETCH_FAILED", "Não foi possível acessar essa página.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchChordPage(rawUrl: string): Promise<FetchedChordPage> {
  let current = parsePublicChordUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetchOnce(current);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new ChordPageImportError("TOO_MANY_REDIRECTS", "A página redirecionou vezes demais.");
      }
      current = parsePublicChordUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) {
      throw new ChordPageImportError("FETCH_FAILED", `A página respondeu com status ${response.status}.`);
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const supported =
      contentType.startsWith("text/") ||
      contentType.includes("application/xhtml+xml") ||
      contentType === "";
    if (!supported) {
      throw new ChordPageImportError("UNSUPPORTED_CONTENT", "O endereço não retornou uma página de texto ou HTML.");
    }

    const source = await readLimitedText(response);
    if (!source.trim()) {
      throw new ChordPageImportError("EMPTY_CONTENT", "A página não retornou conteúdo para analisar.");
    }

    const isHtml = contentType.includes("html") || /<html\b|<body\b|<pre\b/i.test(source);
    const candidates = isHtml
      ? extractChordPageCandidates(source)
      : [{ content: source.slice(0, MAX_EXTRACTED_CHARS).trim(), score: candidateScore(source), source: "text" as const }];

    if (!candidates.length || !candidates[0].content.trim()) {
      throw new ChordPageImportError("EMPTY_CONTENT", "Não foi possível localizar conteúdo de cifra nessa página.");
    }

    return {
      finalUrl: current.toString(),
      title: isHtml ? pageTitle(source) : null,
      candidates,
    };
  }

  throw new ChordPageImportError("TOO_MANY_REDIRECTS", "A página redirecionou vezes demais.");
}
