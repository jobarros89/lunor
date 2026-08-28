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
  return (await c.auth.getUser()).data.user!.id;
}

// A PAREDE por setor (ministério): escala/equipamento isolados entre setores;
// coordenador da igreja vê e gere tudo.
describe("Escopo por setor — isolamento (migrations 20/21)", () => {
  let coord: SupabaseClient; // admin/coordenador da igreja (vê tudo)
  let midiaLider: SupabaseClient;
  let louvorLider: SupabaseClient;
  let midiaVol: SupabaseClient;
  let midiaVol2: SupabaseClient; // colega do MESMO setor (privacidade de avaliação)
  let louvorVol: SupabaseClient;
  let churchId: string;
  let midiaId: string;
  let louvorId: string;
  let eventId: string;
  let asgMidia: string;
  let asgLouvor: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`coord-${run}@teste.dev`);
    midiaLider = await newUser(`ml-${run}@teste.dev`);
    louvorLider = await newUser(`ll-${run}@teste.dev`);
    midiaVol = await newUser(`mv-${run}@teste.dev`);
    midiaVol2 = await newUser(`mv2-${run}@teste.dev`);
    louvorVol = await newUser(`lv-${run}@teste.dev`);

    churchId = (
      await coord.rpc("create_church", {
        p_name: "Igreja Setores",
        p_slug: `setores-${run}`,
      })
    ).data;

    // Mídia já existe (create_church cria); cria Louvor.
    midiaId = (
      await admin
        .from("ministries")
        .select("id")
        .eq("church_id", churchId)
        .eq("slug", "midia")
        .single()
    ).data!.id;
    louvorId = (
      await coord
        .from("ministries")
        .insert({ church_id: churchId, name: "Louvor", slug: "louvor" })
        .select("id")
        .single()
    ).data!.id;

    // todos entram na igreja e o coord distribui nos setores
    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
    for (const c of [midiaLider, louvorLider, midiaVol, midiaVol2, louvorVol]) {
      await c.rpc("join_church", { p_invite_code: invite });
    }
    await admin.from("ministry_members").insert([
      { ministry_id: midiaId, church_id: churchId, user_id: await uid(midiaLider), role: "lider" },
      { ministry_id: louvorId, church_id: churchId, user_id: await uid(louvorLider), role: "lider" },
      { ministry_id: midiaId, church_id: churchId, user_id: await uid(midiaVol), role: "voluntario" },
      { ministry_id: midiaId, church_id: churchId, user_id: await uid(midiaVol2), role: "voluntario" },
      { ministry_id: louvorId, church_id: churchId, user_id: await uid(louvorVol), role: "voluntario" },
    ]);

    // evento compartilhado
    eventId = (
      await coord
        .from("events")
        .insert({ church_id: churchId, title: "Culto", starts_at: new Date().toISOString() })
        .select("id")
        .single()
    ).data!.id;

    // cada setor escala o seu voluntário no MESMO evento
    asgMidia = (
      await midiaLider
        .from("assignments")
        .insert({
          church_id: churchId,
          ministry_id: midiaId,
          event_id: eventId,
          user_id: await uid(midiaVol),
          role_name: "Câmera",
        })
        .select("id")
        .single()
    ).data!.id;
    asgLouvor = (
      await louvorLider
        .from("assignments")
        .insert({
          church_id: churchId,
          ministry_id: louvorId,
          event_id: eventId,
          user_id: await uid(louvorVol),
          role_name: "Guitarra",
        })
        .select("id")
        .single()
    ).data!.id;
  });

  it("voluntário do Louvor NÃO vê a escala da Mídia (e vice-versa)", async () => {
    const { data: verLouvor } = await louvorVol
      .from("assignments")
      .select("id, ministry_id")
      .eq("event_id", eventId);
    const ids = (verLouvor ?? []).map((a) => a.id);
    expect(ids).toContain(asgLouvor);
    expect(ids).not.toContain(asgMidia);

    const { data: verMidia } = await midiaVol
      .from("assignments")
      .select("id")
      .eq("event_id", eventId);
    const idsM = (verMidia ?? []).map((a) => a.id);
    expect(idsM).toContain(asgMidia);
    expect(idsM).not.toContain(asgLouvor);
  });

  it("coordenador da igreja vê as escalas de TODOS os setores", async () => {
    const { data } = await coord
      .from("assignments")
      .select("id")
      .eq("event_id", eventId);
    const ids = (data ?? []).map((a) => a.id);
    expect(ids).toContain(asgMidia);
    expect(ids).toContain(asgLouvor);
  });

  it("líder do Louvor NÃO consegue escalar na Mídia", async () => {
    const { data, error } = await louvorLider
      .from("assignments")
      .insert({
        church_id: churchId,
        ministry_id: midiaId, // setor que ele não lidera
        event_id: eventId,
        user_id: await uid(louvorVol),
        role_name: "Invasao",
      })
      .select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("líder do Louvor NÃO gere a escala da Mídia", async () => {
    await louvorLider
      .from("assignments")
      .update({ role_name: "Sabotado" })
      .eq("id", asgMidia);
    const { data } = await admin
      .from("assignments")
      .select("role_name")
      .eq("id", asgMidia)
      .single();
    expect(data!.role_name).toBe("Câmera"); // inalterado
  });

  // Avaliação é feedback de desempenho: só a própria pessoa, a liderança do setor
  // e o coordenador podem ler. Um COLEGA do mesmo setor não pode.
  it("colega do mesmo setor NÃO lê a avaliação de outro voluntário", async () => {
    const alvo = await uid(midiaVol);
    const ins = await midiaLider.from("evaluations").insert({
      church_id: churchId,
      assignment_id: asgMidia,
      event_id: eventId,
      user_id: alvo,
      pontualidade: 5,
      organizacao: 5,
      conhecimento: 5,
      comunicacao: 5,
      trabalho_equipe: 5,
      comprometimento: 5,
      notes: "feedback reservado",
    });
    expect(ins.error).toBeNull();

    // o colega do mesmo setor não pode ver
    const { data: colega } = await midiaVol2
      .from("evaluations")
      .select("id, notes")
      .eq("assignment_id", asgMidia);
    expect(colega ?? []).toEqual([]);

    // a própria pessoa vê
    const { data: propria } = await midiaVol
      .from("evaluations")
      .select("id")
      .eq("assignment_id", asgMidia);
    expect((propria ?? []).length).toBe(1);

    // a liderança do setor vê
    const { data: lider } = await midiaLider
      .from("evaluations")
      .select("id")
      .eq("assignment_id", asgMidia);
    expect((lider ?? []).length).toBe(1);
  });

  it("equipamento do setor é isolado; compartilhado (null) é visível a todos", async () => {
    const midiaEq = (
      await coord
        .from("equipments")
        .insert({ church_id: churchId, ministry_id: midiaId, name: "Câmera da Mídia" })
        .select("id")
        .single()
    ).data!.id;
    const sharedEq = (
      await coord
        .from("equipments")
        .insert({ church_id: churchId, ministry_id: null, name: "Projetor Compartilhado" })
        .select("id")
        .single()
    ).data!.id;

    const { data } = await louvorVol.from("equipments").select("id").eq("church_id", churchId);
    const ids = (data ?? []).map((e) => e.id);
    expect(ids).toContain(sharedEq); // compartilhado: vê
    expect(ids).not.toContain(midiaEq); // da Mídia: não vê
  });
});
