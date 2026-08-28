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

async function userId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw error ?? new Error("Usuário de teste ausente");
  return data.user.id;
}

async function requiredId(
  result: PromiseLike<{
    data: { id: string } | null;
    error: { message: string } | null;
  }>,
): Promise<string> {
  const { data, error } = await result;
  if (error || !data) throw new Error(error?.message ?? "Registro de teste ausente");
  return data.id;
}

const rpcPayload = (songId: string, overrides: Record<string, unknown> = {}) => ({
  p_song_id: songId,
  p_arrangement_id: null,
  p_arrangement_name: "Importado",
  p_source_kind: "PASTE",
  p_source_format: "PLAIN",
  p_original_filename: null,
  p_mime_type: null,
  p_raw_content: "C  G\nCanção original",
  p_chordpro_content: "[C]Canção [G]original",
  p_metadata: { key: "C", bpm: 72, timeSignature: "4/4" },
  p_warnings: [],
  ...overrides,
});

describe("confirm_chord_import — fluxo transacional", () => {
  let leaderA: SupabaseClient;
  let memberA: SupabaseClient;
  let coordB: SupabaseClient;
  let churchA: string;
  let churchB: string;
  let songNew: string;
  let songExisting: string;
  let songConcurrent: string;
  let songAtomic: string;
  let songB: string;
  let existingArrangement: string;
  let concurrentArrangement: string;
  let arrangementB: string;
  const run = Date.now();

  beforeAll(async () => {
    leaderA = await newUser(`rpc-leader-a-${run}@teste.dev`);
    memberA = await newUser(`rpc-member-a-${run}@teste.dev`);
    coordB = await newUser(`rpc-coord-b-${run}@teste.dev`);

    const ownerA = await newUser(`rpc-owner-a-${run}@teste.dev`);
    const churchAResult = await ownerA.rpc("create_church", {
      p_name: "Igreja RPC A",
      p_slug: `rpc-a-${run}`,
    });
    if (churchAResult.error || !churchAResult.data) throw churchAResult.error;
    churchA = churchAResult.data;

    const churchBResult = await coordB.rpc("create_church", {
      p_name: "Igreja RPC B",
      p_slug: `rpc-b-${run}`,
    });
    if (churchBResult.error || !churchBResult.data) throw churchBResult.error;
    churchB = churchBResult.data;

    const invite = await admin.from("churches").select("invite_code").eq("id", churchA).single();
    if (invite.error || !invite.data) throw invite.error;
    for (const client of [leaderA, memberA]) {
      const joined = await client.rpc("join_church", { p_invite_code: invite.data.invite_code });
      if (joined.error) throw joined.error;
    }

    const ministry = await requiredId(
      ownerA
        .from("ministries")
        .insert({ church_id: churchA, name: "Louvor RPC", slug: "louvor-rpc" })
        .select("id")
        .single(),
    );
    const leaderRole = await admin.from("ministry_members").insert({
      church_id: churchA,
      ministry_id: ministry,
      user_id: await userId(leaderA),
      role: "lider",
    });
    if (leaderRole.error) throw leaderRole.error;

    const createSong = (title: string) =>
      leaderA
        .from("songs")
        .insert({ church_id: churchA, title })
        .select("id")
        .single();
    songNew = await requiredId(createSong("RPC nova"));
    songExisting = await requiredId(createSong("RPC existente"));
    songConcurrent = await requiredId(createSong("RPC concorrente"));
    songAtomic = await requiredId(createSong("RPC atômica"));
    songB = await requiredId(
      coordB.from("songs").insert({ church_id: churchB, title: "RPC externa" }).select("id").single(),
    );

    existingArrangement = await requiredId(
      leaderA
        .from("song_arrangements")
        .insert({ church_id: churchA, song_id: songExisting, name: "Existente" })
        .select("id")
        .single(),
    );
    await requiredId(
      leaderA
        .from("song_arrangement_versions")
        .insert({
          church_id: churchA,
          arrangement_id: existingArrangement,
          version_number: 1,
          format: "CHORDPRO",
          content: "[C]Versão um",
        })
        .select("id")
        .single(),
    );
    concurrentArrangement = await requiredId(
      leaderA
        .from("song_arrangements")
        .insert({ church_id: churchA, song_id: songConcurrent, name: "Concorrente" })
        .select("id")
        .single(),
    );
    arrangementB = await requiredId(
      coordB
        .from("song_arrangements")
        .insert({ church_id: churchB, song_id: songB, name: "Externo" })
        .select("id")
        .single(),
    );
  });

  it("líder cria arranjo, versão 1 e import confirmado preservando raw_content", async () => {
    const { data, error } = await leaderA.rpc("confirm_chord_import", rpcPayload(songNew));
    expect(error).toBeNull();
    expect(data?.[0]?.version_number).toBe(1);

    const imported = await leaderA
      .from("song_imports")
      .select("status, raw_content, arrangement_id, resulting_version_id")
      .eq("id", data![0].import_id)
      .single();
    const song = await leaderA
      .from("songs")
      .select("default_arrangement_id")
      .eq("id", songNew)
      .single();
    expect(imported.error).toBeNull();
    expect(imported.data).toMatchObject({
      status: "CONFIRMED",
      raw_content: "C  G\nCanção original",
      arrangement_id: data![0].arrangement_id,
      resulting_version_id: data![0].version_id,
    });
    expect(song.data?.default_arrangement_id).toBe(data![0].arrangement_id);
  });

  it("arranjo existente recebe a próxima versão sem trocar o default já definido", async () => {
    const defaultBefore = await leaderA
      .from("songs")
      .update({ default_arrangement_id: existingArrangement })
      .eq("id", songExisting)
      .select("default_arrangement_id")
      .single();
    expect(defaultBefore.error).toBeNull();

    const { data, error } = await leaderA.rpc(
      "confirm_chord_import",
      rpcPayload(songExisting, {
        p_arrangement_id: existingArrangement,
        p_arrangement_name: "ignorado",
      }),
    );
    expect(error).toBeNull();
    expect(data?.[0]?.version_number).toBe(2);
    const song = await leaderA
      .from("songs")
      .select("default_arrangement_id")
      .eq("id", songExisting)
      .single();
    expect(song.data?.default_arrangement_id).toBe(existingArrangement);
  });

  it("membro comum é bloqueado sem criar registros parciais", async () => {
    const before = await admin.from("song_imports").select("id", { count: "exact", head: true }).eq("song_id", songAtomic);
    const result = await memberA.rpc("confirm_chord_import", rpcPayload(songAtomic));
    const after = await admin.from("song_imports").select("id", { count: "exact", head: true }).eq("song_id", songAtomic);
    expect(result.error).not.toBeNull();
    expect(after.count).toBe(before.count);
  });

  it("arranjo de outra igreja é bloqueado sem criar import parcial", async () => {
    const before = await admin.from("song_imports").select("id", { count: "exact", head: true }).eq("song_id", songExisting);
    const result = await leaderA.rpc(
      "confirm_chord_import",
      rpcPayload(songExisting, { p_arrangement_id: arrangementB }),
    );
    const after = await admin.from("song_imports").select("id", { count: "exact", head: true }).eq("song_id", songExisting);
    expect(result.error).not.toBeNull();
    expect(after.count).toBe(before.count);
  });

  it("conteúdo vazio falha atomicamente", async () => {
    const before = await admin.from("song_imports").select("id", { count: "exact", head: true }).eq("song_id", songAtomic);
    const result = await leaderA.rpc(
      "confirm_chord_import",
      rpcPayload(songAtomic, { p_raw_content: "   " }),
    );
    const after = await admin.from("song_imports").select("id", { count: "exact", head: true }).eq("song_id", songAtomic);
    expect(result.error).not.toBeNull();
    expect(after.count).toBe(before.count);
  });

  it("imports concorrentes recebem version_number distintos", async () => {
    const payload = rpcPayload(songConcurrent, {
      p_arrangement_id: concurrentArrangement,
      p_arrangement_name: "ignorado",
    });
    const [first, second] = await Promise.all([
      leaderA.rpc("confirm_chord_import", payload),
      leaderA.rpc("confirm_chord_import", {
        ...payload,
        p_raw_content: "D A\nSegunda importação",
        p_chordpro_content: "[D]Segunda [A]importação",
      }),
    ]);
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
    expect([first.data![0].version_number, second.data![0].version_number].sort()).toEqual([1, 2]);
  });

  it("anon não pode executar a função", async () => {
    const anonymous = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await anonymous.rpc("confirm_chord_import", rpcPayload(songNew));
    expect(error).not.toBeNull();
  });
});
