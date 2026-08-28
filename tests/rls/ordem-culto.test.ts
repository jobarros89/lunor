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

describe("Ordem do Culto — schema e RLS (migration 29)", () => {
  let gestor: SupabaseClient;
  let membro: SupabaseClient;
  let externo: SupabaseClient;
  let churchId: string;
  let eventId: string;
  let itemId: string;
  const run = Date.now();

  beforeAll(async () => {
    gestor = await newUser(`ordem-gestor-${run}@teste.dev`);
    membro = await newUser(`ordem-membro-${run}@teste.dev`);
    externo = await newUser(`ordem-externo-${run}@teste.dev`);

    churchId = (
      await gestor.rpc("create_church", {
        p_name: "Igreja Ordem do Culto",
        p_slug: `ordem-culto-${run}`,
      })
    ).data;

    const invite = (
      await admin
        .from("churches")
        .select("invite_code")
        .eq("id", churchId)
        .single()
    ).data!.invite_code;
    await membro.rpc("join_church", { p_invite_code: invite });

    eventId = (
      await gestor
        .from("events")
        .insert({
          church_id: churchId,
          title: "Culto de domingo",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    itemId = (
      await gestor
        .from("service_items")
        .insert({
          church_id: churchId,
          event_id: eventId,
          type: "WORSHIP",
          title: "Louvor congregacional",
          notes: "Três músicas",
          duration_minutes: 20,
          position: 0,
        })
        .select("id")
        .single()
    ).data!.id;
  });

  it("expõe a estrutura esperada e aplica os defaults", async () => {
    const { data, error } = await gestor
      .from("service_items")
      .select(
        "id, church_id, event_id, type, title, notes, duration_minutes, position, created_at, updated_at"
      )
      .eq("id", itemId)
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      church_id: churchId,
      event_id: eventId,
      type: "WORSHIP",
      title: "Louvor congregacional",
      duration_minutes: 20,
      position: 0,
    });
    expect(data!.created_at).toBeTruthy();
    expect(data!.updated_at).toBeTruthy();
  });

  it.each([
    [{ title: "" }, "título vazio"],
    [{ type: "INVALID" }, "tipo inválido"],
    [{ duration_minutes: -1 }, "duração negativa"],
    [{ duration_minutes: 1441 }, "duração acima do limite"],
    [{ position: -1 }, "posição negativa"],
  ])("rejeita %s", async (changes, _descricao) => {
    const { error } = await gestor.from("service_items").insert({
      church_id: churchId,
      event_id: eventId,
      type: "OTHER",
      title: "Item válido",
      duration_minutes: 0,
      position: Math.floor(Math.random() * 100000) + 1,
      ...changes,
    });
    expect(error).not.toBeNull();
  });

  it("permite leitura a membro da igreja, mas não permite escrita", async () => {
    const { data } = await membro
      .from("service_items")
      .select("id")
      .eq("id", itemId);
    expect(data).toHaveLength(1);

    const { error } = await membro.from("service_items").insert({
      church_id: churchId,
      event_id: eventId,
      type: "SPEAKING",
      title: "Item não autorizado",
      position: 50,
    });
    expect(error).not.toBeNull();
  });

  it("isola leitura e escrita entre igrejas", async () => {
    const outraIgreja = (
      await externo.rpc("create_church", {
        p_name: "Outra Igreja",
        p_slug: `ordem-culto-externa-${run}`,
      })
    ).data;
    const outroEvento = (
      await externo
        .from("events")
        .insert({
          church_id: outraIgreja,
          title: "Outro culto",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    const { data } = await externo
      .from("service_items")
      .select("id")
      .eq("id", itemId);
    expect(data).toHaveLength(0);

    const { error } = await gestor.from("service_items").insert({
      church_id: churchId,
      event_id: outroEvento,
      type: "MEDIA",
      title: "Evento de outra igreja",
      position: 70,
    });
    expect(error).not.toBeNull();
  });
});
