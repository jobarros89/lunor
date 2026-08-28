import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.API_URL!;
const anonKey = process.env.ANON_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function newUser(email: string): Promise<SupabaseClient> {
  await admin.auth.admin.createUser({
    email,
    password: "senha-teste-123",
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await c.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return c;
}

// Indisponibilidade + interesses (migration 18): o voluntário gerencia os
// seus; ninguém escreve nos do outro; líder lê p/ escalar; isolamento tenant.
describe("Indisponibilidade e interesses (RLS)", () => {
  let lider: SupabaseClient; // admin da igreja A (é líder)
  let vol: SupabaseClient; // voluntário de A
  let outro: SupabaseClient; // admin da igreja B
  let churchA: string;
  let volId: string;
  let skillId: string;
  const run = Date.now();

  beforeAll(async () => {
    lider = await newUser(`ea-lider-${run}@teste.dev`);
    vol = await newUser(`ea-vol-${run}@teste.dev`);
    outro = await newUser(`ea-outro-${run}@teste.dev`);
    churchA = (
      await lider.rpc("create_church", { p_name: "EA", p_slug: `ea-${run}` })
    ).data;
    await outro.rpc("create_church", { p_name: "EB", p_slug: `eb-${run}` });
    const { data: ch } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    await vol.rpc("join_church", { p_invite_code: ch!.invite_code });
    volId = (await vol.auth.getUser()).data.user!.id;
    skillId = (
      await lider
        .from("skills")
        .select("id")
        .eq("church_id", churchA)
        .limit(1)
        .single()
    ).data!.id;
  });

  it("voluntário marca sua própria indisponibilidade", async () => {
    const { error } = await vol.from("unavailability").insert({
      church_id: churchA,
      user_id: volId,
      start_date: "2026-08-01",
      end_date: "2026-08-10",
      reason: "viagem",
    });
    expect(error).toBeNull();
  });

  it("líder lê a indisponibilidade do voluntário (p/ escalar)", async () => {
    const { data } = await lider
      .from("unavailability")
      .select("id")
      .eq("user_id", volId);
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("outro membro NÃO marca indisponibilidade no nome do voluntário", async () => {
    const carol = await newUser(`ea-carol-${run}@teste.dev`);
    const { data: ch } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    await carol.rpc("join_church", { p_invite_code: ch!.invite_code });
    const { data, error } = await carol
      .from("unavailability")
      .insert({
        church_id: churchA,
        user_id: volId,
        start_date: "2026-09-01",
        end_date: "2026-09-01",
      })
      .select();
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("voluntário registra e remove seu interesse", async () => {
    const ins = await vol
      .from("member_interests")
      .insert({ church_id: churchA, user_id: volId, skill_id: skillId });
    expect(ins.error).toBeNull();
    const { data } = await vol
      .from("member_interests")
      .delete()
      .eq("user_id", volId)
      .eq("skill_id", skillId)
      .select();
    expect((data ?? []).length).toBe(1);
  });

  it("membro de outra igreja não vê a indisponibilidade de A", async () => {
    const { data } = await outro
      .from("unavailability")
      .select("id")
      .eq("church_id", churchA);
    expect(data).toEqual([]);
  });
});
