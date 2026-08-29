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

async function uid(client: SupabaseClient) {
  return (await client.auth.getUser()).data.user!.id;
}

describe("Louvor V1 — acesso ao acervo e repertório publicado", () => {
  let coord: SupabaseClient;
  let leader: SupabaseClient;
  let worshipMember: SupabaseClient;
  let mediaMember: SupabaseClient;
  let churchId: string;
  let louvorId: string;
  let midiaId: string;
  let eventId: string;
  let songId: string;
  let materialId: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`louvor-coord-${run}@teste.dev`);
    leader = await newUser(`louvor-leader-${run}@teste.dev`);
    worshipMember = await newUser(`louvor-member-${run}@teste.dev`);
    mediaMember = await newUser(`louvor-media-${run}@teste.dev`);

    churchId = (
      await coord.rpc("create_church", {
        p_name: "Igreja Louvor Access",
        p_slug: `louvor-access-${run}`,
      })
    ).data;

    midiaId = (
      await admin
        .from("ministries")
        .select("id")
        .eq("church_id", churchId)
        .eq("slug", "midia")
        .single()
    ).data!.id;

    louvorId = (
      await coord
        .from("ministries")
        .insert({ church_id: churchId, name: "Louvor", slug: "louvor" })
        .select("id")
        .single()
    ).data!.id;

    const invite = (
      await admin.from("churches").select("invite_code").eq("id", churchId).single()
    ).data!.invite_code;
    for (const client of [leader, worshipMember, mediaMember]) {
      await client.rpc("join_church", { p_invite_code: invite });
    }

    await admin.from("ministry_members").insert([
      {
        ministry_id: louvorId,
        church_id: churchId,
        user_id: await uid(leader),
        role: "lider",
      },
      {
        ministry_id: louvorId,
        church_id: churchId,
        user_id: await uid(worshipMember),
        role: "voluntario",
      },
      {
        ministry_id: midiaId,
        church_id: churchId,
        user_id: await uid(mediaMember),
        role: "voluntario",
      },
    ]);

    eventId = (
      await coord
        .from("events")
        .insert({
          church_id: churchId,
          title: "Culto com repertório",
          starts_at: new Date(Date.now() + 60_000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    songId = (
      await leader
        .from("songs")
        .insert({
          church_id: churchId,
          title: `Canção ${run}`,
          artist: "LUNOR Test",
          default_key: "G",
        })
        .select("id")
        .single()
    ).data!.id;

    const setlist = await leader.from("setlist_items").insert({
      church_id: churchId,
      event_id: eventId,
      song_id: songId,
      position: 1,
    });
    if (setlist.error) throw setlist.error;

    const assignment = await coord.from("assignments").insert({
      church_id: churchId,
      ministry_id: midiaId,
      event_id: eventId,
      user_id: await uid(mediaMember),
      role_name: "Mídia",
      status: "confirmado",
    });
    if (assignment.error) throw assignment.error;

    materialId = (
      await leader
        .from("rehearsal_materials")
        .insert({
          church_id: churchId,
          song_id: songId,
          label: "Guia privada",
          category: "GUIDE",
          file_name: "guia.mp3",
          storage_object_path: `${churchId}/${songId}/${run}-guia.mp3`,
          mime_type: "audio/mpeg",
          size_bytes: 1024,
        })
        .select("id")
        .single()
    ).data!.id;
  });

  it("membro do Louvor consulta o acervo", async () => {
    const { data, error } = await worshipMember
      .from("songs")
      .select("id")
      .eq("id", songId);
    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.id)).toContain(songId);
  });

  it("membro de outro ministério não consulta o acervo em rascunho", async () => {
    const { data, error } = await mediaMember
      .from("songs")
      .select("id")
      .eq("id", songId);
    expect(error).toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("escalado em outro ministério recebe somente a exceção do repertório publicado", async () => {
    const publish = await admin
      .from("events")
      .update({ setlist_status: "publicado", setlist_published_at: new Date().toISOString() })
      .eq("id", eventId);
    if (publish.error) throw publish.error;

    const { data: songs, error: songError } = await mediaMember
      .from("songs")
      .select("id")
      .eq("id", songId);
    expect(songError).toBeNull();
    expect((songs ?? []).map((row) => row.id)).toContain(songId);

    const { data: setlist, error: setlistError } = await mediaMember
      .from("setlist_items")
      .select("id, song_id")
      .eq("event_id", eventId);
    expect(setlistError).toBeNull();
    expect((setlist ?? []).some((row) => row.song_id === songId)).toBe(true);
  });

  it("material de ensaio continua restrito ao Louvor mesmo para escalado no culto", async () => {
    const { data: mediaData, error: mediaError } = await mediaMember
      .from("rehearsal_materials")
      .select("id")
      .eq("id", materialId);
    expect(mediaError).toBeNull();
    expect(mediaData ?? []).toEqual([]);

    const { data: worshipData, error: worshipError } = await worshipMember
      .from("rehearsal_materials")
      .select("id")
      .eq("id", materialId);
    expect(worshipError).toBeNull();
    expect((worshipData ?? []).map((row) => row.id)).toContain(materialId);
  });
});
