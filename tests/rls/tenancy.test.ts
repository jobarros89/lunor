import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
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

describe("isolamento multi-tenant (RLS)", () => {
  let alice: SupabaseClient; // admin da igreja A
  let bob: SupabaseClient; // admin da igreja B
  let churchA: string;
  let churchB: string;
  const run = Date.now();

  beforeAll(async () => {
    alice = await newUser(`alice-${run}@teste.dev`);
    bob = await newUser(`bob-${run}@teste.dev`);

    const a = await alice.rpc("create_church", {
      p_name: "Igreja A",
      p_slug: `igreja-a-${run}`,
    });
    expect(a.error).toBeNull();
    churchA = a.data;

    const b = await bob.rpc("create_church", {
      p_name: "Igreja B",
      p_slug: `igreja-b-${run}`,
    });
    expect(b.error).toBeNull();
    churchB = b.data;
  });

  it("cada admin lê apenas a própria igreja", async () => {
    const { data } = await alice.from("churches").select("id");
    expect(data?.map((c) => c.id)).toEqual([churchA]);
  });

  it("membro de A não lê a igreja B nem por id", async () => {
    const { data } = await alice
      .from("churches")
      .select("id")
      .eq("id", churchB);
    expect(data).toEqual([]);
  });

  it("membro de A não cria ministério na igreja B", async () => {
    const { error } = await alice.from("ministries").insert({
      church_id: churchB,
      name: "Invasão",
      slug: "invasao",
    });
    expect(error).not.toBeNull();
  });

  it("admin cria ministério na própria igreja", async () => {
    // create_church já cria o setor "midia"; usa outro slug para não colidir
    const { error } = await alice.from("ministries").insert({
      church_id: churchA,
      name: "Louvor",
      slug: "louvor",
    });
    expect(error).toBeNull();
  });

  it("perfil de B invisível para A (sem igreja em comum)", async () => {
    const { data: bobUser } = await bob.auth.getUser();
    const { data } = await alice
      .from("profiles")
      .select("id")
      .eq("id", bobUser.user!.id);
    expect(data).toEqual([]);
  });

  it("join_church com invite code adiciona como member (não admin)", async () => {
    const carol = await newUser(`carol-${run}@teste.dev`);
    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    const { error } = await carol.rpc("join_church", {
      p_invite_code: church!.invite_code,
    });
    expect(error).toBeNull();

    const { data: carolUser } = await carol.auth.getUser();
    const { data: membership } = await carol
      .from("church_members")
      .select("role")
      .eq("user_id", carolUser.user!.id)
      .single();
    expect(membership?.role).toBe("member");
  });

  it("member comum não altera church_members", async () => {
    const carol = await newUser(`carol2-${run}@teste.dev`);
    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    await carol.rpc("join_church", { p_invite_code: church!.invite_code });

    const { data: carolUser } = await carol.auth.getUser();
    // tenta se promover a admin
    const { data: updated } = await carol
      .from("church_members")
      .update({ role: "admin" })
      .eq("church_id", churchA)
      .eq("user_id", carolUser.user!.id)
      .select();
    expect(updated).toEqual([]); // RLS bloqueia: nenhuma linha afetada
  });
});
