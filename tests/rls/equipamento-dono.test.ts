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
  await client.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return client;
}

async function uid(c: SupabaseClient) {
  const { data } = await c.auth.getUser();
  return data.user!.id;
}

describe("Equipamento — dono (igreja x pessoal) RLS", () => {
  let gestor: SupabaseClient;
  let vol: SupabaseClient;
  let churchId: string;
  const run = Date.now();

  beforeAll(async () => {
    gestor = await newUser(`dono-gestor-${run}@teste.dev`);
    vol = await newUser(`dono-vol-${run}@teste.dev`);

    const a = await gestor.rpc("create_church", {
      p_name: "Igreja Dono",
      p_slug: `igreja-dono-${run}`,
    });
    churchId = a.data;
    const { data: c } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await vol.rpc("join_church", { p_invite_code: c!.invite_code });
  });

  it("voluntário cadastra o PRÓPRIO equipamento pessoal", async () => {
    const volId = await uid(vol);
    const { data, error } = await vol
      .from("equipments")
      .insert({ church_id: churchId, name: "Câmera do vol", owner_id: volId })
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("voluntário NÃO cadastra equipamento DA IGREJA (owner nulo)", async () => {
    const { error } = await vol
      .from("equipments")
      .insert({ church_id: churchId, name: "Tentativa igreja", owner_id: null });
    expect(error).not.toBeNull();
  });

  it("voluntário NÃO cadastra em nome de outro", async () => {
    const gestorId = await uid(gestor);
    const { error } = await vol.from("equipments").insert({
      church_id: churchId,
      name: "Em nome de outro",
      owner_id: gestorId,
    });
    expect(error).not.toBeNull();
  });

  it("gestor cadastra equipamento da igreja e pessoal de alguém", async () => {
    const volId = await uid(vol);
    const { error: e1 } = await gestor
      .from("equipments")
      .insert({ church_id: churchId, name: "Mesa da igreja", owner_id: null });
    expect(e1).toBeNull();

    const { error: e2 } = await gestor.from("equipments").insert({
      church_id: churchId,
      name: "Tripé do vol (cadastrado pelo gestor)",
      owner_id: volId,
    });
    expect(e2).toBeNull();
  });

  it("voluntário edita o próprio, mas não o da igreja", async () => {
    const volId = await uid(vol);
    const { data: meu } = await vol
      .from("equipments")
      .select("id")
      .eq("owner_id", volId)
      .eq("name", "Câmera do vol")
      .single();
    const { data: upMeu } = await vol
      .from("equipments")
      .update({ name: "Câmera do vol (editada)" })
      .eq("id", meu!.id)
      .select();
    expect(upMeu).toHaveLength(1);

    const { data: mesa } = await gestor
      .from("equipments")
      .select("id")
      .eq("name", "Mesa da igreja")
      .single();
    const { data: upMesa } = await vol
      .from("equipments")
      .update({ name: "Hackeada" })
      .eq("id", mesa!.id)
      .select();
    expect(upMesa).toEqual([]);
  });
});
