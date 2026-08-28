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

// Papel Coordenador de igreja (migrations 13+14): gestão operacional
// plena da própria igreja, mas SEM as "chaves" (renomear/apagar igreja,
// promover papel) e SEM vazar para outra igreja.
describe("Papel Coordenador de igreja (RLS)", () => {
  let dono: SupabaseClient; // admin da igreja A
  let coord: SupabaseClient; // coordenador da igreja A
  let outro: SupabaseClient; // admin da igreja B (vítima)
  let churchA: string;
  let churchB: string;
  let coordId: string;
  const run = Date.now();

  beforeAll(async () => {
    dono = await newUser(`co-dono-${run}@teste.dev`);
    coord = await newUser(`co-coord-${run}@teste.dev`);
    outro = await newUser(`co-outro-${run}@teste.dev`);

    churchA = (
      await dono.rpc("create_church", { p_name: "Igreja Co A", p_slug: `co-a-${run}` })
    ).data;
    churchB = (
      await outro.rpc("create_church", { p_name: "Igreja Co B", p_slug: `co-b-${run}` })
    ).data;

    // coord entra em A e é promovido a coordenador pelo dono
    const { data: chA } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    await coord.rpc("join_church", { p_invite_code: chA!.invite_code });
    coordId = (await coord.auth.getUser()).data.user!.id;

    const promo = await dono
      .from("church_members")
      .update({ role: "coordenador" })
      .eq("church_id", churchA)
      .eq("user_id", coordId)
      .select();
    expect(promo.error).toBeNull();
    expect(promo.data).toHaveLength(1);
  });

  it("coordenador gerencia equipamentos da própria igreja", async () => {
    const { error } = await coord
      .from("equipments")
      .insert({ church_id: churchA, name: "Camera do Coord" });
    expect(error).toBeNull();
  });

  it("coordenador cria ministério e organiza pessoas nele", async () => {
    const { data: min, error } = await coord
      .from("ministries")
      .insert({ church_id: churchA, name: "Louvor", slug: `louvor-${run}` })
      .select("id")
      .single();
    expect(error).toBeNull();

    const { error: mmErr } = await coord.from("ministry_members").insert({
      ministry_id: min!.id,
      church_id: churchA,
      user_id: coordId,
      role: "lider",
    });
    expect(mmErr).toBeNull();
  });

  it("coordenador NÃO renomeia a igreja", async () => {
    const { data } = await coord
      .from("churches")
      .update({ name: "Renomeada pelo Coord" })
      .eq("id", churchA)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("coordenador NÃO apaga a igreja", async () => {
    const { data } = await coord
      .from("churches")
      .delete()
      .eq("id", churchA)
      .select();
    expect(data ?? []).toHaveLength(0);
    // a igreja continua lá
    const { data: still } = await dono
      .from("churches")
      .select("id")
      .eq("id", churchA);
    expect(still).toHaveLength(1);
  });

  it("coordenador NÃO promove ninguém a admin (nem a coordenador)", async () => {
    const alvo = await newUser(`co-alvo-${run}@teste.dev`);
    const { data: chA } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    await alvo.rpc("join_church", { p_invite_code: chA!.invite_code });
    const alvoId = (await alvo.auth.getUser()).data.user!.id;

    const { data } = await coord
      .from("church_members")
      .update({ role: "admin" })
      .eq("church_id", churchA)
      .eq("user_id", alvoId)
      .select();
    expect(data ?? []).toHaveLength(0);
  });

  it("coordenador de A NÃO enxerga nem gerencia a igreja B", async () => {
    // não lê equipamentos de B
    const { data: eqB } = await coord
      .from("equipments")
      .select("id")
      .eq("church_id", churchB);
    expect(eqB).toEqual([]);

    // não cria equipamento em B
    const { error } = await coord
      .from("equipments")
      .insert({ church_id: churchB, name: "Invasao" });
    expect(error).not.toBeNull();
  });
});
