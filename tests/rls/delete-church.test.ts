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
  await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  return client;
}

describe("Apagar igreja (RLS)", () => {
  let owner: SupabaseClient;
  let membro: SupabaseClient;
  let master: SupabaseClient;
  let churchA: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`del-owner-${run}@teste.dev`);
    membro = await newUser(`del-membro-${run}@teste.dev`);

    await admin
      .from("platform_admin_emails")
      .insert({ email: `del-master-${run}@teste.dev` });
    master = await newUser(`del-master-${run}@teste.dev`);

    const a = await owner.rpc("create_church", {
      p_name: "Igreja Del",
      p_slug: `igreja-del-${run}`,
    });
    churchA = a.data;

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    await membro.rpc("join_church", { p_invite_code: church!.invite_code });
  });

  it("membro comum NÃO apaga a igreja", async () => {
    const { data } = await membro
      .from("churches")
      .delete()
      .eq("id", churchA)
      .select("id");
    expect(data).toEqual([]);
    // segue existindo
    const { data: still } = await owner
      .from("churches")
      .select("id")
      .eq("id", churchA);
    expect(still).toHaveLength(1);
  });

  it("master apaga a igreja de outro (com cascata)", async () => {
    // cria uma segunda igreja com outro dono para o master apagar
    const owner2 = await newUser(`del-owner2-${run}@teste.dev`);
    const b = await owner2.rpc("create_church", {
      p_name: "Igreja Del B",
      p_slug: `igreja-del-b-${run}`,
    });
    const churchB = b.data;

    const { data } = await master
      .from("churches")
      .delete()
      .eq("id", churchB)
      .select("id");
    expect(data).toHaveLength(1);
  });

  it("admin dono apaga a própria igreja", async () => {
    const { data, error } = await owner
      .from("churches")
      .delete()
      .eq("id", churchA)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
