import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv, serverEnvAsync } from "@/lib/env";

/** Cliente privilegiado apenas para integrações server-to-server.
 * Nunca exponha SUPABASE_SERVICE_ROLE_KEY ao navegador.
 */
export function createAdminClient() {
  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = serverEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRole) {
    throw new Error("Supabase admin não configurado");
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Variante para fluxos disparados por Server Actions no OpenNext/Cloudflare.
 * Usa getCloudflareContext({ async: true }) por meio de serverEnvAsync para
 * garantir acesso aos bindings/secrets do Worker durante a requisição.
 */
export async function createAdminClientAsync() {
  const [url, serviceRole] = await Promise.all([
    serverEnvAsync("NEXT_PUBLIC_SUPABASE_URL"),
    serverEnvAsync("SUPABASE_SERVICE_ROLE_KEY"),
  ]);

  if (!url || !serviceRole) {
    throw new Error("Supabase admin não configurado no runtime");
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
