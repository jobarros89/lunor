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
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await client.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return client;
}

// Verifica a query que alimenta o badge "escalas aguardando confirmação"
// (aviso in-app). Conta assignments status='convidado' em eventos futuros.
async function contarPendentes(
  client: SupabaseClient,
  userId: string,
  churchId: string
): Promise<number> {
  const { count } = await client
    .from("assignments")
    .select("id, events!inner(starts_at)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("church_id", churchId)
    .eq("status", "convidado")
    .gte("events.starts_at", new Date().toISOString());
  return count ?? 0;
}

describe("Badge de escalas pendentes (aviso in-app)", () => {
  let lider: SupabaseClient;
  let vol: SupabaseClient;
  let churchId: string;
  let volId: string;
  let futuroId: string;
  const run = Date.now();
  const amanha = new Date(Date.now() + 86400000).toISOString();
  const ontem = new Date(Date.now() - 86400000).toISOString();

  beforeAll(async () => {
    lider = await newUser(`badge-lider-${run}@teste.dev`);
    vol = await newUser(`badge-vol-${run}@teste.dev`);
    churchId = (
      await lider.rpc("create_church", {
        p_name: "Badge Ch",
        p_slug: `badge-${run}`,
      })
    ).data;
    const { data: ch } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    await vol.rpc("join_church", { p_invite_code: ch!.invite_code });
    volId = (await vol.auth.getUser()).data.user!.id;

    futuroId = (
      await lider
        .from("events")
        .insert({ church_id: churchId, title: "Culto Amanhã", starts_at: amanha })
        .select("id")
        .single()
    ).data!.id;
  });

  it("conta escala futura aguardando confirmação", async () => {
    await lider.from("assignments").insert({
      church_id: churchId,
      event_id: futuroId,
      user_id: volId,
      role_name: "Fotografia",
    });
    expect(await contarPendentes(vol, volId, churchId)).toBe(1);
  });

  it("some ao confirmar presença", async () => {
    await vol
      .from("assignments")
      .update({ status: "confirmado" })
      .eq("event_id", futuroId)
      .eq("user_id", volId);
    expect(await contarPendentes(vol, volId, churchId)).toBe(0);
  });

  it("não conta escala de evento passado", async () => {
    const passadoId = (
      await lider
        .from("events")
        .insert({ church_id: churchId, title: "Culto Ontem", starts_at: ontem })
        .select("id")
        .single()
    ).data!.id;
    await lider.from("assignments").insert({
      church_id: churchId,
      event_id: passadoId,
      user_id: volId,
      role_name: "Apoio",
    });
    expect(await contarPendentes(vol, volId, churchId)).toBe(0);
  });
});
