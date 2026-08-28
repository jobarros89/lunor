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

describe("Arranjos, versões e imports — migration 31", () => {
  let coordA: SupabaseClient;
  let leaderA: SupabaseClient;
  let memberA: SupabaseClient;
  let coordB: SupabaseClient;
  let churchA: string;
  let churchB: string;
  let songA: string;
  let otherSongA: string;
  let songB: string;
  let arrangementA: string;
  let otherArrangementA: string;
  let sameSongArrangementA: string;
  let arrangementB: string;
  let versionA: string;
  let otherVersionA: string;
  let sameSongVersionA: string;
  let versionB: string;
  let importA: string;
  let importB: string;
  let eventA: string;
  let setlistItemA: string;
  const run = Date.now();

  beforeAll(async () => {
    coordA = await newUser(`arr-coord-a-${run}@teste.dev`);
    leaderA = await newUser(`arr-leader-a-${run}@teste.dev`);
    memberA = await newUser(`arr-member-a-${run}@teste.dev`);
    coordB = await newUser(`arr-coord-b-${run}@teste.dev`);

    const churchAResult = await coordA.rpc("create_church", {
      p_name: "Igreja Arranjos A",
      p_slug: `arr-a-${run}`,
    });
    if (churchAResult.error || !churchAResult.data) {
      throw new Error(churchAResult.error?.message ?? "Igreja A não criada");
    }
    churchA = churchAResult.data;

    const churchBResult = await coordB.rpc("create_church", {
      p_name: "Igreja Arranjos B",
      p_slug: `arr-b-${run}`,
    });
    if (churchBResult.error || !churchBResult.data) {
      throw new Error(churchBResult.error?.message ?? "Igreja B não criada");
    }
    churchB = churchBResult.data;

    const invite = await admin
      .from("churches")
      .select("invite_code")
      .eq("id", churchA)
      .single();
    if (invite.error || !invite.data) throw new Error(invite.error?.message);
    for (const client of [leaderA, memberA]) {
      const { error } = await client.rpc("join_church", {
        p_invite_code: invite.data.invite_code,
      });
      if (error) throw error;
    }

    const louvorA = await requiredId(
      coordA
        .from("ministries")
        .insert({ church_id: churchA, name: "Louvor", slug: "louvor" })
        .select("id")
        .single(),
    );
    const { error: leaderRoleError } = await admin.from("ministry_members").insert({
      church_id: churchA,
      ministry_id: louvorA,
      user_id: await userId(leaderA),
      role: "lider",
    });
    if (leaderRoleError) throw leaderRoleError;

    songA = await requiredId(
      leaderA
        .from("songs")
        .insert({ church_id: churchA, title: "Canção principal", default_key: "C" })
        .select("id")
        .single(),
    );
    otherSongA = await requiredId(
      leaderA
        .from("songs")
        .insert({ church_id: churchA, title: "Outra canção", default_key: "D" })
        .select("id")
        .single(),
    );
    songB = await requiredId(
      coordB
        .from("songs")
        .insert({ church_id: churchB, title: "Canção externa", default_key: "E" })
        .select("id")
        .single(),
    );

    arrangementA = await requiredId(
      leaderA
        .from("song_arrangements")
        .insert({
          church_id: churchA,
          song_id: songA,
          name: "Arranjo principal",
          created_by: await userId(leaderA),
        })
        .select("id")
        .single(),
    );
    otherArrangementA = await requiredId(
      leaderA
        .from("song_arrangements")
        .insert({ church_id: churchA, song_id: otherSongA, name: "Acústico" })
        .select("id")
        .single(),
    );
    sameSongArrangementA = await requiredId(
      leaderA
        .from("song_arrangements")
        .insert({ church_id: churchA, song_id: songA, name: "Versão reduzida" })
        .select("id")
        .single(),
    );
    arrangementB = await requiredId(
      coordB
        .from("song_arrangements")
        .insert({ church_id: churchB, song_id: songB, name: "Arranjo B" })
        .select("id")
        .single(),
    );

    versionA = await requiredId(
      leaderA
        .from("song_arrangement_versions")
        .insert({
          church_id: churchA,
          arrangement_id: arrangementA,
          version_number: 1,
          format: "PLAIN",
          content: "C G Am F",
          original_key: "C",
          bpm: 72,
          time_signature: "4/4",
          metadata: { origem: "teste" },
        })
        .select("id")
        .single(),
    );
    otherVersionA = await requiredId(
      leaderA
        .from("song_arrangement_versions")
        .insert({
          church_id: churchA,
          arrangement_id: otherArrangementA,
          version_number: 1,
          format: "CHORDPRO",
          content: "[D]Outra canção",
        })
        .select("id")
        .single(),
    );
    sameSongVersionA = await requiredId(
      leaderA
        .from("song_arrangement_versions")
        .insert({
          church_id: churchA,
          arrangement_id: sameSongArrangementA,
          version_number: 1,
          format: "PLAIN",
          content: "Am F C G",
        })
        .select("id")
        .single(),
    );
    versionB = await requiredId(
      coordB
        .from("song_arrangement_versions")
        .insert({
          church_id: churchB,
          arrangement_id: arrangementB,
          version_number: 1,
          format: "PLAIN",
          content: "E A B",
        })
        .select("id")
        .single(),
    );

    importA = await requiredId(
      leaderA
        .from("song_imports")
        .insert({
          church_id: churchA,
          source_kind: "PASTE",
          source_format: "PLAIN",
          raw_content: "C G Am F",
          parser_version: "1.0.0",
          status: "RECEIVED",
        })
        .select("id")
        .single(),
    );
    importB = await requiredId(
      coordB
        .from("song_imports")
        .insert({
          church_id: churchB,
          source_kind: "FILE",
          source_format: "CHORDPRO",
          storage_object_path: `${churchB}/imports/cancao.pro`,
          parser_version: "1.0.0",
          status: "PARSED",
        })
        .select("id")
        .single(),
    );

    eventA = await requiredId(
      coordA
        .from("events")
        .insert({
          church_id: churchA,
          title: "Culto com arranjo",
          starts_at: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .select("id")
        .single(),
    );
  });

  it("líder autorizado cria arranjo", async () => {
    const { data, error } = await leaderA
      .from("song_arrangements")
      .select("id, name, active")
      .eq("id", arrangementA)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ name: "Arranjo principal", active: true });
  });

  it("membro comum não cria arranjo", async () => {
    const { error } = await memberA.from("song_arrangements").insert({
      church_id: churchA,
      song_id: songA,
      name: "Arranjo do membro",
    });
    expect(error).not.toBeNull();
  });

  it("membro comum não atualiza arranjo", async () => {
    const { data, error } = await memberA
      .from("song_arrangements")
      .update({ name: "Alteração indevida" })
      .eq("id", arrangementA)
      .select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const persisted = await memberA
      .from("song_arrangements")
      .select("name")
      .eq("id", arrangementA)
      .single();
    expect(persisted.error).toBeNull();
    expect(persisted.data?.name).toBe("Arranjo principal");
  });

  it("membro da igreja A lê arranjos da própria igreja", async () => {
    const { data, error } = await memberA
      .from("song_arrangements")
      .select("id")
      .eq("id", arrangementA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("igreja A não lê arranjo da igreja B", async () => {
    const { data, error } = await memberA
      .from("song_arrangements")
      .select("id")
      .eq("id", arrangementB);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("arranjo não aponta para música de outra igreja", async () => {
    const { error } = await leaderA.from("song_arrangements").insert({
      church_id: churchA,
      song_id: songB,
      name: "Referência cruzada",
    });
    expect(error).not.toBeNull();
  });

  it("nome duplicado case-insensitive por música é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangements").insert({
      church_id: churchA,
      song_id: songA,
      name: "ARRANJO PRINCIPAL",
    });
    expect(error).not.toBeNull();
  });

  it("nome vazio ou sem btrim é rejeitado", async () => {
    const empty = await leaderA.from("song_arrangements").insert({
      church_id: churchA,
      song_id: songA,
      name: "",
    });
    const padded = await leaderA.from("song_arrangements").insert({
      church_id: churchA,
      song_id: songA,
      name: " Com espaços ",
    });
    expect(empty.error).not.toBeNull();
    expect(padded.error).not.toBeNull();
  });

  it("líder cria versão válida", async () => {
    const { data, error } = await leaderA
      .from("song_arrangement_versions")
      .select("id, version_number, format")
      .eq("id", versionA)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ version_number: 1, format: "PLAIN" });
  });

  it("version_number duplicado no mesmo arranjo é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 1,
      format: "PLAIN",
      content: "Nova tentativa",
    });
    expect(error).not.toBeNull();
  });

  it("versão não pode ser atualizada pela aplicação", async () => {
    const { error } = await leaderA
      .from("song_arrangement_versions")
      .update({ content: "Conteúdo adulterado" })
      .eq("id", versionA);
    const persisted = await leaderA
      .from("song_arrangement_versions")
      .select("content")
      .eq("id", versionA)
      .single();
    expect(error).not.toBeNull();
    expect(persisted.data?.content).toBe("C G Am F");
  });

  it("versão não pode ser apagada pela aplicação", async () => {
    const { error } = await leaderA
      .from("song_arrangement_versions")
      .delete()
      .eq("id", versionA);
    const persisted = await leaderA
      .from("song_arrangement_versions")
      .select("id")
      .eq("id", versionA);
    expect(error).not.toBeNull();
    expect(persisted.data).toHaveLength(1);
  });

  it("membro comum não cria versão", async () => {
    const { error } = await memberA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "Cifra do membro",
    });
    expect(error).not.toBeNull();
  });

  it("membro da igreja A lê versão da própria igreja", async () => {
    const { data, error } = await memberA
      .from("song_arrangement_versions")
      .select("id")
      .eq("id", versionA);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("igreja A não lê versão da igreja B", async () => {
    const { data, error } = await memberA
      .from("song_arrangement_versions")
      .select("id")
      .eq("id", versionB);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("versão de arranjo de outra igreja é rejeitada", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementB,
      version_number: 2,
      format: "PLAIN",
      content: "E A B",
    });
    expect(error).not.toBeNull();
  });

  it("formato inválido de versão é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "HTML",
      content: "C G",
    });
    expect(error).not.toBeNull();
  });

  it("conteúdo vazio de versão é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "   ",
    });
    expect(error).not.toBeNull();
  });

  it("conteúdo acima de 20.000 caracteres é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "C".repeat(20_001),
    });
    expect(error).not.toBeNull();
  });

  it("BPM inválido é rejeitado", async () => {
    const below = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "C G",
      bpm: 19,
    });
    const above = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "C G",
      bpm: 301,
    });
    expect(below.error).not.toBeNull();
    expect(above.error).not.toBeNull();
  });

  it("metadata que não seja objeto é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "C G",
      metadata: ["inválido"],
    });
    expect(error).not.toBeNull();
  });

  it("compasso inválido é rejeitado", async () => {
    const { error } = await leaderA.from("song_arrangement_versions").insert({
      church_id: churchA,
      arrangement_id: arrangementA,
      version_number: 2,
      format: "PLAIN",
      content: "C G",
      time_signature: "4/3",
    });
    expect(error).not.toBeNull();
  });

  it("a versão atual é obtida pelo maior version_number", async () => {
    const version2 = await leaderA
      .from("song_arrangement_versions")
      .insert({
        church_id: churchA,
        arrangement_id: arrangementA,
        version_number: 2,
        format: "PLAIN",
        content: "D A Bm G",
      })
      .select("id")
      .single();
    expect(version2.error).toBeNull();

    const latest = await memberA
      .from("song_arrangement_versions")
      .select("id, version_number")
      .eq("arrangement_id", arrangementA)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();
    expect(latest.error).toBeNull();
    expect(latest.data?.version_number).toBe(2);
  });

  it("gestor cria import", async () => {
    const { data, error } = await leaderA
      .from("song_imports")
      .select("id, status")
      .eq("id", importA)
      .single();
    expect(error).toBeNull();
    expect(data?.status).toBe("RECEIVED");
  });

  it("membro comum não lê import", async () => {
    const { data, error } = await memberA.from("song_imports").select("id").eq("id", importA);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("membro comum não cria import", async () => {
    const { error } = await memberA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "C G",
      parser_version: "1.0.0",
      status: "RECEIVED",
    });
    expect(error).not.toBeNull();
  });

  it("igreja A não lê import da igreja B", async () => {
    const { data, error } = await leaderA.from("song_imports").select("id").eq("id", importB);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("import sem conteúdo bruto nem storage é rejeitado", async () => {
    const { error } = await leaderA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      parser_version: "1.0.0",
      status: "RECEIVED",
    });
    expect(error).not.toBeNull();
  });

  it("warnings que não sejam array são rejeitados", async () => {
    const { error } = await leaderA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "C G",
      parser_version: "1.0.0",
      warnings: { mensagem: "inválido" },
      status: "RECEIVED",
    });
    expect(error).not.toBeNull();
  });

  it("raw_sha256 inválido é rejeitado", async () => {
    const { error } = await leaderA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "C G",
      raw_sha256: "nao-e-sha256",
      parser_version: "1.0.0",
      status: "RECEIVED",
    });
    expect(error).not.toBeNull();
  });

  it("CONFIRMED exige música, arranjo e versão coerentes", async () => {
    const missing = await leaderA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "C G",
      parser_version: "1.0.0",
      status: "CONFIRMED",
    });
    const mixed = await leaderA.from("song_imports").insert({
      church_id: churchA,
      song_id: songA,
      arrangement_id: arrangementA,
      resulting_version_id: otherVersionA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "C G",
      parser_version: "1.0.0",
      status: "CONFIRMED",
    });
    expect(missing.error).not.toBeNull();
    expect(mixed.error).not.toBeNull();
  });

  it("FAILED exige mensagem e outros status não aceitam erro", async () => {
    const failed = await leaderA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "FILE",
      source_format: "PLAIN",
      raw_content: "inválido",
      parser_version: "1.0.0",
      status: "FAILED",
    });
    const received = await leaderA.from("song_imports").insert({
      church_id: churchA,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "C G",
      parser_version: "1.0.0",
      status: "RECEIVED",
      error_message: "erro indevido",
    });
    expect(failed.error).not.toBeNull();
    expect(received.error).not.toBeNull();
  });

  it("referências de import não atravessam igreja", async () => {
    const { error } = await leaderA.from("song_imports").insert({
      church_id: churchA,
      song_id: songB,
      arrangement_id: arrangementB,
      resulting_version_id: versionB,
      source_kind: "PASTE",
      source_format: "PLAIN",
      raw_content: "E A B",
      parser_version: "1.0.0",
      status: "CONFIRMED",
    });
    expect(error).not.toBeNull();
  });

  it("gestor confirma import com referências da mesma música e igreja", async () => {
    const { data, error } = await leaderA
      .from("song_imports")
      .update({
        song_id: songA,
        arrangement_id: arrangementA,
        resulting_version_id: versionA,
        status: "CONFIRMED",
      })
      .eq("id", importA)
      .select("status, resulting_version_id")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ status: "CONFIRMED", resulting_version_id: versionA });
  });

  it("arranjo padrão válido pertence à própria música", async () => {
    const { data, error } = await leaderA
      .from("songs")
      .update({ default_arrangement_id: arrangementA })
      .eq("id", songA)
      .select("default_arrangement_id")
      .single();
    expect(error).toBeNull();
    expect(data?.default_arrangement_id).toBe(arrangementA);
  });

  it("arranjo padrão de outra música é rejeitado", async () => {
    const { error } = await leaderA
      .from("songs")
      .update({ default_arrangement_id: otherArrangementA })
      .eq("id", songA);
    expect(error).not.toBeNull();
  });

  it("arranjo padrão de outra igreja é rejeitado", async () => {
    const { error } = await leaderA
      .from("songs")
      .update({ default_arrangement_id: arrangementB })
      .eq("id", songA);
    expect(error).not.toBeNull();
  });

  it("setlist aceita arranjo e versão válidos", async () => {
    const result = await leaderA
      .from("setlist_items")
      .insert({
        church_id: churchA,
        event_id: eventA,
        song_id: songA,
        position: 1,
        arrangement_id: arrangementA,
        arrangement_version_id: versionA,
      })
      .select("id")
      .single();
    expect(result.error).toBeNull();
    setlistItemA = result.data!.id;
  });

  it("setlist rejeita arranjo sem versão", async () => {
    const { error } = await leaderA.from("setlist_items").insert({
      church_id: churchA,
      event_id: eventA,
      song_id: otherSongA,
      position: 2,
      arrangement_id: otherArrangementA,
    });
    expect(error).not.toBeNull();
  });

  it("setlist rejeita arranjo de outra música", async () => {
    const { error } = await leaderA.from("setlist_items").insert({
      church_id: churchA,
      event_id: eventA,
      song_id: otherSongA,
      position: 2,
      arrangement_id: arrangementA,
      arrangement_version_id: versionA,
    });
    expect(error).not.toBeNull();
  });

  it("setlist rejeita versão de outro arranjo", async () => {
    const { error } = await leaderA.from("setlist_items").insert({
      church_id: churchA,
      event_id: eventA,
      song_id: otherSongA,
      position: 2,
      arrangement_id: otherArrangementA,
      arrangement_version_id: sameSongVersionA,
    });
    expect(error).not.toBeNull();
  });

  it("setlist rejeita versão e arranjo de outra igreja", async () => {
    const { error } = await leaderA.from("setlist_items").insert({
      church_id: churchA,
      event_id: eventA,
      song_id: otherSongA,
      position: 2,
      arrangement_id: arrangementB,
      arrangement_version_id: versionB,
    });
    expect(error).not.toBeNull();
  });

  it("dados antigos com referências nulas continuam válidos", async () => {
    const { data, error } = await leaderA
      .from("setlist_items")
      .insert({
        church_id: churchA,
        event_id: eventA,
        song_id: otherSongA,
        position: 2,
      })
      .select("arrangement_id, arrangement_version_id")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ arrangement_id: null, arrangement_version_id: null });
  });

  it("versão usada em setlist não pode ser apagada nem pelo service role", async () => {
    const { error } = await admin
      .from("song_arrangement_versions")
      .delete()
      .eq("id", versionA);
    expect(error).not.toBeNull();
  });

  it("arranjo usado em setlist não pode ser apagado nem pelo service role", async () => {
    const { error } = await admin.from("song_arrangements").delete().eq("id", arrangementA);
    expect(error).not.toBeNull();
  });

  it("arquivar música preserva arranjos, versões e item histórico", async () => {
    const archived = await leaderA
      .from("songs")
      .update({ active: false })
      .eq("id", songA)
      .select("active")
      .single();
    const arrangements = await leaderA
      .from("song_arrangements")
      .select("id")
      .eq("id", arrangementA);
    const versions = await leaderA
      .from("song_arrangement_versions")
      .select("id")
      .eq("id", versionA);
    const setlist = await leaderA.from("setlist_items").select("id").eq("id", setlistItemA);
    expect(archived.error).toBeNull();
    expect(archived.data?.active).toBe(false);
    expect(arrangements.data).toHaveLength(1);
    expect(versions.data).toHaveLength(1);
    expect(setlist.data).toHaveLength(1);
  });

  it("excluir igreja remove arranjos, versões e imports do tenant", async () => {
    const churchC = await requiredId(
      admin
        .from("churches")
        .insert({ name: "Igreja temporária", slug: `arr-c-${run}` })
        .select("id")
        .single(),
    );
    const songC = await requiredId(
      admin
        .from("songs")
        .insert({ church_id: churchC, title: "Canção temporária" })
        .select("id")
        .single(),
    );
    const arrangementC = await requiredId(
      admin
        .from("song_arrangements")
        .insert({ church_id: churchC, song_id: songC, name: "Temporário" })
        .select("id")
        .single(),
    );
    const versionC = await requiredId(
      admin
        .from("song_arrangement_versions")
        .insert({
          church_id: churchC,
          arrangement_id: arrangementC,
          version_number: 1,
          format: "PLAIN",
          content: "C F G",
        })
        .select("id")
        .single(),
    );
    const importC = await requiredId(
      admin
        .from("song_imports")
        .insert({
          church_id: churchC,
          song_id: songC,
          arrangement_id: arrangementC,
          resulting_version_id: versionC,
          source_kind: "PASTE",
          source_format: "PLAIN",
          raw_content: "C F G",
          parser_version: "1.0.0",
          status: "CONFIRMED",
        })
        .select("id")
        .single(),
    );

    const deleted = await admin.from("churches").delete().eq("id", churchC);
    const arrangements = await admin.from("song_arrangements").select("id").eq("id", arrangementC);
    const versions = await admin.from("song_arrangement_versions").select("id").eq("id", versionC);
    const imports = await admin.from("song_imports").select("id").eq("id", importC);
    expect(deleted.error).toBeNull();
    expect(arrangements.data).toHaveLength(0);
    expect(versions.data).toHaveLength(0);
    expect(imports.data).toHaveLength(0);
  });

  it("policies anteriores de songs e setlist_items continuam ativas", async () => {
    const visibleSong = await memberA.from("songs").select("id").eq("id", songA);
    const deniedSong = await memberA.from("songs").insert({
      church_id: churchA,
      title: "Cadastro indevido",
    });
    const hiddenDraftSetlist = await memberA
      .from("setlist_items")
      .select("id")
      .eq("event_id", eventA);
    const deniedSetlist = await memberA.from("setlist_items").insert({
      church_id: churchA,
      event_id: eventA,
      song_id: songA,
      position: 99,
    });
    expect(visibleSong.data).toHaveLength(1);
    expect(deniedSong.error).not.toBeNull();
    expect(hiddenDraftSetlist.data).toHaveLength(0);
    expect(deniedSetlist.error).not.toBeNull();
  });
});
