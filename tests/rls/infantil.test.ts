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
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await c.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return c;
}
const uid = async (c: SupabaseClient) => (await c.auth.getUser()).data.user!.id;

// Módulo Infantil: dados de menores atrás da parede do setor + segurança na entrega.
describe("Infantil — parede e retirada autorizada (migration 23)", () => {
  let coord: SupabaseClient; // admin da igreja
  let infLider: SupabaseClient; // líder do Infantil
  let infVol: SupabaseClient; // voluntário do Infantil (plantão)
  let midiaVol: SupabaseClient; // OUTRO setor — não pode ver nada
  let churchId: string;
  let infantilId: string;
  let midiaId: string;
  let eventId: string;
  let childId: string;
  let maeId: string; // responsável AUTORIZADO
  let estranhoId: string; // responsável NÃO autorizado
  let checkinId: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`inf-coord-${run}@teste.dev`);
    infLider = await newUser(`inf-lider-${run}@teste.dev`);
    infVol = await newUser(`inf-vol-${run}@teste.dev`);
    midiaVol = await newUser(`inf-midia-${run}@teste.dev`);

    churchId = (
      await coord.rpc("create_church", { p_name: "Igreja Infantil", p_slug: `inf-${run}` })
    ).data;
    midiaId = (
      await admin.from("ministries").select("id").eq("church_id", churchId).eq("slug", "midia").single()
    ).data!.id;
    infantilId = (
      await coord
        .from("ministries")
        .insert({ church_id: churchId, name: "Infantil", slug: "infantil" })
        .select("id")
        .single()
    ).data!.id;

    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
    for (const c of [infLider, infVol, midiaVol]) {
      await c.rpc("join_church", { p_invite_code: invite });
    }
    await admin.from("ministry_members").insert([
      { ministry_id: infantilId, church_id: churchId, user_id: await uid(infLider), role: "lider" },
      { ministry_id: infantilId, church_id: churchId, user_id: await uid(infVol), role: "voluntario" },
      { ministry_id: midiaId, church_id: churchId, user_id: await uid(midiaVol), role: "voluntario" },
    ]);

    await coord.rpc("seed_child_classes", { p_ministry: infantilId });

    // responsáveis
    maeId = (
      await infLider
        .from("guardians")
        .insert({ church_id: churchId, ministry_id: infantilId, full_name: "Maria (mãe)" })
        .select("id")
        .single()
    ).data!.id;
    estranhoId = (
      await infLider
        .from("guardians")
        .insert({ church_id: churchId, ministry_id: infantilId, full_name: "Pessoa Não Autorizada" })
        .select("id")
        .single()
    ).data!.id;

    // criança + autorização (só a mãe pode retirar)
    childId = (
      await infLider
        .from("children")
        .insert({
          church_id: churchId,
          ministry_id: infantilId,
          full_name: "Joãozinho",
          birth_date: "2021-05-10",
          allergies: "amendoim",
          consent_guardian_id: maeId,
        })
        .select("id")
        .single()
    ).data!.id;
    const auth = await infLider.from("child_guardians").insert([
      { child_id: childId, guardian_id: maeId, church_id: churchId, relationship: "mãe", can_pickup: true, is_primary: true },
      // insert em lote: o PostgREST usa a união das colunas e preenche as
      // ausentes com null — por isso is_primary vai explícito aqui.
      { child_id: childId, guardian_id: estranhoId, church_id: churchId, relationship: "conhecido", can_pickup: false, is_primary: false },
    ]);
    if (auth.error) throw new Error("setup child_guardians: " + JSON.stringify(auth.error));

    eventId = (
      await coord
        .from("events")
        .insert({ church_id: churchId, title: "Culto", starts_at: new Date().toISOString() })
        .select("id")
        .single()
    ).data!.id;

    // o voluntário de plantão faz o check-in
    checkinId = (
      await infVol
        .from("child_checkins")
        .insert({
          church_id: churchId,
          ministry_id: infantilId,
          event_id: eventId,
          child_id: childId,
          code: "042",
          checked_in_by: await uid(infVol),
        })
        .select("id")
        .single()
    ).data!.id;
  });

  it("outro setor NÃO enxerga crianças, responsáveis nem presenças", async () => {
    const c = await midiaVol.from("children").select("id").eq("church_id", churchId);
    const g = await midiaVol.from("guardians").select("id").eq("church_id", churchId);
    const k = await midiaVol.from("child_checkins").select("id").eq("church_id", churchId);
    expect(c.data ?? []).toEqual([]);
    expect(g.data ?? []).toEqual([]);
    expect(k.data ?? []).toEqual([]);
  });

  it("voluntário do Infantil lê a ficha; coordenador também", async () => {
    const v = await infVol.from("children").select("id, allergies").eq("id", childId);
    expect((v.data ?? []).length).toBe(1);
    expect(v.data![0].allergies).toBe("amendoim");
    const co = await coord.from("children").select("id").eq("id", childId);
    expect((co.data ?? []).length).toBe(1);
  });

  it("voluntário NÃO edita a ficha da criança (só liderança)", async () => {
    await infVol.from("children").update({ full_name: "Alterado" }).eq("id", childId);
    const { data } = await admin.from("children").select("full_name").eq("id", childId).single();
    expect(data!.full_name).toBe("Joãozinho");
  });

  it("BLOQUEIA retirada por pessoa não autorizada", async () => {
    const { error } = await infVol
      .from("child_checkins")
      .update({ picked_up_by: estranhoId, checked_out_at: new Date().toISOString() })
      .eq("id", checkinId);
    expect(error).not.toBeNull();
    const { data } = await admin.from("child_checkins").select("picked_up_by").eq("id", checkinId).single();
    expect(data!.picked_up_by).toBeNull(); // não saiu
  });

  it("voluntário não consegue liberar exceção sozinho (exige liderança)", async () => {
    const { error } = await infVol
      .from("child_checkins")
      .update({
        picked_up_by: estranhoId,
        override_reason: "mae presa no transito, avo veio buscar",
        checked_out_at: new Date().toISOString(),
      })
      .eq("id", checkinId);
    expect(error).not.toBeNull();
  });

  it("liderança libera exceção COM justificativa (fica registrada)", async () => {
    const { error } = await infLider
      .from("child_checkins")
      .update({
        picked_up_by: estranhoId,
        override_reason: "mae autorizou por telefone, conferido documento",
        checked_out_at: new Date().toISOString(),
      })
      .eq("id", checkinId);
    expect(error).toBeNull();
    const { data } = await admin
      .from("child_checkins")
      .select("picked_up_by, override_reason, override_by")
      .eq("id", checkinId)
      .single();
    expect(data!.picked_up_by).toBe(estranhoId);
    expect(data!.override_reason).toContain("documento");
    expect(data!.override_by).not.toBeNull(); // quem liberou fica gravado
  });

  it("retirada por responsável AUTORIZADO passa direto", async () => {
    // nova sessão para testar o caminho feliz
    const ev2 = (
      await coord
        .from("events")
        .insert({ church_id: churchId, title: "Culto 2", starts_at: new Date().toISOString() })
        .select("id")
        .single()
    ).data!.id;
    const ci = (
      await infVol
        .from("child_checkins")
        .insert({ church_id: churchId, ministry_id: infantilId, event_id: ev2, child_id: childId, code: "777" })
        .select("id")
        .single()
    ).data!.id;

    const { error } = await infVol
      .from("child_checkins")
      .update({ picked_up_by: maeId, checked_out_at: new Date().toISOString() })
      .eq("id", ci);
    expect(error).toBeNull();
    const { data } = await admin.from("child_checkins").select("picked_up_by, override_reason").eq("id", ci).single();
    expect(data!.picked_up_by).toBe(maeId);
    expect(data!.override_reason).toBeNull(); // sem exceção: fluxo normal
  });

  // Fase B — o anúncio precisa ATRAVESSAR a parede (a igreja toda vê o
  // chamado) levando só o código; nunca o nome da criança.
  it("anúncio mostra o código à igreja inteira, sem vazar a criança", async () => {
    const { error: pErr } = await infLider.from("child_pages").insert({
      church_id: churchId,
      ministry_id: infantilId,
      event_id: eventId,
      checkin_id: checkinId,
      kind: "chamar",
    });
    expect(pErr).toBeNull();

    // membro de OUTRO setor vê o código pelo anúncio…
    const { data: anuncio } = await midiaVol.rpc("anuncios_infantil", {
      p_church: churchId,
    });
    expect((anuncio ?? []).length).toBeGreaterThan(0);
    expect((anuncio ?? [])[0].code).toBe("042");

    // …mas segue sem enxergar a chamada em si nem a criança
    const { data: pages } = await midiaVol.from("child_pages").select("id");
    expect(pages ?? []).toEqual([]);
    const { data: kids } = await midiaVol.from("children").select("full_name");
    expect(kids ?? []).toEqual([]);
  });

  it("anúncio não vaza para OUTRA igreja", async () => {
    const forasteiro = await newUser(`fora-${run}@teste.dev`);
    await forasteiro.rpc("create_church", {
      p_name: "Igreja Alheia",
      p_slug: `alheia-${run}`,
    });
    const { data } = await forasteiro.rpc("anuncios_infantil", {
      p_church: churchId,
    });
    expect(data ?? []).toEqual([]);
  });

  it("retirada encerra a chamada pendente (o aviso para de piscar)", async () => {
    const ev3 = (
      await coord
        .from("events")
        .insert({ church_id: churchId, title: "Culto 3", starts_at: new Date().toISOString() })
        .select("id")
        .single()
    ).data!.id;
    const ci = (
      await infVol
        .from("child_checkins")
        .insert({ church_id: churchId, ministry_id: infantilId, event_id: ev3, child_id: childId, code: "555" })
        .select("id")
        .single()
    ).data!.id;
    await infLider.from("child_pages").insert({
      church_id: churchId,
      ministry_id: infantilId,
      event_id: ev3,
      checkin_id: ci,
      kind: "chamar",
    });

    await infVol
      .from("child_checkins")
      .update({ picked_up_by: maeId, checked_out_at: new Date().toISOString() })
      .eq("id", ci);

    const { data } = await admin
      .from("child_pages")
      .select("resolved_at")
      .eq("checkin_id", ci)
      .single();
    expect(data!.resolved_at).not.toBeNull();
  });
});
