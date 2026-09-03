import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
import { isLunorMcpToken, sha256Hex } from "@/lib/ai/mcp-token";

export type ExternalMcpContext = {
  tokenId: string;
  churchId: string;
  ministryId: string;
  ministryName: string;
  scope: "read:operational";
};

function createAnonymousServerClient() {
  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    serverEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) throw new Error("supabase_public_config_missing");

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function bearerTokenFromRequest(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export async function resolveExternalMcpContext(rawToken: string): Promise<ExternalMcpContext | null> {
  if (!isLunorMcpToken(rawToken)) return null;
  const tokenHash = await sha256Hex(rawToken);
  const supabase = createAnonymousServerClient();
  const { data, error } = await supabase.rpc("mcp_validate_access_token", {
    p_token_hash: tokenHash,
  });
  if (error || !data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;
  if (
    typeof record.tokenId !== "string" ||
    typeof record.churchId !== "string" ||
    typeof record.ministryId !== "string" ||
    typeof record.ministryName !== "string" ||
    record.scope !== "read:operational"
  ) {
    return null;
  }

  return record as ExternalMcpContext;
}

export async function executeExternalMcpTool(
  rawToken: string,
  name: string,
  args: Record<string, unknown>
) {
  if (!isLunorMcpToken(rawToken)) throw new Error("invalid_mcp_token");
  const tokenHash = await sha256Hex(rawToken);
  const supabase = createAnonymousServerClient();
  const { data, error } = await supabase.rpc("mcp_external_execute", {
    p_token_hash: tokenHash,
    p_tool_name: name,
    p_args: args,
  });
  if (error) {
    console.error("external MCP tool:", error.message);
    throw new Error("mcp_tool_failed");
  }
  return data;
}
