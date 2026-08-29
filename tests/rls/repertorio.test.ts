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
  const c = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await c.auth.signInWithPassword({ email, password: "senha-teste-123" });
  return c;
}
const uid = async (c: SupabaseClient) => (await c.auth.getUser()).data.user!.id;

// O repertório atravessa a parede de setor de propósito: a mídia lê o que o
// louvor escreveu porque TRABALHA naquele culto. Estes testes provam que a
// travessia é essa e só essa.
describe("Repertório de louvor — quem lê a sequência (migration 27)", () => {
  let coord: SupabaseClient; // admin da igreja
  let louvorLider: SupabaseClient; // monta o repertório
  let louvorVol: SupabaseClient; // músico escalado
  let midiaVol: SupabaseClient; // OUTRO setor, mas escalado no mesmo culto
  let deFora: SupabaseClient; // membro da igreja, não escalado
  let churchId: string;
  let louvorId: string;
  let midiaId: string;
  let eventId: string;
  let songId: string;
  const run = Date.now();

  beforeAll(async () => {
    coord = await newUser(`rep-coord-${run}@teste.dev`);
    louvorLider = await newUser(`rep-lider-${run}@teste.dev`);
    louvorVol = await newUser(`rep-musico-${run}@teste.dev`);
    midiaVol = await newUser(`rep-midia-${run}@teste.dev`);
    deFora = await newUser(`rep-fora-${run}@teste.dev`);

    churchId = (
      await coord.rpc("create_church", { p_name: "Igreja Louvor", p_slug: `rep-${run}` })
    ).data;
    midiaId = (
      await admin.from("ministries").select("id").eq("church_id", churchId).eq("slug", "midia").single()
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
    for (const c of [louvorLider, louvorVol, midiaVol, deFora]) {
      await c.rpc("join_church", { p_invite_code: invite });
    }
    await admin.from("ministry_members").insert([
      { ministry_id: louvorId, church_id: churchId, user_id: await uid(louvorLider), role: "lider" },
      { ministry_id: louvorId, church_id: churchId, user_id: await uid(louvorVol), role: "voluntario" },
      { ministry_id: midiaId, church_id: churchId, user_id: await uid(midiaVol), role: "voluntario" },
    ]);

    eventId = (
      await coord
        .from("events")
        .insert({
          church_id: churchId,
          title: "Culto de domingo",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
        })
        .select("id")
        .single()
    ).data!.id;

    // o músico e a mídia trabalham no mesmo culto; deFora não
    await admin.from("assignments").insert([
      {
        church_id: churchId, event_id: eventId, user_id: await uid(louvorVol),
        ministry_id: louvorId, role_name: "Vocal",
      },
      {
        church_id: churchId, event_id: eventId, user_id: await uid(midiaVol),
        ministry_id: midiaId, role_name: "Projeção",
      },
    ]);

    songId = (
      await louvorLider
        .from("songs")
        .insert({
          church_id: churchId,
          title: "Bondade de Deus",
          artist: "Isaias Saad",
          default_key: "G",
          bpm: 72,
          lyrics: "Eu te amo, Deus",
        })
        .select("id")
        .single()
    ).data!.id;

    await louvorLider.from("setlist_items").insert({
      church_id: churchId, event_id: eventId, song_id: songId, position: 1, key_override: "D",
    });
  });

  it("o líder do louvor monta a sequência", async () => {
    const { data } = await louvorLider.from("setlist_items").select("id, position").eq("event_id", eventId);
    expect(data).toHaveLength(1);
  });

  // O ponto do rascunho: o líder arrasta músicas na quinta sem avisar ninguém.
  it("em rascunho, a mídia NÃO vê a sequência mesmo escalada", async () => {
    const { data } = await midiaVol.from("setlist_items").select("id").eq("event_id", eventId);
    expect(data).toHaveLength(0);
  });

  it("em rascunho, o próprio músico do louvor ainda não vê", async () => {
    const { data } = await louvorVol.from("setlist_items").select("id").eq("event_id", eventId);
    expect(data).toHaveLength(0);
  });

  it("publicado: a mídia lê a sequência (é o pedido central)", async () => {
    await louvorLider
      .from("events")
      .update({ setlist_status: "publicado", setlist_published_at: new Date().toISOString() })
      .eq("id", eventId);
    const { data } = await midiaVol.from("setlist_items").select("id, position, key_override").eq("event_id", eventId);
    expect(data).toHaveLength(1);
    expect(data![0].key_override).toBe("D");
  });

  it("publicado: o músico escalado lê", async () => {
    const { data } = await louvorVol.from("setlist_items").select("id").eq("event_id", eventId);
    expect(data).toHaveLength(1);
  });

  // A travessia é por ESCALA, não por ser membro da igreja.
  it("membro não escalado no culto NÃO lê a sequência, nem publicada", async () => {
    const { data } = await deFora.from("setlist_items").select("id").eq("event_id", eventId);
    expect(data).toHaveLength(0);
  });

  it("membro fora do Louvor e não escalado não lê o acervo", async () => {
    const { data, error } = await deFora.from("songs").select("id, title, lyrics").eq("id", songId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("quem não é do louvor não cadastra música no acervo", async () => {
    const { error } = await midiaVol
      .from("songs")
      .insert({ church_id: churchId, title: "Música intrusa" });
    expect(error).not.toBeNull();
  });

  it("a mídia não altera a sequência que o louvor definiu", async () => {
    const { error } = await midiaVol
      .from("setlist_items")
      .update({ position: 9 })
      .eq("event_id", eventId);
    const { data } = await louvorLider.from("setlist_items").select("position").eq("event_id", eventId);
    expect(error !== null || data![0].position === 1).toBe(true);
  });

  it("músico do louvor (voluntário) não monta a sequência sozinho", async () => {
    const { error } = await louvorVol
      .from("setlist_items")
      .insert({ church_id: churchId, event_id: eventId, song_id: songId, position: 2 });
    expect(error).not.toBeNull();
  });

  // A unique (event_id, song_id) não protege contra apontar para outra igreja.
  it("não dá para pendurar música de outra igreja no culto", async () => {
    const outraIgreja = (
      await deFora.rpc("create_church", { p_name: "Outra Igreja", p_slug: `rep-out-${run}` })
    ).data;
    const musicaAlheia = (
      await admin
        .from("songs")
        .insert({ church_id: outraIgreja, title: "Música de outra igreja" })
        .select("id")
        .single()
    ).data!.id;
    const { error } = await louvorLider
      .from("setlist_items")
      .insert({ church_id: churchId, event_id: eventId, song_id: musicaAlheia, position: 3 });
    expect(error).not.toBeNull();
  });
});
