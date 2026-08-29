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

describe("Kids V1 hardening", () => {
  let coord: SupabaseClient;
  let coordOther: SupabaseClient;
  let leader: SupabaseClient;
  let volunteer: SupabaseClient;
  let churchId: string;
  let otherChurchId: string;
  let kidsId: string;
  let eventId: string;
  let otherEventId: string;
  let classId: string;
  let childId: string;
  let guardianId: string;
  let checkinId: string;
  let pageId: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`kids-coord-${run}@teste.dev`);
    coordOther = await newUser(`kids-coord2-${run}@teste.dev`);
    leader = await newUser(`kids-leader-${run}@teste.dev`);
    volunteer = await newUser(`kids-vol-${run}@teste.dev`);

    churchId = (
      await coord.rpc("create_church", {
        p_name: "Igreja Kids Hardening",
        p_slug: `kids-hard-${run}`,
      })
    ).data;
    otherChurchId = (
      await coordOther.rpc("create_church", {
        p_name: "Outra Igreja Kids",
        p_slug: `kids-other-${run}`,
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
          title: "Culto Kids",
          starts_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    otherEventId = (
      await coordOther
        .from("events")
        .insert({
          church_id: otherChurchId,
          title: "Culto de outro tenant",
          starts_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;
  });

  it("somente liderança/coord consegue criar turmas padrão", async () => {
    const denied = await volunteer.rpc("seed_child_classes", { p_ministry: kidsId });
    expect(denied.error).not.toBeNull();

    const allowed = await leader.rpc("seed_child_classes", { p_ministry: kidsId });
    expect(allowed.error).toBeNull();

    classId = (
      await admin
        .from("child_classes")
        .select("id")
        .eq("ministry_id", kidsId)
        .order("sort_order")
        .limit(1)
        .single()
    ).data!.id;
  });

  it("cadastro atômico exige liderança e não roda como definer aberto", async () => {
    const denied = await volunteer.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_full_name: "Criança Negada",
      p_birth_date: "2021-01-01",
      p_guardian_name: "Responsável Negado",
    });
    expect(denied.error).not.toBeNull();

    const allowed = await leader.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_full_name: "Criança Permitida",
      p_birth_date: "2021-01-01",
      p_guardian_name: "Responsável Permitido",
      p_guardian_phone: "21999999999",
      p_guardian_relationship: "mãe",
    });
    expect(allowed.error).toBeNull();
    childId = allowed.data as string;

    guardianId = (
      await admin
        .from("child_guardians")
        .select("guardian_id")
        .eq("child_id", childId)
        .single()
    ).data!.guardian_id;
  });

  it("voluntário opera check-in, mas não consegue apagar presença", async () => {
    const inserted = await volunteer
      .from("child_checkins")
      .insert({
        church_id: churchId,
        ministry_id: kidsId,
        event_id: eventId,
        child_id: childId,
        class_id: classId,
        code: "321",
      })
      .select("id")
      .single();
    expect(inserted.error).toBeNull();
    checkinId = inserted.data!.id;

    const deleted = await volunteer
      .from("child_checkins")
      .delete()
      .eq("id", checkinId);
    expect(deleted.error).not.toBeNull();

    const stillThere = await admin
      .from("child_checkins")
      .select("id")
      .eq("id", checkinId)
      .single();
    expect(stillThere.data?.id).toBe(checkinId);
  });

  it("guard de tenant impede mover check-in para evento de outra igreja", async () => {
    const moved = await volunteer
      .from("child_checkins")
      .update({ event_id: otherEventId })
      .eq("id", checkinId);
    expect(moved.error).not.toBeNull();

    const current = await admin
      .from("child_checkins")
      .select("event_id")
      .eq("id", checkinId)
      .single();
    expect(current.data?.event_id).toBe(eventId);
  });

  it("aviso individual pode ser criado pelo time, mas não alterado/apagado diretamente", async () => {
    const page = await volunteer
      .from("child_pages")
      .insert({
        church_id: churchId,
        ministry_id: kidsId,
        event_id: eventId,
        checkin_id: checkinId,
        kind: "chamar",
      })
      .select("id")
      .single();
    expect(page.error).toBeNull();
    pageId = page.data!.id;

    const updated = await volunteer
      .from("child_pages")
      .update({ resolved_at: new Date().toISOString() })
      .eq("id", pageId);
    expect(updated.error).not.toBeNull();

    const deleted = await volunteer.from("child_pages").delete().eq("id", pageId);
    expect(deleted.error).not.toBeNull();
  });

  it("encerramento geral exige liderança/coord", async () => {
    const denied = await volunteer.from("child_pages").insert({
      church_id: churchId,
      ministry_id: kidsId,
      event_id: eventId,
      checkin_id: null,
      kind: "fim_sessao",
    });
    expect(denied.error).not.toBeNull();

    const allowed = await leader.from("child_pages").insert({
      church_id: churchId,
      ministry_id: kidsId,
      event_id: eventId,
      checkin_id: null,
      kind: "fim_sessao",
    });
    expect(allowed.error).toBeNull();
  });

  it("retirada autorizada continua funcionando para voluntário", async () => {
    const checkout = await volunteer
      .from("child_checkins")
      .update({
        picked_up_by: guardianId,
        checked_out_at: new Date().toISOString(),
        checked_out_by: await uid(volunteer),
      })
      .eq("id", checkinId);
    expect(checkout.error).toBeNull();
  });
});
