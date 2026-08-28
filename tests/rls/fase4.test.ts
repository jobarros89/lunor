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

describe("Fase 4 — manutenções e avaliações (RLS + ciclo de vida)", () => {
  let lider: SupabaseClient; // admin da igreja
  let vol: SupabaseClient;
  let outsider: SupabaseClient;
  let churchId: string;
  let equipmentId: string;
  let ticketId: string;
  let assignmentId: string;
  const run = Date.now();

  beforeAll(async () => {
    lider = await newUser(`f4-lider-${run}@teste.dev`);
    vol = await newUser(`f4-vol-${run}@teste.dev`);
    outsider = await newUser(`f4-out-${run}@teste.dev`);

    const a = await lider.rpc("create_church", {
      p_name: "Igreja F4",
      p_slug: `igreja-f4-${run}`,
    });
    expect(a.error).toBeNull();
    churchId = a.data;
    await outsider.rpc("create_church", {
      p_name: "Igreja F4 Out",
      p_slug: `igreja-f4-out-${run}`,
    });

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await vol.rpc("join_church", { p_invite_code: church!.invite_code });

    const { data: eq } = await lider
      .from("equipments")
      .insert({ church_id: churchId, name: "Mesa de Som X32" })
      .select("id")
      .single();
    equipmentId = eq!.id;

    // evento + assignment do voluntário (para avaliações)
    const { data: ev } = await lider
      .from("events")
      .insert({
        church_id: churchId,
        title: "Culto F4",
        starts_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const { data: asg } = await lider
      .from("assignments")
      .insert({
        church_id: churchId,
        event_id: ev!.id,
        user_id: await uid(vol),
        role_name: "Mesa de som",
      })
      .select("id, event_id")
      .single();
    assignmentId = asg!.id;
  });

  it("líder abre chamado; equipamento entra em manutenção + evento no histórico", async () => {
    const { data, error } = await lider
      .from("maintenance_tickets")
      .insert({
        church_id: churchId,
        equipment_id: equipmentId,
        title: "Canal 5 sem áudio",
        priority: "alta",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    ticketId = data!.id;

    const { data: eq } = await lider
      .from("equipments")
      .select("status")
      .eq("id", equipmentId)
      .single();
    expect(eq!.status).toBe("manutencao");

    const { data: events } = await lider
      .from("equipment_events")
      .select("payload")
      .eq("equipment_id", equipmentId)
      .eq("event_type", "manutencao");
    expect(events!.length).toBe(1);
  });

  it("voluntário não abre chamado; outsider não lê", async () => {
    const { error } = await vol.from("maintenance_tickets").insert({
      church_id: churchId,
      equipment_id: equipmentId,
      title: "Chamado pirata",
    });
    expect(error).not.toBeNull();

    const { data } = await outsider
      .from("maintenance_tickets")
      .select("id")
      .eq("church_id", churchId);
    expect(data).toEqual([]);
  });

  it("concluir chamado devolve o equipamento e registra tempo parado", async () => {
    const { data, error } = await lider
      .from("maintenance_tickets")
      .update({ status: "concluido", cost_cents: 25000, supplier: "AudioTec" })
      .eq("id", ticketId)
      .select("resolved_at")
      .single();
    expect(error).toBeNull();
    expect(data!.resolved_at).not.toBeNull();

    const { data: eq } = await lider
      .from("equipments")
      .select("status")
      .eq("id", equipmentId)
      .single();
    expect(eq!.status).toBe("disponivel");

    const { data: events } = await lider
      .from("equipment_events")
      .select("payload")
      .eq("equipment_id", equipmentId)
      .eq("event_type", "manutencao");
    expect(events!.length).toBe(2);
    const done = events!.find(
      (e) => (e.payload as { acao: string }).acao === "chamado_concluido"
    );
    expect(done).toBeDefined();
    expect(
      (done!.payload as { custo_cents: number }).custo_cents
    ).toBe(25000);
  });

  it("líder avalia o voluntário nos 6 critérios", async () => {
    const volId = await uid(vol);
    const { data: asg } = await lider
      .from("assignments")
      .select("event_id")
      .eq("id", assignmentId)
      .single();
    const { error } = await lider.from("evaluations").insert({
      church_id: churchId,
      assignment_id: assignmentId,
      event_id: asg!.event_id,
      user_id: volId,
      evaluator_id: await uid(lider),
      pontualidade: 5,
      organizacao: 4,
      conhecimento: 4,
      comunicacao: 5,
      trabalho_equipe: 5,
      comprometimento: 5,
      notes: "Excelente domingo",
    });
    expect(error).toBeNull();
  });

  it("voluntário lê a própria avaliação, mas não avalia ninguém", async () => {
    const { data } = await vol
      .from("evaluations")
      .select("pontualidade, notes")
      .eq("assignment_id", assignmentId);
    expect(data).toHaveLength(1);
    expect(data![0].pontualidade).toBe(5);

    const { error } = await vol.from("evaluations").insert({
      church_id: churchId,
      assignment_id: assignmentId,
      event_id: (await vol.from("assignments").select("event_id").eq("id", assignmentId).single()).data!.event_id,
      user_id: await uid(vol),
      pontualidade: 5,
      organizacao: 5,
      conhecimento: 5,
      comunicacao: 5,
      trabalho_equipe: 5,
      comprometimento: 5,
    });
    expect(error).not.toBeNull();
  });

  it("membro comum não lê avaliação de outro; outsider também não", async () => {
    const carol = await newUser(`f4-carol-${run}@teste.dev`);
    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await carol.rpc("join_church", { p_invite_code: church!.invite_code });

    const { data: fromCarol } = await carol
      .from("evaluations")
      .select("id")
      .eq("church_id", churchId);
    expect(fromCarol).toEqual([]);

    const { data: fromOutsider } = await outsider
      .from("evaluations")
      .select("id")
      .eq("church_id", churchId);
    expect(fromOutsider).toEqual([]);
  });

  it("nota fora da escala 1-5 é rejeitada", async () => {
    const { data: ev2 } = await lider
      .from("events")
      .insert({
        church_id: churchId,
        title: "Culto F4-2",
        starts_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const { data: asg2 } = await lider
      .from("assignments")
      .insert({
        church_id: churchId,
        event_id: ev2!.id,
        user_id: await uid(vol),
        role_name: "Apoio",
      })
      .select("id")
      .single();
    const { error } = await lider.from("evaluations").insert({
      church_id: churchId,
      assignment_id: asg2!.id,
      event_id: ev2!.id,
      user_id: await uid(vol),
      pontualidade: 6,
      organizacao: 5,
      conhecimento: 5,
      comunicacao: 5,
      trabalho_equipe: 5,
      comprometimento: 5,
    });
    expect(error).not.toBeNull();
  });
});
