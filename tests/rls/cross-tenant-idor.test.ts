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

// Regressão do furo crítico: escalação cross-tenant via ministry_members.
// Um gerente de um ministério da PRÓPRIA igreja tentava reescrever o
// church_id da sua linha para o de OUTRA igreja e virar gerente dela.
// A migration 11 (trigger + helpers com join real) deve impedir isso.
describe("Escalação cross-tenant via ministry_members (regressão furo #1)", () => {
  let atacante: SupabaseClient; // admin da própria igreja A
  let vitima: SupabaseClient; // admin da igreja-alvo B
  let churchA: string;
  let churchB: string;
  let ministryA: string;
  let atacanteId: string;
  const run = Date.now();

  beforeAll(async () => {
    atacante = await newUser(`atk-${run}@teste.dev`);
    vitima = await newUser(`vit-${run}@teste.dev`);

    churchA = (
      await atacante.rpc("create_church", {
        p_name: "Igreja Atacante",
        p_slug: `igreja-atk-${run}`,
      })
    ).data;
    churchB = (
      await vitima.rpc("create_church", {
        p_name: "Igreja Vitima",
        p_slug: `igreja-vit-${run}`,
      })
    ).data;

    atacanteId = (await atacante.auth.getUser()).data.user!.id;

    // atacante cria um ministério na PRÓPRIA igreja e vira gerente dele
    ministryA = (
      await atacante
        .from("ministries")
        .insert({ church_id: churchA, name: "Midia Atk", slug: `midia-${run}` })
        .select("id")
        .single()
    ).data!.id;

    const seed = await atacante.from("ministry_members").insert({
      ministry_id: ministryA,
      church_id: churchA,
      user_id: atacanteId,
      role: "gerente",
    });
    expect(seed.error).toBeNull();
  });

  it("trigger força church_id de volta ao da igreja dona do ministério", async () => {
    // ATAQUE: tenta reescrever o church_id da própria linha para a igreja B
    await atacante
      .from("ministry_members")
      .update({ church_id: churchB })
      .eq("ministry_id", ministryA)
      .eq("user_id", atacanteId);

    // A linha deve permanecer ancorada na igreja A (o trigger sobrescreveu)
    const { data } = await admin
      .from("ministry_members")
      .select("church_id")
      .eq("ministry_id", ministryA)
      .eq("user_id", atacanteId)
      .single();
    expect(data?.church_id).toBe(churchA);
    expect(data?.church_id).not.toBe(churchB);
  });

  it("atacante NÃO consegue gerir equipamentos da igreja B", async () => {
    // is_church_manager(B) deve ser false → RLS bloqueia a escrita
    const { data, error } = await atacante
      .from("equipments")
      .insert({ church_id: churchB, name: "Camera Roubada" })
      .select("id");
    // RLS bloqueia: ou retorna erro, ou nenhuma linha inserida
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});

// Regressão dos IDORs cross-tenant (migration 12): evaluations,
// maintenance_tickets e assignment_equipments não podem referenciar
// entidades de outra igreja.
describe("IDOR cross-tenant em evaluations/tickets/vínculos (migration 12)", () => {
  let ligaA: SupabaseClient; // admin igreja A (atacante)
  let ligaB: SupabaseClient; // admin igreja B (vítima)
  let volB: SupabaseClient; // voluntário da igreja B
  let churchA: string;
  let churchB: string;
  let equipmentB: string;
  let assignmentB: string;
  let assignmentA: string;
  const run = Date.now();

  beforeAll(async () => {
    ligaA = await newUser(`idorA-${run}@teste.dev`);
    ligaB = await newUser(`idorB-${run}@teste.dev`);
    volB = await newUser(`idorVolB-${run}@teste.dev`);

    churchA = (
      await ligaA.rpc("create_church", { p_name: "IDOR A", p_slug: `idor-a-${run}` })
    ).data;
    churchB = (
      await ligaB.rpc("create_church", { p_name: "IDOR B", p_slug: `idor-b-${run}` })
    ).data;

    // volB entra na igreja B
    const { data: chB } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchB)
      .single();
    await volB.rpc("join_church", { p_invite_code: chB!.invite_code });
    const volBId = (await volB.auth.getUser()).data.user!.id;

    // entidades da igreja B (alvo)
    equipmentB = (
      await ligaB
        .from("equipments")
        .insert({ church_id: churchB, name: "Projetor B" })
        .select("id")
        .single()
    ).data!.id;
    const eventB = (
      await ligaB
        .from("events")
        .insert({ church_id: churchB, title: "Culto B", starts_at: new Date().toISOString() })
        .select("id")
        .single()
    ).data!.id;
    assignmentB = (
      await ligaB
        .from("assignments")
        .insert({ church_id: churchB, event_id: eventB, user_id: volBId, role_name: "Projecao" })
        .select("id")
        .single()
    ).data!.id;

    // entidades da própria igreja A (do atacante)
    const eventA = (
      await ligaA
        .from("events")
        .insert({ church_id: churchA, title: "Culto A", starts_at: new Date().toISOString() })
        .select("id")
        .single()
    ).data!.id;
    assignmentA = (
      await ligaA
        .from("assignments")
        .insert({
          church_id: churchA,
          event_id: eventA,
          user_id: (await ligaA.auth.getUser()).data.user!.id,
          role_name: "Camera",
        })
        .select("id")
        .single()
    ).data!.id;
  });

  it("S-5: atacante não abre chamado sobre equipamento de outra igreja", async () => {
    const { error } = await ligaA.from("maintenance_tickets").insert({
      church_id: churchA, // forja a própria igreja
      equipment_id: equipmentB, // mas o equipamento é da igreja B
      title: "Sabotagem",
    });
    expect(error).not.toBeNull();

    // o equipamento da vítima NÃO entrou em manutenção
    const { data: eq } = await ligaB
      .from("equipments")
      .select("status")
      .eq("id", equipmentB)
      .single();
    expect(eq!.status).toBe("disponivel");
  });

  it("S-7: atacante não vincula equipamento de outra igreja a uma escala sua", async () => {
    const { error } = await ligaA.from("assignment_equipments").insert({
      assignment_id: assignmentA, // escala da igreja A
      equipment_id: equipmentB, // equipamento da igreja B
      church_id: churchA,
    });
    expect(error).not.toBeNull();
  });

  it("S-4: atacante não fabrica avaliação usando escala de outra igreja", async () => {
    const { data, error } = await ligaA
      .from("evaluations")
      .insert({
        church_id: churchA, // forja a própria igreja
        assignment_id: assignmentB, // escala da igreja B
        event_id: assignmentB, // irrelevante: será derivado
        user_id: (await ligaA.auth.getUser()).data.user!.id,
        pontualidade: 1,
        organizacao: 1,
        conhecimento: 1,
        comunicacao: 1,
        trabalho_equipe: 1,
        comprometimento: 1,
        notes: "difamacao",
      })
      .select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
