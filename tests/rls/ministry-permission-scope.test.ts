import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;

const service = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  const { error } = await service.auth.admin.createUser({
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

async function userId(client: SupabaseClient) {
  return (await client.auth.getUser()).data.user!.id;
}

describe("permissões separadas por ministério e campus", () => {
  let owner: SupabaseClient;
  let leader: SupabaseClient;
  let volunteer: SupabaseClient;
  let outsider: SupabaseClient;
  let churchId: string;
  let louvorId: string;
  let producaoId: string;
  let campusA: string;
  let campusB: string;
  let eventLouvorA: string;
  let eventLouvorB: string;
  let eventProducaoA: string;
  let leaderId: string;
  let volunteerId: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`scope-owner-${run}@teste.dev`);
    leader = await newUser(`scope-leader-${run}@teste.dev`);
    volunteer = await newUser(`scope-volunteer-${run}@teste.dev`);
    outsider = await newUser(`scope-outsider-${run}@teste.dev`);
    leaderId = await userId(leader);
    volunteerId = await userId(volunteer);

    const created = await owner.rpc("create_church", {
      p_name: "Igreja Escopo",
      p_slug: `igreja-escopo-${run}`,
    });
    expect(created.error).toBeNull();
    churchId = created.data;

    const otherChurch = await outsider.rpc("create_church", {
      p_name: "Outra Igreja Escopo",
      p_slug: `outra-igreja-escopo-${run}`,
    });
    expect(otherChurch.error).toBeNull();

    const church = await owner
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await Promise.all([
      leader.rpc("join_church", { p_invite_code: church.data!.invite_code }),
      volunteer.rpc("join_church", { p_invite_code: church.data!.invite_code }),
    ]);

    const campuses = await owner
      .from("campuses")
      .insert([
        { church_id: churchId, name: "Campus A" },
        { church_id: churchId, name: "Campus B" },
      ])
      .select("id, name");
    expect(campuses.error).toBeNull();
    campusA = campuses.data!.find((item) => item.name === "Campus A")!.id;
    campusB = campuses.data!.find((item) => item.name === "Campus B")!.id;

    const ministries = await owner
      .from("ministries")
      .insert([
        { church_id: churchId, name: "Louvor Teste", slug: `louvor-scope-${run}` },
        { church_id: churchId, name: "Produção Teste", slug: `producao-scope-${run}` },
      ])
      .select("id, name");
    expect(ministries.error).toBeNull();
    louvorId = ministries.data!.find((item) => item.name === "Louvor Teste")!.id;
    producaoId = ministries.data!.find((item) => item.name === "Produção Teste")!.id;

    const memberships = await owner.from("ministry_members").insert([
      { church_id: churchId, ministry_id: louvorId, user_id: leaderId, role: "voluntario" },
      { church_id: churchId, ministry_id: producaoId, user_id: leaderId, role: "voluntario" },
      { church_id: churchId, ministry_id: louvorId, user_id: volunteerId, role: "voluntario" },
      { church_id: churchId, ministry_id: producaoId, user_id: volunteerId, role: "voluntario" },
    ]);
    expect(memberships.error).toBeNull();

    const permission = await owner.from("ministry_admin_permissions").insert({
      church_id: churchId,
      ministry_id: louvorId,
      user_id: leaderId,
      campus_id: campusA,
      role: "lider",
    });
    expect(permission.error).toBeNull();

    const campusRestriction = await owner.from("ministry_member_campuses").insert({
      church_id: churchId,
      ministry_id: louvorId,
      user_id: leaderId,
      campus_id: campusA,
    });
    expect(campusRestriction.error).toBeNull();

    const events = await owner
      .from("events")
      .insert([
        {
          church_id: churchId,
          ministry_id: louvorId,
          campus_id: campusA,
          title: "Louvor Campus A",
          starts_at: "2099-01-01T18:00:00Z",
        },
        {
          church_id: churchId,
          ministry_id: louvorId,
          campus_id: campusB,
          title: "Louvor Campus B",
          starts_at: "2099-01-02T18:00:00Z",
        },
        {
          church_id: churchId,
          ministry_id: producaoId,
          campus_id: campusA,
          title: "Produção Campus A",
          starts_at: "2099-01-03T18:00:00Z",
        },
      ])
      .select("id, title");
    expect(events.error).toBeNull();
    eventLouvorA = events.data!.find((item) => item.title === "Louvor Campus A")!.id;
    eventLouvorB = events.data!.find((item) => item.title === "Louvor Campus B")!.id;
    eventProducaoA = events.data!.find((item) => item.title === "Produção Campus A")!.id;
  });

  it("separa participação de permissão administrativa", async () => {
    const participation = await leader
      .from("ministry_members")
      .select("ministry_id")
      .eq("church_id", churchId)
      .eq("user_id", leaderId);
    expect(participation.data).toHaveLength(2);

    const permissions = await leader
      .from("ministry_admin_permissions")
      .select("ministry_id, campus_id, role")
      .eq("church_id", churchId)
      .eq("user_id", leaderId);
    expect(permissions.data).toEqual([
      { ministry_id: louvorId, campus_id: campusA, role: "lider" },
    ]);
  });

  it("líder administra somente o ministério e campus permitidos", async () => {
    const allowed = await leader.from("assignments").insert({
      church_id: churchId,
      ministry_id: louvorId,
      event_id: eventLouvorA,
      user_id: volunteerId,
      role_name: "Baixo",
    });
    expect(allowed.error).toBeNull();

    const wrongCampus = await leader.from("assignments").insert({
      church_id: churchId,
      ministry_id: louvorId,
      event_id: eventLouvorB,
      user_id: volunteerId,
      role_name: "Guitarra",
    });
    expect(wrongCampus.error).not.toBeNull();

    const wrongMinistry = await leader.from("assignments").insert({
      church_id: churchId,
      ministry_id: producaoId,
      event_id: eventProducaoA,
      user_id: volunteerId,
      role_name: "MC",
    });
    expect(wrongMinistry.error).not.toBeNull();
  });

  it("restrição de campus limita leitura da equipe", async () => {
    const created = await owner.from("assignments").insert({
      church_id: churchId,
      ministry_id: louvorId,
      event_id: eventLouvorB,
      user_id: volunteerId,
      role_name: "Bateria",
    });
    expect(created.error).toBeNull();

    const visible = await leader
      .from("assignments")
      .select("event_id")
      .eq("event_id", eventLouvorB);
    expect(visible.data).toEqual([]);
  });

  it("admin da igreja mantém acesso global autorizado", async () => {
    const created = await owner.from("assignments").insert({
      church_id: churchId,
      ministry_id: producaoId,
      event_id: eventProducaoA,
      user_id: volunteerId,
      role_name: "Trilha",
    });
    expect(created.error).toBeNull();
  });

  it("função operacional não concede permissão administrativa", async () => {
    const team = await owner
      .from("departments")
      .insert({ church_id: churchId, ministry_id: producaoId, name: "Produção" })
      .select("id")
      .single();
    const fn = await owner
      .from("team_functions")
      .insert({
        church_id: churchId,
        ministry_id: producaoId,
        department_id: team.data!.id,
        name: "MC",
      })
      .select("id")
      .single();
    expect(fn.error).toBeNull();

    const operational = await owner.from("ministry_member_functions").insert({
      church_id: churchId,
      ministry_id: producaoId,
      user_id: leaderId,
      function_id: fn.data!.id,
    });
    expect(operational.error).toBeNull();

    const permissions = await leader
      .from("ministry_admin_permissions")
      .select("ministry_id")
      .eq("ministry_id", producaoId);
    expect(permissions.data).toEqual([]);
  });

  it("isola permissões entre igrejas", async () => {
    const permissions = await outsider
      .from("ministry_admin_permissions")
      .select("id")
      .eq("church_id", churchId);
    expect(permissions.error).toBeNull();
    expect(permissions.data).toEqual([]);
  });

});
