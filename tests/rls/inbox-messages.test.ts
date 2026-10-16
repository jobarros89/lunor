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

describe("Mensagens internas — escopo e RLS", () => {
  let owner: SupabaseClient;
  let leader: SupabaseClient;
  let member: SupabaseClient;
  let outsider: SupabaseClient;
  let churchId: string;
  let ministryId: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`msg-owner-${run}@teste.dev`);
    leader = await newUser(`msg-leader-${run}@teste.dev`);
    member = await newUser(`msg-member-${run}@teste.dev`);
    outsider = await newUser(`msg-outsider-${run}@teste.dev`);

    const created = await owner.rpc("create_church", {
      p_name: "Igreja Mensagens",
      p_slug: `igreja-mensagens-${run}`,
    });
    expect(created.error).toBeNull();
    churchId = created.data;

    const { data: church } = await service
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();

    expect((await leader.rpc("join_church", { p_invite_code: church!.invite_code })).error).toBeNull();
    expect((await member.rpc("join_church", { p_invite_code: church!.invite_code })).error).toBeNull();

    const { data: ministry, error: ministryError } = await service
      .from("ministries")
      .insert({
        church_id: churchId,
        name: "Louvor Teste",
        slug: `louvor-teste-${run}`,
      })
      .select("id")
      .single();
    expect(ministryError).toBeNull();
    ministryId = ministry!.id;

    const leaderId = await uid(leader);
    const memberId = await uid(member);

    const { error: membershipsError } = await service
      .from("ministry_members")
      .insert([
        {
          church_id: churchId,
          ministry_id: ministryId,
          user_id: leaderId,
          role: "voluntario",
          active: true,
        },
        {
          church_id: churchId,
          ministry_id: ministryId,
          user_id: memberId,
          role: "voluntario",
          active: true,
        },
      ]);
    expect(membershipsError).toBeNull();

    const { error: permissionError } = await service
      .from("ministry_admin_permissions")
      .insert({
        church_id: churchId,
        ministry_id: ministryId,
        user_id: leaderId,
        campus_id: null,
        role: "lider",
        source: "explicit",
      });
    expect(permissionError).toBeNull();
  });

  it("líder do ministério envia mensagem ao membro do próprio time", async () => {
    const memberId = await uid(member);
    const { data, error } = await leader.rpc("send_inbox_message", {
      p_church: churchId,
      p_ministry: ministryId,
      p_recipient: memberId,
      p_body: "Chegue 20 minutos antes para alinharmos.",
    });

    expect(error).toBeNull();
    expect(data).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const { data: received, error: readError } = await member
      .from("inbox_messages")
      .select("id, kind, body, read_at")
      .eq("id", data)
      .single();

    expect(readError).toBeNull();
    expect(received!.kind).toBe("direct");
    expect(received!.body).toContain("Chegue 20 minutos");
    expect(received!.read_at).toBeNull();
  });

  it("membro comum não pode iniciar mensagem de liderança", async () => {
    const leaderId = await uid(leader);
    const { error } = await member.rpc("send_inbox_message", {
      p_church: churchId,
      p_ministry: ministryId,
      p_recipient: leaderId,
      p_body: "Mensagem indevida",
    });

    expect(error).not.toBeNull();
  });

  it("destinatário marca somente as próprias mensagens como lidas", async () => {
    const { data: own } = await member
      .from("inbox_messages")
      .select("id")
      .eq("church_id", churchId)
      .limit(1)
      .single();

    const { data: updated, error } = await member
      .from("inbox_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("id", own!.id)
      .select("read_at")
      .single();

    expect(error).toBeNull();
    expect(updated!.read_at).not.toBeNull();

    const { data: outsiderRead } = await outsider
      .from("inbox_messages")
      .select("id")
      .eq("id", own!.id);
    expect(outsiderRead).toEqual([]);
  });

  it("coordenação da igreja pode enviar mensagem sem ministério", async () => {
    const memberId = await uid(member);
    const { data, error } = await owner.rpc("send_inbox_message", {
      p_church: churchId,
      p_ministry: null,
      p_recipient: memberId,
      p_body: "Mensagem geral da igreja",
    });

    expect(error).toBeNull();
    expect(data).toBeTruthy();
  });
});
