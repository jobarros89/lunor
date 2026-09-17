import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;

async function newUser(email: string): Promise<SupabaseClient> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const service = createClient(url, process.env.SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await service.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (signInError) throw signInError;
  return client;
}

describe("hierarquia genérica de ministérios", () => {
  let owner: SupabaseClient;
  let outsider: SupabaseClient;
  let churchId: string;
  let ministryId: string;
  let teamId: string;
  let functionId: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`hierarchy-owner-${run}@teste.dev`);
    outsider = await newUser(`hierarchy-outsider-${run}@teste.dev`);

    const created = await owner.rpc("create_church", {
      p_name: "Igreja Hierarquia",
      p_slug: `igreja-hierarquia-${run}`,
    });
    expect(created.error).toBeNull();
    churchId = created.data;

    const other = await outsider.rpc("create_church", {
      p_name: "Outra Igreja",
      p_slug: `outra-igreja-${run}`,
    });
    expect(other.error).toBeNull();
  });

  it("cria área, time e função com nomes livres", async () => {
    const ministry = await owner
      .from("ministries")
      .insert({ church_id: churchId, name: "Produção", slug: `producao-${run}` })
      .select("id, module_key")
      .single();
    expect(ministry.error).toBeNull();
    expect(ministry.data!.module_key).toBe("generic");
    ministryId = ministry.data!.id;

    const team = await owner
      .from("departments")
      .insert({ church_id: churchId, ministry_id: ministryId, name: "MC" })
      .select("id")
      .single();
    expect(team.error).toBeNull();
    teamId = team.data!.id;

    const fn = await owner
      .from("team_functions")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        department_id: teamId,
        name: "Trilha",
      })
      .select("id")
      .single();
    expect(fn.error).toBeNull();
    functionId = fn.data!.id;
  });

  it("isola funções por igreja via RLS", async () => {
    const visible = await outsider.from("team_functions").select("id");
    expect(visible.error).toBeNull();
    expect(visible.data).toHaveLength(0);

    const attempted = await outsider.from("team_functions").insert({
      church_id: churchId,
      ministry_id: ministryId,
      department_id: teamId,
      name: "Áudio",
    });
    expect(attempted.error).not.toBeNull();
  });

  it("sincroniza a função escolhida na escala sem quebrar role_name", async () => {
    const {
      data: { user },
    } = await owner.auth.getUser();
    const event = await owner
      .from("events")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        title: "Culto",
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    expect(event.error).toBeNull();

    const assignment = await owner
      .from("assignments")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        department_id: teamId,
        function_id: functionId,
        event_id: event.data!.id,
        user_id: user!.id,
        role_name: "valor substituído pelo trigger",
      })
      .select("role_name, function_id")
      .single();

    expect(assignment.error).toBeNull();
    expect(assignment.data).toMatchObject({
      role_name: "Trilha",
      function_id: functionId,
    });
  });
});
