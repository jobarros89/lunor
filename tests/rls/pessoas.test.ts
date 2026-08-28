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

describe("Fase 1 — skills, briefing e aptidões (RLS)", () => {
  let gestor: SupabaseClient; // admin da igreja
  let vol: SupabaseClient; // voluntário
  let outsider: SupabaseClient; // de outra igreja
  let churchId: string;
  let skillFotografia: string;
  const run = Date.now();

  beforeAll(async () => {
    gestor = await newUser(`gestor-${run}@teste.dev`);
    vol = await newUser(`vol-${run}@teste.dev`);
    outsider = await newUser(`outsider-${run}@teste.dev`);

    const a = await gestor.rpc("create_church", {
      p_name: "Igreja Skills",
      p_slug: `igreja-skills-${run}`,
    });
    expect(a.error).toBeNull();
    churchId = a.data;

    await outsider.rpc("create_church", {
      p_name: "Igreja Outra",
      p_slug: `igreja-outra-${run}`,
    });

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await vol.rpc("join_church", { p_invite_code: church!.invite_code });

    const { data: skill } = await gestor
      .from("skills")
      .select("id")
      .eq("church_id", churchId)
      .eq("slug", "fotografia")
      .single();
    skillFotografia = skill!.id;
  });

  it("skills padrão são semeadas ao criar a igreja", async () => {
    const { data } = await gestor
      .from("skills")
      .select("slug")
      .eq("church_id", churchId);
    expect(data!.map((s) => s.slug).sort()).toContain("fotografia");
    expect(data!.length).toBeGreaterThanOrEqual(7);
  });

  it("outsider não lê skills da igreja", async () => {
    const { data } = await outsider
      .from("skills")
      .select("id")
      .eq("church_id", churchId);
    expect(data).toEqual([]);
  });

  it("voluntário sugere skill própria (pendente), mas não aprovada", async () => {
    const volId = await uid(vol);
    // sugestão pendente: ok
    const { error } = await vol.from("member_skills").insert({
      skill_id: skillFotografia,
      church_id: churchId,
      user_id: volId,
      source: "experience",
    });
    expect(error).toBeNull();

    // tentar se auto-aprovar: bloqueado
    const { data: updated } = await vol
      .from("member_skills")
      .update({ approved_by: volId, approved_at: new Date().toISOString() })
      .eq("skill_id", skillFotografia)
      .eq("user_id", volId)
      .select();
    expect(updated).toEqual([]);
  });

  it("gestor aprova aptidão por experiência do voluntário", async () => {
    const volId = await uid(vol);
    const gestorId = await uid(gestor);
    const { data, error } = await gestor
      .from("member_skills")
      .update({
        approved_by: gestorId,
        approved_at: new Date().toISOString(),
        source: "experience",
      })
      .eq("skill_id", skillFotografia)
      .eq("user_id", volId)
      .select();
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].approved_by).toBe(gestorId);
  });

  it("voluntário grava o próprio briefing; gestor lê; outsider não", async () => {
    const volId = await uid(vol);
    const { error } = await vol.from("briefing_responses").insert({
      church_id: churchId,
      user_id: volId,
      answers: { profissao: "Fotógrafo", dias: ["domingo"] },
      summary: "Fotógrafo com disponibilidade aos domingos.",
    });
    expect(error).toBeNull();

    const { data: fromGestor } = await gestor
      .from("briefing_responses")
      .select("summary")
      .eq("church_id", churchId)
      .eq("user_id", volId);
    expect(fromGestor).toHaveLength(1);

    const { data: fromOutsider } = await outsider
      .from("briefing_responses")
      .select("id")
      .eq("church_id", churchId);
    expect(fromOutsider).toEqual([]);
  });

  it("voluntário não grava briefing em nome de outro", async () => {
    const gestorId = await uid(gestor);
    const { error } = await vol.from("briefing_responses").insert({
      church_id: churchId,
      user_id: gestorId,
      answers: {},
    });
    expect(error).not.toBeNull();
  });
});
