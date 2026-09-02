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
  const signIn = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (signIn.error) throw signIn.error;
  return client;
}

async function uid(client: SupabaseClient) {
  return (await client.auth.getUser()).data.user!.id;
}

describe("Kids — histórico de check-in/reentrada", () => {
  let coord: SupabaseClient;
  let leader: SupabaseClient;
  let volunteer: SupabaseClient;
  let churchId: string;
  let kidsId: string;
  let eventId: string;
  let childId: string;
  let guardianId: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`history-coord-${run}@teste.dev`);
    leader = await newUser(`history-leader-${run}@teste.dev`);
    volunteer = await newUser(`history-vol-${run}@teste.dev`);

    churchId = (
      await coord.rpc("create_church", {
        p_name: "Igreja Kids Histórico",
        p_slug: `kids-history-${run}`,
      })
    ).data;

    kidsId = (
      await coord
        .from("ministries")
        .insert({ church_id: churchId, name: "Kids", slug: "kids" })
        .select("id")
        .single()
    ).data!.id;

    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
    await leader.rpc("join_church", { p_invite_code: invite });
    await volunteer.rpc("join_church", { p_invite_code: invite });

    await admin.from("ministry_members").insert([
      {
        ministry_id: kidsId,
        church_id: churchId,
        user_id: await uid(leader),
        role: "lider",
      },
      {
        ministry_id: kidsId,
        church_id: churchId,
        user_id: await uid(volunteer),
        role: "voluntario",
      },
    ]);

    eventId = (
      await coord
        .from("events")
        .insert({
          church_id: churchId,
          title: "Culto Kids Histórico",
          starts_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    await admin.from("assignments").insert({
      church_id: churchId,
      ministry_id: kidsId,
      event_id: eventId,
      user_id: await uid(volunteer),
      role_name: "Recepção Kids",
      status: "confirmado",
    });

    const created = await leader.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_full_name: "Criança Histórico",
      p_birth_date: "2021-02-03",
      p_guardian_name: "Responsável Histórico",
      p_guardian_relationship: "pai",
    });
    if (created.error) throw created.error;
    childId = created.data as string;
    guardianId = (
      await admin
        .from("child_guardians")
        .select("guardian_id")
        .eq("child_id", childId)
        .single()
    ).data!.guardian_id;
  });

  it("mantém a primeira retirada e cria uma nova linha na reentrada", async () => {
    const first = await volunteer
      .from("child_checkins")
      .insert({
        church_id: churchId,
        ministry_id: kidsId,
        event_id: eventId,
        child_id: childId,
        code: "411",
      })
      .select("id")
      .single();
    expect(first.error).toBeNull();

    const checkoutAt = new Date().toISOString();
    const checkout = await volunteer
      .from("child_checkins")
      .update({
        picked_up_by: guardianId,
        checked_out_at: checkoutAt,
        checked_out_by: await uid(volunteer),
      })
      .eq("id", first.data!.id);
    expect(checkout.error).toBeNull();

    const second = await volunteer
      .from("child_checkins")
      .insert({
        church_id: churchId,
        ministry_id: kidsId,
        event_id: eventId,
        child_id: childId,
        code: "412",
      })
      .select("id")
      .single();
    expect(second.error).toBeNull();
    expect(second.data!.id).not.toBe(first.data!.id);

    const { data: history, error } = await admin
      .from("child_checkins")
      .select("id, code, checked_out_at, picked_up_by")
      .eq("event_id", eventId)
      .eq("child_id", childId)
      .order("checked_in_at");
    expect(error).toBeNull();
    expect(history).toHaveLength(2);
    expect(history?.[0].id).toBe(first.data!.id);
    expect(history?.[0].checked_out_at).not.toBeNull();
    expect(history?.[0].picked_up_by).toBe(guardianId);
    expect(history?.[1].id).toBe(second.data!.id);
    expect(history?.[1].checked_out_at).toBeNull();
  });

  it("impede duas presenças ativas simultâneas para a mesma criança/culto", async () => {
    const duplicateActive = await volunteer.from("child_checkins").insert({
      church_id: churchId,
      ministry_id: kidsId,
      event_id: eventId,
      child_id: childId,
      code: "413",
    });
    expect(duplicateActive.error).not.toBeNull();

    const { data } = await admin
      .from("child_checkins")
      .select("id")
      .eq("event_id", eventId)
      .eq("child_id", childId)
      .is("checked_out_at", null);
    expect(data).toHaveLength(1);
  });
});

