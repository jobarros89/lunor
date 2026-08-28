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

const uid = async (client: SupabaseClient) =>
  (await client.auth.getUser()).data.user!.id;

describe("Kids — cadastro atômico e autorização", () => {
  let leader: SupabaseClient;
  let volunteer: SupabaseClient;
  let churchId: string;
  let kidsId: string;
  const run = Date.now();

  beforeAll(async () => {
    leader = await newUser(`kids-atomic-leader-${run}@teste.dev`);
    volunteer = await newUser(`kids-atomic-vol-${run}@teste.dev`);

    churchId = (
      await leader.rpc("create_church", {
        p_name: "Igreja Kids Atomic",
        p_slug: `kids-atomic-${run}`,
      })
    ).data;

    kidsId = (
      await leader
        .from("ministries")
        .insert({ church_id: churchId, name: "Kids", slug: "kids" })
        .select("id")
        .single()
    ).data!.id;

    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
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
  });

  it("liderança cria criança, responsável e autorização principal juntos", async () => {
    const { data: childId, error } = await leader.rpc(
      "create_child_with_primary_guardian",
      {
        p_church: churchId,
        p_ministry: kidsId,
        p_full_name: "Ana Kids",
        p_birth_date: "2022-03-10",
        p_allergies: "lactose",
        p_guardian_name: "Maria Kids",
        p_guardian_phone: "21999999999",
        p_guardian_relationship: "mãe",
        p_photo_consent: false,
      }
    );

    expect(error).toBeNull();
    expect(childId).toBeTruthy();

    const child = await admin
      .from("children")
      .select("consent_guardian_id")
      .eq("id", childId)
      .single();
    expect(child.data?.consent_guardian_id).toBeTruthy();

    const link = await admin
      .from("child_guardians")
      .select("can_pickup, is_primary")
      .eq("child_id", childId)
      .single();
    expect(link.data).toMatchObject({ can_pickup: true, is_primary: true });
  });

  it("voluntário comum não consegue cadastrar ficha de criança", async () => {
    const before = await admin
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId);

    const { error } = await volunteer.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_full_name: "Cadastro Indevido",
      p_birth_date: "2021-01-01",
      p_guardian_name: "Responsável Indevido",
    });
    expect(error).not.toBeNull();

    const after = await admin
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId);
    expect(after.count).toBe(before.count);
  });

  it("falha no cadastro da criança reverte o responsável criado na mesma transação", async () => {
    const before = await admin
      .from("guardians")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId);

    const { error } = await leader.rpc("create_child_with_primary_guardian", {
      p_church: churchId,
      p_ministry: kidsId,
      p_full_name: "x",
      p_birth_date: "2021-01-01",
      p_guardian_name: "Responsável Rollback",
    });
    expect(error).not.toBeNull();

    const after = await admin
      .from("guardians")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId);
    expect(after.count).toBe(before.count);
  });
});
