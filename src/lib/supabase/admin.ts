import "server-only";
import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

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
