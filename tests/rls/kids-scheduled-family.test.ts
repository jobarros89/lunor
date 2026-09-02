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
  const login = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (login.error) throw login.error;
  return client;
}

async function uid(client: SupabaseClient) {
  return (await client.auth.getUser()).data.user!.id;
}

describe("Kids — escala operacional e família", () => {
  let coord: SupabaseClient;
  let scheduled: SupabaseClient;
  let unscheduled: SupabaseClient;
  let guardian: SupabaseClient;
  let churchId: string;
  let kidsId: string;
  let eventId: string;
  let childId: string;
  let otherChildId: string;
  let guardianId: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`kids-scope-coord-${run}@teste.dev`);
    scheduled = await newUser(`kids-scope-scheduled-${run}@teste.dev`);
    unscheduled = await newUser(`kids-scope-unscheduled-${run}@teste.dev`);
    guardian = await newUser(`kids-scope-family-${run}@teste.dev`);

    churchId = (await coord.rpc("create_church", {
      p_name: "Igreja Kids Scope",
      p_slug: `kids-scope-${run}`,
    })).data;
    kidsId = (await coord.from("ministries").insert({
      church_id: churchId,
      name: "Kids",
      slug: "kids",
    }).select("id").single()).data!.id;

    const inviteCode = (await admin.from("churches")
      .select("invite_code").eq("id", churchId).single()).data!.invite_code;
    await scheduled.rpc("join_church", { p_invite_code: inviteCode });
    await unscheduled.rpc("join_church", { p_invite_code: inviteCode });
    await admin.from("ministry_members").insert([
      { church_id: churchId, ministry_id: kidsId, user_id: await uid(scheduled), role: "voluntario" },
      { church_id: churchId, ministry_id: kidsId, user_id: await uid(unscheduled), role: "voluntario" },
    ]);

    eventId = (await coord.from("events").insert({
      church_id: churchId,
      title: "Culto atual",
      starts_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      ends_at: new Date(Date.now() + 60 * 60_000).toISOString(),
    }).select("id").single()).data!.id;
    await coord.from("assignments").insert({
      church_id: churchId,
      ministry_id: kidsId,
      event_id: eventId,
      user_id: await uid(scheduled),
      role_name: "Recepção Kids",
      status: "confirmado",
    });

    childId = (await coord.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_event: eventId,
      p_full_name: "Criança da família",
      p_birth_date: "2021-01-01",
      p_guardian_name: "Responsável da família",
    })).data as string;
    guardianId = (await admin.from("child_guardians")
      .select("guardian_id").eq("child_id", childId).single()).data!.guardian_id;

    otherChildId = (await coord.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_event: eventId,
      p_full_name: "Outra criança",
      p_birth_date: "2020-01-01",
      p_guardian_name: "Outro responsável",
    })).data as string;
  });

  it("bloqueia voluntário sem escala e libera o escalado durante a operação", async () => {
    const denied = await unscheduled.from("children").select("id").eq("id", childId);
    expect(denied.data ?? []).toEqual([]);

    const allowed = await scheduled.from("children").select("id").eq("id", childId);
    expect(allowed.data?.[0]?.id).toBe(childId);

    const update = await scheduled.from("children")
      .update({ health_notes: "Atualização operacional" })
      .eq("id", childId);
    expect(update.error).toBeNull();
  });

  it("convite familiar liga a conta sem torná-la voluntária", async () => {
    const invite = await coord.rpc("create_guardian_invite", { p_guardian: guardianId });
    expect(invite.error).toBeNull();

    const redeem = await guardian.rpc("redeem_guardian_invite", { p_token: invite.data });
    expect(redeem.error).toBeNull();

    const churchMembership = await admin.from("church_members")
      .select("user_id")
      .eq("church_id", churchId)
      .eq("user_id", await uid(guardian));
    expect(churchMembership.data ?? []).toEqual([]);
  });

  it("responsável vê somente a própria criança e faz check-in/out", async () => {
    const visible = await guardian.from("children").select("id").eq("church_id", churchId);
    expect((visible.data ?? []).map((row) => row.id)).toEqual([childId]);
    expect((visible.data ?? []).map((row) => row.id)).not.toContain(otherChildId);

    const checkin = await guardian.rpc("guardian_checkin_child", {
      p_church: churchId,
      p_ministry: kidsId,
      p_event: eventId,
      p_child: childId,
      p_class: null,
    });
    expect(checkin.error).toBeNull();

    const checkout = await guardian.rpc("guardian_checkout_child", {
      p_checkin: checkin.data,
    });
    expect(checkout.error).toBeNull();

    const stored = await admin.from("child_checkins")
      .select("checked_out_at, picked_up_by, checked_out_by")
      .eq("id", checkin.data)
      .single();
    expect(stored.data?.checked_out_at).not.toBeNull();
    expect(stored.data?.picked_up_by).toBe(guardianId);
    expect(stored.data?.checked_out_by).toBe(await uid(guardian));
  });
});
