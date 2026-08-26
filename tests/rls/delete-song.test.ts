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
  const signedIn = await client.auth.signInWithPassword({
    email,
    password: "senha-teste-123",
  });
  if (signedIn.error) throw signedIn.error;
  return client;
}

async function userId(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getUser();
  return data.user!.id;
}

describe("delete_song — exclusão permanente segura", () => {
  let leader: SupabaseClient;
  let member: SupabaseClient;
  let churchId: string;
  let unusedSongId: string;
  let usedSongId: string;
  let memberSongId: string;
  let arrangementId: string;
  const run = Date.now();

  beforeAll(async () => {
    const owner = await newUser(`delete-owner-${run}@teste.dev`);
    leader = await newUser(`delete-leader-${run}@teste.dev`);
    member = await newUser(`delete-member-${run}@teste.dev`);

    const church = await owner.rpc("create_church", {
      p_name: "Igreja Delete",
      p_slug: `delete-${run}`,
    });
    if (church.error || !church.data) throw church.error;
    churchId = church.data;

    const invite = await owner
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();
    if (invite.error || !invite.data) throw invite.error;
    await leader.rpc("join_church", { p_invite_code: invite.data.invite_code });
    await member.rpc("join_church", { p_invite_code: invite.data.invite_code });

    const ministry = await owner
      .from("ministries")
      .insert({ church_id: churchId, name: "Louvor", slug: "louvor" })
      .select("id")
      .single();
    if (ministry.error || !ministry.data) throw ministry.error;
    const role = await admin.from("ministry_members").insert({
      church_id: churchId,
      ministry_id: ministry.data.id,
      user_id: await userId(leader),
      role: "lider",
    });
    if (role.error) throw role.error;

    const songs = await leader
      .from("songs")
      .insert([
        { church_id: churchId, title: "Cadastro errado" },
        { church_id: churchId, title: "Música usada" },
        { church_id: churchId, title: "Música protegida" },
      ])
      .select("id, title");
    if (songs.error || !songs.data) throw songs.error;
    unusedSongId = songs.data.find((song) => song.title === "Cadastro errado")!.id;
    usedSongId = songs.data.find((song) => song.title === "Música usada")!.id;
    memberSongId = songs.data.find((song) => song.title === "Música protegida")!.id;

    const arrangement = await leader
      .from("song_arrangements")
      .insert({
        church_id: churchId,
        song_id: unusedSongId,
        name: "Original",
      })
      .select("id")
      .single();
    if (arrangement.error || !arrangement.data) throw arrangement.error;
    arrangementId = arrangement.data.id;
    const version = await leader.from("song_arrangement_versions").insert({
      church_id: churchId,
      arrangement_id: arrangementId,
      version_number: 1,
      format: "CHORDPRO",
      content: "[C]Cadastro errado",
    });
    if (version.error) throw version.error;
    const defaultArrangement = await leader
      .from("songs")
      .update({ default_arrangement_id: arrangementId })
      .eq("id", unusedSongId);
    if (defaultArrangement.error) throw defaultArrangement.error;

    const event = await owner
      .from("events")
      .insert({
        church_id: churchId,
        title: "Culto",
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (event.error || !event.data) throw event.error;
    const item = await leader.from("setlist_items").insert({
      church_id: churchId,
      event_id: event.data.id,
      song_id: usedSongId,
      position: 1,
    });
    if (item.error) throw item.error;
  });

  it("bloqueia a exclusão de música vinculada a repertório", async () => {
    const result = await leader.rpc("delete_song", {
      p_church_id: churchId,
      p_song_id: usedSongId,
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe("in_use");

    const song = await admin.from("songs").select("id").eq("id", usedSongId);
    expect(song.data).toHaveLength(1);
  });

  it("membro comum não exclui música", async () => {
    const result = await member.rpc("delete_song", {
      p_church_id: churchId,
      p_song_id: memberSongId,
    });
    expect(result.error).not.toBeNull();

    const song = await admin.from("songs").select("id").eq("id", memberSongId);
    expect(song.data).toHaveLength(1);
  });

  it("líder exclui cadastro sem uso e os arranjos em cascata", async () => {
    const result = await leader.rpc("delete_song", {
      p_church_id: churchId,
      p_song_id: unusedSongId,
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe("deleted");

    const song = await admin.from("songs").select("id").eq("id", unusedSongId);
    const arrangement = await admin
      .from("song_arrangements")
      .select("id")
      .eq("id", arrangementId);
    expect(song.data).toHaveLength(0);
    expect(arrangement.data).toHaveLength(0);
  });

  it("anon não executa a exclusão", async () => {
    const anonymous = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const result = await anonymous.rpc("delete_song", {
      p_church_id: churchId,
      p_song_id: memberSongId,
    });
    expect(result.error).not.toBeNull();
  });
});
