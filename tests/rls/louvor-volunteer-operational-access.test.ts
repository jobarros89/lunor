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

describe("Louvor — acesso operacional do voluntário", () => {
  let owner: SupabaseClient;
  let volunteer: SupabaseClient;
  let outsider: SupabaseClient;
  let churchId: string;
  let louvorId: string;
  let eventId: string;
  let songId: string;
  let secondSongId: string;
  let arrangementId: string;
  let materialId: string;
  let assignmentId: string;
  let requestId: string;
  let volunteerId: string;
  const run = Date.now();

  beforeAll(async () => {
    owner = await newUser(`louvor-op-owner-${run}@teste.dev`);
    volunteer = await newUser(`louvor-op-volunteer-${run}@teste.dev`);
    outsider = await newUser(`louvor-op-outsider-${run}@teste.dev`);

    churchId = (
      await owner.rpc("create_church", {
        p_name: "Igreja Louvor Operacional",
        p_slug: `louvor-op-${run}`,
      })
    ).data;

    const { data: church } = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchId)
      .single();

    await Promise.all([
      volunteer.rpc("join_church", { p_invite_code: church!.invite_code }),
      outsider.rpc("join_church", { p_invite_code: church!.invite_code }),
    ]);

    volunteerId = await uid(volunteer);

    louvorId = (
      await owner
        .from("ministries")
        .insert({ church_id: churchId, name: "Louvor", slug: `louvor-${run}` })
        .select("id")
        .single()
    ).data!.id;

    const { error: membershipError } = await owner.from("ministry_members").insert({
      church_id: churchId,
      ministry_id: louvorId,
      user_id: volunteerId,
      role: "voluntario",
    });
    expect(membershipError).toBeNull();

    eventId = (
      await owner
        .from("events")
        .insert({
          church_id: churchId,
          title: "Culto com Louvor",
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    songId = (
      await owner
        .from("songs")
        .insert({
          church_id: churchId,
          title: `Canção base ${run}`,
          artist: "LUNOR Test",
          default_key: "G",
        })
        .select("id")
        .single()
    ).data!.id;

    secondSongId = (
      await owner
        .from("songs")
        .insert({
          church_id: churchId,
          title: `Canção secundária ${run}`,
          artist: "LUNOR Test",
          default_key: "D",
        })
        .select("id")
        .single()
    ).data!.id;

    const { error: setlistError } = await owner.from("setlist_items").insert({
      church_id: churchId,
      event_id: eventId,
      song_id: songId,
      position: 1,
    });
    expect(setlistError).toBeNull();

    arrangementId = (
      await owner
        .from("song_arrangements")
        .insert({
          church_id: churchId,
          song_id: songId,
          name: "Arranjo principal",
        })
        .select("id")
        .single()
    ).data!.id;

    const { data: version, error: versionError } = await owner
      .from("song_arrangement_versions")
      .insert({
        church_id: churchId,
        arrangement_id: arrangementId,
        version_number: 1,
        format: "PLAIN",
        content: "[Verso]\nG C",
        original_key: "G",
      })
      .select("id")
      .single();
    expect(versionError).toBeNull();

    materialId = (
      await owner
        .from("rehearsal_materials")
        .insert({
          church_id: churchId,
          song_id: songId,
          arrangement_version_id: version!.id,
          label: "Guia do arranjo",
          category: "GUIDE",
          file_name: "guia.mp3",
          storage_object_path: `${churchId}/${songId}/${run}-guia.mp3`,
          mime_type: "audio/mpeg",
          size_bytes: 1024,
        })
        .select("id")
        .single()
    ).data!.id;

    assignmentId = (
      await owner
        .from("assignments")
        .insert({
          church_id: churchId,
          ministry_id: louvorId,
          event_id: eventId,
          user_id: volunteerId,
          role_name: "Baixo",
          status: "convidado",
        })
        .select("id")
        .single()
    ).data!.id;

    const request = await owner.rpc("create_availability_request", {
      p_church: churchId,
      p_ministry: louvorId,
      p_title: "Disponibilidade do Louvor",
      p_event_ids: [eventId],
      p_respond_by: null,
    });
    expect(request.error).toBeNull();
    requestId = request.data;
  });

  it("voluntário cadastra, edita e arquiva músicas do acervo", async () => {
    const created = await volunteer
      .from("songs")
      .insert({
        church_id: churchId,
        title: `Canção criada pelo voluntário ${run}`,
        artist: "Time de Louvor",
        default_key: "C",
      })
      .select("id")
      .single();
    expect(created.error).toBeNull();

    const updated = await volunteer
      .from("songs")
      .update({
        title: `Canção editada pelo voluntário ${run}`,
        lyrics: "Letra revisada",
        active: false,
      })
      .eq("id", created.data!.id)
      .eq("church_id", churchId)
      .select("title, lyrics, active")
      .single();
    expect(updated.error).toBeNull();
    expect(updated.data).toEqual({
      title: `Canção editada pelo voluntário ${run}`,
      lyrics: "Letra revisada",
      active: false,
    });

    const permanentDelete = await volunteer.rpc("delete_song", {
      p_church_id: churchId,
      p_song_id: created.data!.id,
    });
    expect(permanentDelete.error).not.toBeNull();
    expect(permanentDelete.error?.code).toBe("42501");
  });

  it("membro da igreja fora do Louvor não edita o acervo", async () => {
    const attempt = await outsider
      .from("songs")
      .update({ title: "Não deveria alterar" })
      .eq("id", songId)
      .eq("church_id", churchId)
      .select("id");

    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);
  });

  it("voluntário vê repertório em rascunho, mas não monta nem altera a sequência", async () => {
    const visible = await volunteer
      .from("setlist_items")
      .select("id, song_id, position")
      .eq("event_id", eventId)
      .order("position");
    expect(visible.error).toBeNull();
    expect(visible.data?.map((row) => row.song_id)).toContain(songId);

    const addAttempt = await volunteer.from("setlist_items").insert({
      church_id: churchId,
      event_id: eventId,
      song_id: secondSongId,
      position: 2,
    });
    expect(addAttempt.error).not.toBeNull();

    const updateAttempt = await volunteer
      .from("setlist_items")
      .update({ key_override: "A" })
      .eq("event_id", eventId)
      .eq("song_id", songId)
      .select("id");
    expect(updateAttempt.error).toBeNull();
    expect(updateAttempt.data).toEqual([]);
  });

  it("voluntário visualiza arranjos e materiais sem ganhar edição de arranjo", async () => {
    const [{ data: arrangements, error: arrangementError }, { data: materials, error: materialError }] =
      await Promise.all([
        volunteer
          .from("song_arrangements")
          .select("id, name")
          .eq("id", arrangementId),
        volunteer
          .from("rehearsal_materials")
          .select("id, label")
          .eq("id", materialId),
      ]);

    expect(arrangementError).toBeNull();
    expect(arrangements).toEqual([{ id: arrangementId, name: "Arranjo principal" }]);
    expect(materialError).toBeNull();
    expect(materials).toEqual([{ id: materialId, label: "Guia do arranjo" }]);

    const createArrangement = await volunteer.from("song_arrangements").insert({
      church_id: churchId,
      song_id: songId,
      name: "Arranjo indevido",
    });
    expect(createArrangement.error).not.toBeNull();
  });

  it("voluntário acessa a escala, responde a própria convocação e não cria escala", async () => {
    const visible = await volunteer
      .from("assignments")
      .select("id, role_name, status")
      .eq("event_id", eventId)
      .eq("ministry_id", louvorId);
    expect(visible.error).toBeNull();
    expect(visible.data?.some((row) => row.id === assignmentId && row.role_name === "Baixo")).toBe(true);

    const response = await volunteer
      .from("assignments")
      .update({ status: "confirmado" })
      .eq("id", assignmentId)
      .select("status")
      .single();
    expect(response.error).toBeNull();
    expect(response.data?.status).toBe("confirmado");

    const createAssignment = await volunteer.from("assignments").insert({
      church_id: churchId,
      ministry_id: louvorId,
      event_id: eventId,
      user_id: volunteerId,
      role_name: "Teclado",
      status: "convidado",
    });
    expect(createAssignment.error).not.toBeNull();
  });

  it("voluntário envia disponibilidade mensal e responde solicitação da liderança", async () => {
    const calendar = await volunteer
      .from("member_availability_calendar")
      .insert({
        church_id: churchId,
        ministry_id: louvorId,
        campus_id: null,
        user_id: volunteerId,
        availability_date: "2099-02-01",
        period: "all_day",
        status: "available",
      });
    expect(calendar.error).toBeNull();

    const response = await volunteer
      .from("member_availability")
      .insert({
        church_id: churchId,
        ministry_id: louvorId,
        event_id: eventId,
        user_id: volunteerId,
        request_id: requestId,
        status: "available",
      })
      .select("status, source")
      .single();
    expect(response.error).toBeNull();
    expect(response.data).toEqual({ status: "available", source: "leader_request" });

    const changed = await volunteer
      .from("member_availability")
      .update({ status: "unavailable", note: "Não consigo neste dia" })
      .eq("event_id", eventId)
      .eq("ministry_id", louvorId)
      .eq("user_id", volunteerId)
      .select("status, note")
      .single();
    expect(changed.error).toBeNull();
    expect(changed.data).toEqual({
      status: "unavailable",
      note: "Não consigo neste dia",
    });
  });
});
