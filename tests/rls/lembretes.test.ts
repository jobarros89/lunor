import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await admin.auth.admin.createUser({
    email, password: "senha-teste-123", email_confirm: true,
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

// "Amanhã" no fuso da igreja, às 19h — é o que a RPC procura.
function amanhaAs19(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)!.value);
  const d = new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 22));
  d.setUTCDate(d.getUTCDate() + 1);
  // 19h em São Paulo (UTC-3) = 22h UTC
  return d.toISOString();
}

describe("Lembretes agendados (migration 28)", () => {
  const SEGREDO = `segredo-de-teste-${Date.now()}`;
  let lider: SupabaseClient;
  let voluntario: SupabaseClient;
  let churchId: string, eventId: string, louvorId: string;
  let liderId: string, volId: string;
  const run = Date.now();

  beforeAll(async () => {
    await admin.from("cron_secret").insert({ secret: SEGREDO });

    lider = await newUser(`lem-lider-${run}@teste.dev`);
    voluntario = await newUser(`lem-vol-${run}@teste.dev`);
    liderId = await uid(lider);
    volId = await uid(voluntario);

    churchId = (
      await lider.rpc("create_church", { p_name: "Igreja Lembrete", p_slug: `lem-${run}` })
    ).data;
    louvorId = (
      await lider
        .from("ministries")
        .insert({ church_id: churchId, name: "Louvor", slug: "louvor" })
        .select("id").single()
    ).data!.id;
    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
    await voluntario.rpc("join_church", { p_invite_code: invite });
    await admin.from("ministry_members").insert([
      { ministry_id: louvorId, church_id: churchId, user_id: liderId, role: "lider" },
      { ministry_id: louvorId, church_id: churchId, user_id: volId, role: "voluntario" },
    ]);

    eventId = (
      await lider
        .from("events")
        .insert({ church_id: churchId, title: "Culto de amanhã", starts_at: amanhaAs19() })
        .select("id").single()
    ).data!.id;

    // o voluntário está escalado e ainda NÃO confirmou
    await admin.from("assignments").insert({
      church_id: churchId, event_id: eventId, user_id: volId,
      ministry_id: louvorId, role_name: "Vocal", status: "convidado",
    });

    // os dois têm o push ligado no celular
    await admin.from("push_subscriptions").insert([
      { church_id: churchId, user_id: volId, endpoint: `https://push.test/${run}-vol`, p256dh: "k", auth: "a" },
      { church_id: churchId, user_id: liderId, endpoint: `https://push.test/${run}-lider`, p256dh: "k", auth: "a" },
    ]);
  });

  // Sem isso, qualquer um com a chave anon (que é pública) leria as inscrições
  // de push da igreja inteira.
  it("sem o segredo, a função recusa", async () => {
    const { error } = await anon.rpc("lembretes_do_dia", { p_secret: "chute" });
    expect(error).not.toBeNull();
  });

  it("com segredo nulo também recusa", async () => {
    const { error } = await anon.rpc("lembretes_do_dia", { p_secret: null });
    expect(error).not.toBeNull();
  });

  it("ninguém lê a tabela de segredo pelo PostgREST", async () => {
    const { data } = await lider.from("cron_secret").select("secret");
    expect(data ?? []).toHaveLength(0);
  });

  it("avisa o voluntário na véspera do culto", async () => {
    const { data, error } = await anon.rpc("lembretes_do_dia", { p_secret: SEGREDO });
    expect(error).toBeNull();
    const meus = (data ?? []).filter((r: { user_id: string }) => r.user_id === volId);
    const vespera = meus.find((r: { titulo: string }) => r.titulo === "Você serve amanhã");
    expect(vespera).toBeTruthy();
    expect(vespera.corpo).toContain("Culto de amanhã");
    expect(vespera.corpo).toContain("Vocal");
    expect(vespera.endpoint).toContain("vol");
  });

  // Um cron que reenvia é pior que um cron que não envia.
  it("rodar de novo no mesmo dia NÃO reenvia nada", async () => {
    const { data } = await anon.rpc("lembretes_do_dia", { p_secret: SEGREDO });
    const desteEvento = (data ?? []).filter((r: { url: string }) => r.url.includes(eventId));
    expect(desteEvento).toHaveLength(0);
  });

  it("registrou o envio para não repetir", async () => {
    const { data } = await admin
      .from("reminders_sent")
      .select("kind")
      .eq("user_id", volId);
    expect((data ?? []).map((r) => r.kind)).toContain("vespera");
  });

  it("cobrou a liderança sobre quem não confirmou", async () => {
    const { data } = await admin
      .from("reminders_sent")
      .select("kind, ref_id")
      .eq("user_id", liderId)
      .eq("kind", "confirmacao_pendente");
    expect(data).toHaveLength(1);
    expect(data![0].ref_id).toBe(eventId);
  });

  it("avisa o louvor que o repertório segue em rascunho", async () => {
    // o culto de amanhã ganhou músicas mas não foi publicado
    const songId = (
      await lider
        .from("songs")
        .insert({ church_id: churchId, title: `Música ${run}` })
        .select("id").single()
    ).data!.id;
    await lider.from("setlist_items").insert({
      church_id: churchId, event_id: eventId, song_id: songId, position: 1,
    });

    const { data } = await anon.rpc("lembretes_do_dia", { p_secret: SEGREDO });
    const aviso = (data ?? []).find(
      (r: { titulo: string }) => r.titulo === "Repertório ainda não publicado"
    );
    expect(aviso).toBeTruthy();
    expect(aviso.user_id).toBe(liderId);
  });

  it("publicado o repertório, o aviso não volta", async () => {
    await admin.from("reminders_sent").delete().eq("kind", "repertorio_rascunho");
    await admin
      .from("events")
      .update({ setlist_status: "publicado" })
      .eq("id", eventId);
    const { data } = await anon.rpc("lembretes_do_dia", { p_secret: SEGREDO });
    const aviso = (data ?? []).find(
      (r: { titulo: string }) => r.titulo === "Repertório ainda não publicado"
    );
    expect(aviso).toBeUndefined();
  });

  it("culto que não é amanhã não gera lembrete", async () => {
    const daquiUmMes = new Date();
    daquiUmMes.setDate(daquiUmMes.getDate() + 30);
    const outro = (
      await lider
        .from("events")
        .insert({
          church_id: churchId, title: "Culto distante",
          starts_at: daquiUmMes.toISOString(),
        })
        .select("id").single()
    ).data!.id;
    await admin.from("assignments").insert({
      church_id: churchId, event_id: outro, user_id: volId,
      ministry_id: louvorId, role_name: "Teclado", status: "convidado",
    });
    const { data } = await anon.rpc("lembretes_do_dia", { p_secret: SEGREDO });
    expect((data ?? []).filter((r: { url: string }) => r.url.includes(outro))).toHaveLength(0);
  });

  it("quem não tem push instalado não aparece na fila de envio", async () => {
    const semPush = await newUser(`lem-sempush-${run}@teste.dev`);
    const spId = await uid(semPush);
    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
    await semPush.rpc("join_church", { p_invite_code: invite });
    await admin.from("assignments").insert({
      church_id: churchId, event_id: eventId, user_id: spId,
      ministry_id: louvorId, role_name: "Baixo", status: "convidado",
    });
    const { data } = await anon.rpc("lembretes_do_dia", { p_secret: SEGREDO });
    expect((data ?? []).filter((r: { user_id: string }) => r.user_id === spId)).toHaveLength(0);
  });
});
