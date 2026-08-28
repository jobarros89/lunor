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

async function uid(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getUser();
  return data.user!.id;
}

describe("Fase 3 — escalas (RLS + transições de status)", () => {
  let lider: SupabaseClient; // admin da igreja
  let vol: SupabaseClient;
  let churchId: string;
  let eventId: string;
  let assignmentId: string;
  let equipmentId: string;
  const run = Date.now();

  beforeAll(async () => {
    lider = await newUser(`esc-lider-${run}@teste.dev`);
    vol = await newUser(`esc-vol-${run}@teste.dev`);

    const a = await lider.rpc("create_church", {
      p_name: "Igreja Escala",
      p_slug: `igreja-escala-${run}`,
    });
    expect(a.error).toBeNull();
    churchId = a.data;

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await vol.rpc("join_church", { p_invite_code: church!.invite_code });

    const { data: eq } = await lider
      .from("equipments")
      .insert({ church_id: churchId, name: "Canon R8" })
      .select("id")
      .single();
    equipmentId = eq!.id;
  });

  it("tipos de evento semeados (6)", async () => {
    const { data } = await lider
      .from("event_types")
      .select("slug")
      .eq("church_id", churchId);
    expect(data!.length).toBe(6);
  });

  it("líder cria evento; voluntário lê mas não cria", async () => {
    const { data: types } = await lider
      .from("event_types")
      .select("id")
      .eq("church_id", churchId)
      .eq("slug", "culto")
      .single();

    const { data, error } = await lider
      .from("events")
      .insert({
        church_id: churchId,
        type_id: types!.id,
        title: "Culto de Domingo",
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        location: "Templo principal",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    eventId = data!.id;

    const { data: volRead } = await vol.from("events").select("id");
    expect(volRead!.map((e) => e.id)).toContain(eventId);

    const { error: volCreate } = await vol.from("events").insert({
      church_id: churchId,
      title: "Evento pirata",
      starts_at: new Date().toISOString(),
    });
    expect(volCreate).not.toBeNull();
  });

  it("líder escala voluntário; equipamento vinculado gera evento de uso", async () => {
    const volId = await uid(vol);
    const { data, error } = await lider
      .from("assignments")
      .insert({
        church_id: churchId,
        event_id: eventId,
        user_id: volId,
        role_name: "Fotógrafo",
        leader_id: await uid(lider),
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    assignmentId = data!.id;

    const { error: linkError } = await lider
      .from("assignment_equipments")
      .insert({
        assignment_id: assignmentId,
        equipment_id: equipmentId,
        church_id: churchId,
      });
    expect(linkError).toBeNull();

    const { data: history } = await lider
      .from("equipment_events")
      .select("event_type, payload")
      .eq("equipment_id", equipmentId)
      .eq("event_type", "uso");
    expect(history).toHaveLength(1);
    expect((history![0].payload as { evento: string }).evento).toBe(
      "Culto de Domingo"
    );
  });

  it("voluntário confirma a própria presença", async () => {
    const { data, error } = await vol
      .from("assignments")
      .update({ status: "confirmado" })
      .eq("id", assignmentId)
      .select();
    expect(error).toBeNull();
    expect(data![0].status).toBe("confirmado");
  });

  it("voluntário NÃO se marca como presente (transição inválida)", async () => {
    const { error } = await vol
      .from("assignments")
      .update({ status: "presente" })
      .eq("id", assignmentId);
    expect(error).not.toBeNull();
  });

  it("voluntário NÃO altera a própria função", async () => {
    const { error } = await vol
      .from("assignments")
      .update({ role_name: "Diretor geral" })
      .eq("id", assignmentId);
    expect(error).not.toBeNull();
  });

  it("voluntário solicita substituição; líder resolve", async () => {
    const volId = await uid(vol);
    const { error } = await vol.from("substitution_requests").insert({
      church_id: churchId,
      assignment_id: assignmentId,
      requested_by: volId,
      reason: "Viagem de trabalho",
    });
    expect(error).toBeNull();

    const { data: fromLider } = await lider
      .from("substitution_requests")
      .select("id, status")
      .eq("church_id", churchId);
    expect(fromLider).toHaveLength(1);

    const { data: resolved, error: resolveError } = await lider
      .from("substitution_requests")
      .update({ status: "atendida", resolved_by: await uid(lider) })
      .eq("id", fromLider![0].id)
      .select();
    expect(resolveError).toBeNull();
    expect(resolved![0].status).toBe("atendida");
  });

  it("líder marca presença (transição de líder)", async () => {
    const { data, error } = await lider
      .from("assignments")
      .update({ status: "presente" })
      .eq("id", assignmentId)
      .select();
    expect(error).toBeNull();
    expect(data![0].status).toBe("presente");
  });
});
