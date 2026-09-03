import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (signInError) throw signInError;
  return client;
}

describe("MCP externo — token escopado", () => {
  let owner: SupabaseClient;
  let leader: SupabaseClient;
  let churchId: string;
  let ministryId: string;
  let eventId: string;
  let tokenId: string;
  let tokenHash: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`mcp-owner-${run}@teste.dev`);
    leader = await newUser(`mcp-leader-${run}@teste.dev`);

    churchId = (
      await owner.rpc("create_church", {
        p_name: "Igreja MCP",
        p_slug: `mcp-${run}`,
      })
    ).data;

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await leader.rpc("join_church", { p_invite_code: church!.invite_code });
    const leaderId = (await leader.auth.getUser()).data.user!.id;

    const { data: ministry, error: ministryError } = await owner
      .from("ministries")
      .insert({ church_id: churchId, name: "Louvor", slug: `louvor-${run}` })
      .select("id")
      .single();
    expect(ministryError).toBeNull();
    ministryId = ministry!.id;

    const { error: memberError } = await owner.from("ministry_members").insert({
      church_id: churchId,
      ministry_id: ministryId,
      user_id: leaderId,
      role: "lider",
    });
    expect(memberError).toBeNull();

    const { data: event, error: eventError } = await owner
      .from("events")
      .insert({
        church_id: churchId,
        title: "Culto MCP",
        starts_at: "2099-01-04T10:00:00.000Z",
      })
      .select("id")
      .single();
    expect(eventError).toBeNull();
    eventId = event!.id;

    const { error: assignmentError } = await owner.from("assignments").insert({
      church_id: churchId,
      ministry_id: ministryId,
      event_id: eventId,
      user_id: leaderId,
      role_name: "Voz",
      status: "confirmado",
    });
    expect(assignmentError).toBeNull();

    const raw = `lunor_mcp_test-${run}`;
    tokenHash = createHash("sha256").update(raw).digest("hex");
    const { data: created, error: createError } = await leader.rpc(
      "create_mcp_access_token_record",
      {
        p_church: churchId,
        p_ministry: ministryId,
        p_name: "Teste externo",
        p_token_hash: tokenHash,
        p_token_prefix: "lunor_mcp_test",
        p_expires_at: "2099-12-31T23:59:59.000Z",
      }
    );
    expect(createError).toBeNull();
    tokenId = created!;
  });

  it("não expõe o hash da credencial pela tabela", async () => {
    const { data, error } = await leader.from("mcp_access_tokens").select("token_hash");
    expect(data).toBeNull();
    expect(error).not.toBeNull();

    const { data: safeList, error: listError } = await leader.rpc("list_mcp_access_tokens", {
      p_church: churchId,
      p_ministry: ministryId,
    });
    expect(listError).toBeNull();
    expect(safeList?.[0]).toMatchObject({ id: tokenId, name: "Teste externo" });
    expect(safeList?.[0]).not.toHaveProperty("token_hash");
  });

  it("anon só consegue consultar pelas RPCs read-only usando o hash válido", async () => {
    const { data: context, error: contextError } = await anonymous.rpc(
      "mcp_validate_access_token",
      { p_token_hash: tokenHash }
    );
    expect(contextError).toBeNull();
    expect(context).toMatchObject({
      churchId,
      ministryId,
      scope: "read:operational",
    });

    const { data: summary, error: summaryError } = await anonymous.rpc(
      "mcp_external_execute",
      {
        p_token_hash: tokenHash,
        p_tool_name: "get_operational_summary",
        p_args: { limit: 4 },
      }
    );
    expect(summaryError).toBeNull();
    expect(summary.scope).toMatchObject({ ministryId });
    expect(summary.events).toHaveLength(1);
    expect(summary.events[0].assignments.confirmed).toBe(1);
  });

  it("não permite usar o token para buscar evento de outra igreja", async () => {
    const otherOwner = await newUser(`mcp-other-${run}@teste.dev`);
    const otherChurchId = (
      await otherOwner.rpc("create_church", {
        p_name: "Outra Igreja MCP",
        p_slug: `mcp-other-${run}`,
      })
    ).data;
    const { data: otherEvent } = await otherOwner
      .from("events")
      .insert({
        church_id: otherChurchId,
        title: "Evento privado de outra igreja",
        starts_at: "2099-01-05T10:00:00.000Z",
      })
      .select("id")
      .single();

    const { data, error } = await anonymous.rpc("mcp_external_execute", {
      p_token_hash: tokenHash,
      p_tool_name: "get_event_team",
      p_args: { eventId: otherEvent!.id },
    });
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("revogação invalida imediatamente o bearer", async () => {
    const { data: revoked, error: revokeError } = await leader.rpc(
      "revoke_mcp_access_token",
      { p_token_id: tokenId }
    );
    expect(revokeError).toBeNull();
    expect(revoked).toBe(true);

    const { data, error } = await anonymous.rpc("mcp_validate_access_token", {
      p_token_hash: tokenHash,
    });
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
