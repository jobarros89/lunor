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

describe("Fase 2 — patrimônio (RLS + histórico imutável)", () => {
  let gestor: SupabaseClient;
  let vol: SupabaseClient;
  let outsider: SupabaseClient;
  let churchId: string;
  let categoryId: string;
  let equipmentId: string;
  const run = Date.now();

  beforeAll(async () => {
    gestor = await newUser(`eq-gestor-${run}@teste.dev`);
    vol = await newUser(`eq-vol-${run}@teste.dev`);
    outsider = await newUser(`eq-out-${run}@teste.dev`);

    const a = await gestor.rpc("create_church", {
      p_name: "Igreja Equip",
      p_slug: `igreja-equip-${run}`,
    });
    expect(a.error).toBeNull();
    churchId = a.data;

    await outsider.rpc("create_church", {
      p_name: "Igreja Fora",
      p_slug: `igreja-fora-${run}`,
    });

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await vol.rpc("join_church", { p_invite_code: church!.invite_code });

    const { data: cat } = await gestor
      .from("equipment_categories")
      .select("id")
      .eq("church_id", churchId)
      .eq("slug", "fotografia")
      .single();
    categoryId = cat!.id;
  });

  it("categorias padrão semeadas (8)", async () => {
    const { data } = await gestor
      .from("equipment_categories")
      .select("slug")
      .eq("church_id", churchId);
    expect(data!.length).toBe(8);
  });

  it("admin cadastra equipamento; evento 'cadastro' gerado automaticamente", async () => {
    const { data, error } = await gestor
      .from("equipments")
      .insert({
        church_id: churchId,
        category_id: categoryId,
        name: "Canon R8",
        brand: "Canon",
        value_cents: 1500000,
        status: "disponivel",
      })
      .select()
      .single();
    expect(error).toBeNull();
    equipmentId = data!.id;

    const { data: events } = await gestor
      .from("equipment_events")
      .select("event_type")
      .eq("equipment_id", equipmentId);
    expect(events!.map((e) => e.event_type)).toContain("cadastro");
  });

  it("alteração gera evento com diff apenas dos campos alterados", async () => {
    const { error } = await gestor
      .from("equipments")
      .update({ status: "manutencao" })
      .eq("id", equipmentId);
    expect(error).toBeNull();

    const { data: events } = await gestor
      .from("equipment_events")
      .select("event_type, payload")
      .eq("equipment_id", equipmentId)
      .eq("event_type", "alteracao");
    expect(events).toHaveLength(1);
    const diff = events![0].payload as Record<string, unknown>;
    expect(Object.keys(diff)).toEqual(["status"]);
  });

  it("voluntário lê equipamentos mas não cadastra nem altera", async () => {
    const { data: list } = await vol
      .from("equipments")
      .select("id")
      .eq("church_id", churchId);
    expect(list).toHaveLength(1);

    const { error: insertError } = await vol.from("equipments").insert({
      church_id: churchId,
      name: "Invasor",
    });
    expect(insertError).not.toBeNull();

    const { data: updated } = await vol
      .from("equipments")
      .update({ name: "Hackeado" })
      .eq("id", equipmentId)
      .select();
    expect(updated).toEqual([]);
  });

  it("outsider não lê nada do patrimônio", async () => {
    const { data } = await outsider
      .from("equipments")
      .select("id")
      .eq("church_id", churchId);
    expect(data).toEqual([]);
  });

  it("histórico é imutável mesmo para o admin", async () => {
    const { data: events } = await gestor
      .from("equipment_events")
      .select("id")
      .eq("equipment_id", equipmentId)
      .limit(1);
    const eventId = events![0].id;

    const { data: updated } = await gestor
      .from("equipment_events")
      .update({ payload: { adulterado: true } })
      .eq("id", eventId)
      .select();
    expect(updated).toEqual([]);

    const { data: afterDelete } = await gestor
      .from("equipment_events")
      .delete()
      .eq("id", eventId)
      .select();
    expect(afterDelete).toEqual([]);
  });

  it("audit_logs registra e só admin lê", async () => {
    const { data: logs } = await gestor
      .from("audit_logs")
      .select("action, table_name")
      .eq("church_id", churchId);
    expect(logs!.length).toBeGreaterThanOrEqual(2);

    const { data: volLogs } = await vol
      .from("audit_logs")
      .select("id")
      .eq("church_id", churchId);
    expect(volLogs).toEqual([]);
  });
});
