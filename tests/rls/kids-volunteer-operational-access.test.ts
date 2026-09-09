import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const testPassword = `test-${Date.now()}-Aa1!`;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anonymous = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await admin.auth.admin.createUser({
    email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const login = await client.auth.signInWithPassword({ email, password: testPassword });
  if (login.error) throw login.error;
  return client;
}

async function uid(client: SupabaseClient) {
  return (await client.auth.getUser()).data.user!.id;
}

describe("Kids — acesso operacional do voluntário", () => {
  const run = Date.now();
  let coord: SupabaseClient;
  let volunteer: SupabaseClient;
  let targetAccount: SupabaseClient;
  let churchId: string;
  let kidsId: string;
  let campusId: string;
  let guardianId: string;

  beforeAll(async () => {
    coord = await newUser(`kids-op-coord-${run}@teste.dev`);
    volunteer = await newUser(`kids-op-vol-${run}@teste.dev`);
    targetAccount = await newUser(`kids-op-family-${run}@teste.dev`);

    churchId = (await coord.rpc("create_church", {
      p_name: "Igreja Kids Operacional",
      p_slug: `kids-operacional-${run}`,
    })).data as string;

    kidsId = (await coord
      .from("ministries")
      .insert({ church_id: churchId, name: "Kids", slug: "kids" })
      .select("id")
      .single()).data!.id;

    campusId = (await coord
      .from("campuses")
      .insert({ church_id: churchId, name: "Campus Teste" })
      .select("id")
      .single()).data!.id;

    const inviteCode = (await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single()).data!.invite_code;

    await volunteer.rpc("join_church", { p_invite_code: inviteCode });
    await targetAccount.rpc("join_church", { p_invite_code: inviteCode });

    const onboarding = await volunteer.rpc("complete_member_onboarding", {
      p_church_id: churchId,
      p_ministry_ids: [kidsId],
      p_phone: "",
      p_availability: {},
    });
    expect(onboarding.error).toBeNull();

    const childId = (await volunteer.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_event: null,
      p_full_name: "Criança teste operacional",
      p_birth_date: "2022-01-01",
      p_guardian_name: "Responsável teste operacional",
    })).data as string;

    guardianId = (await admin
      .from("child_guardians")
      .select("guardian_id")
      .eq("child_id", childId)
      .single()).data!.guardian_id;
  });

  it("onboarding cria vínculo voluntário ativo no Kids", async () => {
    const membership = await admin
      .from("ministry_members")
      .select("role, active")
      .eq("church_id", churchId)
      .eq("ministry_id", kidsId)
      .eq("user_id", await uid(volunteer))
      .single();

    expect(membership.error).toBeNull();
    expect(membership.data).toMatchObject({ role: "voluntario", active: true });
  });

  it("voluntário Kids abre e encerra recepção sem precisar estar escalado", async () => {
    const opened = await volunteer.rpc("open_kids_reception_session", {
      p_church: churchId,
      p_ministry: kidsId,
      p_title: "Recepção Kids",
      p_event: null,
      p_campus: campusId,
    });
    expect(opened.error).toBeNull();
    expect(opened.data).toMatch(/^[0-9a-f-]{36}$/i);

    const closed = await volunteer.rpc("close_kids_reception", {
      p_church: churchId,
      p_ministry: kidsId,
      p_session: opened.data,
    });
    expect(closed.error).toBeNull();
    expect(closed.data).toBe(true);
  });

  it("voluntário Kids gera convite familiar e vincula conta existente", async () => {
    const familyEmail = `kids-op-invite-${run}@teste.dev`;
    const invite = await volunteer.rpc("create_guardian_invite", {
      p_guardian: guardianId,
      p_email: familyEmail,
    });
    expect(invite.error).toBeNull();
    expect(invite.data).toMatch(/^[a-f0-9]{48}$/i);

    const linked = await volunteer.rpc("link_guardian_account", {
      p_church: churchId,
      p_ministry: kidsId,
      p_guardian: guardianId,
      p_user: await uid(targetAccount),
    });
    expect(linked.error).toBeNull();
    expect(linked.data).toBe(true);

    const guardian = await admin.from("guardians").select("user_id").eq("id", guardianId).single();
    expect(guardian.data?.user_id).toBe(await uid(targetAccount));

    const unlinked = await volunteer.rpc("unlink_guardian_account", {
      p_church: churchId,
      p_ministry: kidsId,
      p_guardian: guardianId,
    });
    expect(unlinked.error).toBeNull();
    expect(unlinked.data).toBe(true);
  });

  it("usuário anônimo não executa RPCs operacionais", async () => {
    const opened = await anonymous.rpc("open_kids_reception_session", {
      p_church: churchId,
      p_ministry: kidsId,
      p_title: "Não autorizado",
      p_event: null,
      p_campus: campusId,
    });
    expect(opened.error).not.toBeNull();

    const linked = await anonymous.rpc("link_guardian_account", {
      p_church: churchId,
      p_ministry: kidsId,
      p_guardian: guardianId,
      p_user: await uid(targetAccount),
    });
    expect(linked.error).not.toBeNull();
  });
});
