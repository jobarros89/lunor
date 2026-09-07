import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lê uma variável de ambiente de SERVIDOR (secret) de forma portável:
 * - Em produção (Cloudflare Worker) via getCloudflareContext().env
 * - Em `next dev` / Node via process.env (carregado do .env.local)
 * Nunca use para segredos no cliente — só server.
 */
export function serverEnv(key: string): string | undefined {
  try {
    const { env } = getCloudflareContext();
    const value = (env as Record<string, unknown> | undefined)?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // fora de contexto de request (build, scripts) — cai no process.env
  }
  return process.env[key];
}

/**
 * Mesma leitura de serverEnv, mas via getCloudflareContext({ async: true }).
 *
 * A versão síncrona depende de um contexto de request que o OpenNext nem
 * sempre propaga corretamente para Server Actions chamadas a partir de
 * rotas dinâmicas (ex.: /[churchSlug]/admin) — bug conhecido do adapter:
 * https://github.com/opennextjs/opennextjs-cloudflare/issues/575
 *
 * Use esta variante em código chamado por Server Actions. Route Handlers
 * seguem funcionando com a versão síncrona acima.
 */
export async function serverEnvAsync(key: string): Promise<string | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const value = (env as Record<string, unknown> | undefined)?.[key];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // fora de contexto de request (build, scripts) — cai no process.env
  }
  return process.env[key];
}
