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

describe("Onde servir? (RLS)", () => {
  let adminC: SupabaseClient;
  let gerente: SupabaseClient;
  let lider: SupabaseClient;
  let membro: SupabaseClient;
  let churchId: string;
  let ministryId: string;
  let otherMinistryId: string;
  let gerenteUserId: string;
  const run = Date.now();

  beforeAll(async () => {
    adminC = await newUser(`dep-admin-${run}@teste.dev`);
    gerente = await newUser(`dep-gerente-${run}@teste.dev`);
    lider = await newUser(`dep-lider-${run}@teste.dev`);
    membro = await newUser(`dep-membro-${run}@teste.dev`);

    const a = await adminC.rpc("create_church", {
      p_name: "Igreja Dep",
      p_slug: `igreja-dep-${run}`,
    });
    churchId = a.data;

    const { data: ministry } = await adminC
      .from("ministries")
      .insert({ church_id: churchId, name: "Louvor", slug: `louvor-${run}` })
      .select("id")
      .single();
    ministryId = ministry!.id;

    const { data: otherMinistry } = await adminC
      .from("ministries")
      .insert({ church_id: churchId, name: "Kids", slug: `kids-${run}` })
      .select("id")
      .single();
    otherMinistryId = otherMinistry!.id;

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();

    for (const client of [gerente, lider, membro]) {
      await client.rpc("join_church", { p_invite_code: church!.invite_code });
    }

    const users = await Promise.all(
      [gerente, lider].map(async (client) => (await client.auth.getUser()).data.user!.id)
    );
    gerenteUserId = users[0];

    await adminC.from("ministry_members").insert([
      {
        church_id: churchId,
        ministry_id: ministryId,
        user_id: users[0],
        role: "gerente",
      },
      {
        church_id: churchId,
        ministry_id: ministryId,
        user_id: users[1],
        role: "lider",
      },
    ]);
  });

  it("admin cria opção de Onde servir?", async () => {
    const { error } = await adminC.from("departments").insert({
      church_id: churchId,
      ministry_id: ministryId,
      name: "Vocal",
    });
    expect(error).toBeNull();
  });

  it("gerente cria opção no próprio ministério", async () => {
    const { error } = await gerente.from("departments").insert({
      church_id: churchId,
      ministry_id: ministryId,
      name: "Banda",
    });
    expect(error).toBeNull();
  });

  it("líder cria opção no próprio ministério", async () => {
    const { error } = await lider.from("departments").insert({
      church_id: churchId,
      ministry_id: ministryId,
      name: "Vocal 2",
    });
    expect(error).toBeNull();
  });

  it("líder não cria opção em outro ministério", async () => {
    const { error } = await lider.from("departments").insert({
      church_id: churchId,
      ministry_id: otherMinistryId,
      name: "Berçário",
    });
    expect(error).not.toBeNull();
  });

  it("membro comum lê as opções mas não cria", async () => {
    const { data } = await membro
      .from("departments")
      .select("name")
      .eq("church_id", churchId);
    expect(data!.map((d) => d.name)).toContain("Vocal");

    const { error } = await membro.from("departments").insert({
      church_id: churchId,
      ministry_id: ministryId,
      name: "Pirata",
    });
    expect(error).not.toBeNull();
  });

  it("evento é criado sem Onde servir?; a área fica na pessoa escalada", async () => {
    const { data: dep } = await adminC
      .from("departments")
      .select("id")
      .eq("church_id", churchId)
      .eq("ministry_id", ministryId)
      .eq("name", "Vocal")
      .single();

    const { data: event, error: eventError } = await adminC
      .from("events")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        title: "Culto de Louvor",
        starts_at: new Date().toISOString(),
        department_id: null,
      })
      .select("id, department_id")
      .single();
    expect(eventError).toBeNull();
    expect(event!.department_id).toBeNull();

    const { data: assignment, error } = await adminC
      .from("assignments")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        event_id: event!.id,
        user_id: gerenteUserId,
        role_name: "Vocal",
        department_id: dep!.id,
      })
      .select("department_id")
      .single();

    expect(error).toBeNull();
    expect(assignment!.department_id).toBe(dep!.id);
  });

  it("escala rejeita Onde servir? de outro ministério", async () => {
    const { data: otherDep, error: depError } = await adminC
      .from("departments")
      .insert({
        church_id: churchId,
        ministry_id: otherMinistryId,
        name: "Berçário",
      })
      .select("id")
      .single();
    expect(depError).toBeNull();

    const { data: event } = await adminC
      .from("events")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        title: "Culto com área inválida",
        starts_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .select("id")
      .single();

    const { error } = await adminC.from("assignments").insert({
      church_id: churchId,
      ministry_id: ministryId,
      event_id: event!.id,
      user_id: gerenteUserId,
      role_name: "Vocal",
      department_id: otherDep!.id,
    });

    expect(error).not.toBeNull();
  });
});
