"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "@/lib/actions/types";
import {
  generateLunorMcpToken,
  lunorMcpTokenPrefix,
  sha256Hex,
} from "@/lib/ai/mcp-token";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";

const createSchema = z.object({
  churchSlug: z.string().trim().min(2).max(100),
  ministryId: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  expiresInDays: z.number().int().min(7).max(365).default(90),
});

const revokeSchema = z.object({
  churchSlug: z.string().trim().min(2).max(100),
  tokenId: z.string().uuid(),
});

export type CreatedMcpAccess = {
  token: string;
  tokenPrefix: string;
  expiresAt: string;
};

export async function createMcpAccessToken(raw: unknown): Promise<ActionResult<CreatedMcpAccess>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados do acesso MCP inválidos" };
  const input = parsed.data;

  const tenant = await getTenant(input.churchSlug);
  if (tenant.guardianOnly) return { ok: false, error: "Acesso não permitido" };
  const ministries = await getActiveMinistry(input.churchSlug);
  const ministry = ministries.options.find((item) => item.id === input.ministryId);
  if (!ministry?.canManage) {
    return { ok: false, error: "Você não pode criar acesso para este ministério" };
  }

  const token = generateLunorMcpToken();
  const tokenHash = await sha256Hex(token);
  const tokenPrefix = lunorMcpTokenPrefix(token);
  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_mcp_access_token_record", {
    p_church: tenant.church.id,
    p_ministry: ministry.id,
    p_name: input.name,
    p_token_hash: tokenHash,
    p_token_prefix: tokenPrefix,
    p_expires_at: expiresAt,
  });
  if (error) {
    console.error("createMcpAccessToken:", error.message);
    return { ok: false, error: "Não foi possível criar o acesso MCP" };
  }

  revalidatePath(`/${input.churchSlug}/assistente`);
  return { ok: true, data: { token, tokenPrefix, expiresAt } };
}

export async function revokeMcpAccessToken(raw: unknown): Promise<ActionResult> {
  const parsed = revokeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Credencial inválida" };
  const input = parsed.data;

  const tenant = await getTenant(input.churchSlug);
  if (tenant.guardianOnly) return { ok: false, error: "Acesso não permitido" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_mcp_access_token", {
    p_token_id: input.tokenId,
  });
  if (error || !data) {
    if (error) console.error("revokeMcpAccessToken:", error.message);
    return { ok: false, error: "Não foi possível revogar a credencial" };
  }

  revalidatePath(`/${input.churchSlug}/assistente`);
  return { ok: true, data: undefined };
}
