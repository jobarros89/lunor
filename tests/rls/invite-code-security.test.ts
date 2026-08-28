import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const adminApi = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await adminApi.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const login = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (login.error) throw login.error;
  return client;
}

describe("código persistente de convite", () => {
  let owner: SupabaseClient;
  let member: SupabaseClient;
  let churchId: string;
  let inviteCode: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`invite-owner-${run}@teste.dev`);
    member = await newUser(`invite-member-${run}@teste.dev`);

    churchId = (
      await owner.rpc("create_church", {
        p_name: "Igreja Invite Security",
        p_slug: `invite-security-${run}`,
      })
    ).data;

    const invite = await owner.rpc("get_church_invite_code", {
      p_church: churchId,
    });
    if (invite.error || !invite.data) throw invite.error ?? new Error("invite missing");
    inviteCode = invite.data;

    const join = await member.rpc("join_church", { p_invite_code: inviteCode });
    if (join.error) throw join.error;
  });

  it("admin da igreja continua conseguindo obter o convite por RPC", async () => {
    const { data, error } = await owner.rpc("get_church_invite_code", {
      p_church: churchId,
    });
    expect(error).toBeNull();
    expect(data).toBe(inviteCode);
  });

  it("membro comum não consegue obter o convite pela RPC", async () => {
    const { data, error } = await member.rpc("get_church_invite_code", {
      p_church: churchId,
    });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("membro comum não consegue selecionar a coluna invite_code diretamente", async () => {
    const { data, error } = await member
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .maybeSingle();

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("membro ainda lê os metadados não secretos da própria igreja", async () => {
    const { data, error } = await member
      .from("churches")
      .select("id, name, slug")
      .eq("id", churchId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({ id: churchId, name: "Igreja Invite Security" });
  });
});
