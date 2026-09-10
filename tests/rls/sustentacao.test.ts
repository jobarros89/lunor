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

describe("Sustentação — faturamento e freio de cadastro (migration 24)", () => {
  let plataforma: SupabaseClient; // super-admin
  let dono: SupabaseClient; // admin da igreja
  let outro: SupabaseClient; // admin de outra igreja
  let churchId: string;
  const run = Date.now();

  beforeAll(async () => {
    await admin.from("platform_admin_emails").insert({ email: `plat-${run}@teste.dev` });
    plataforma = await newUser(`plat-${run}@teste.dev`);
    dono = await newUser(`dono-${run}@teste.dev`);
    outro = await newUser(`outro-${run}@teste.dev`);

    churchId = (await dono.rpc("create_church", { p_name: "Igreja Pagante", p_slug: `pag-${run}` })).data;
    await outro.rpc("create_church", { p_name: "Outra", p_slug: `out-${run}` });
  });

  it("igreja nova nasce em trial com 30 dias", async () => {
    const { data } = await admin
      .from("churches")
      .select("billing_status, paid_until, created_by")
      .eq("id", churchId)
      .single();
    expect(data!.billing_status).toBe("trial");
    expect(data!.paid_until).not.toBeNull();
    expect(data!.created_by).not.toBeNull();
  });

  it("admin da igreja NÃO consegue se declarar isento", async () => {
    const { error } = await dono
      .from("churches")
      .update({ billing_status: "isenta" })
      .eq("id", churchId);
    expect(error).not.toBeNull();
    const { data } = await admin.from("churches").select("billing_status").eq("id", churchId).single();
    expect(data!.billing_status).toBe("trial"); // inalterado
  });

  it("admin da igreja NÃO estica o próprio vencimento", async () => {
    await dono.from("churches").update({ paid_until: "2099-12-31" }).eq("id", churchId);
    const { data } = await admin.from("churches").select("paid_until").eq("id", churchId).single();
    expect(data!.paid_until).not.toBe("2099-12-31");
  });

  it("admin ainda consegue editar o que é dele (nome da igreja)", async () => {
    const { error } = await dono.from("churches").update({ name: "Igreja Renomeada" }).eq("id", churchId);
    expect(error).toBeNull();
  });

  it("plataforma confirma pagamento e isenta", async () => {
    const { error } = await plataforma
      .from("churches")
      .update({ billing_status: "ativa", paid_until: "2030-01-01" })
      .eq("id", churchId);
    expect(error).toBeNull();
    const { data } = await admin.from("churches").select("billing_status").eq("id", churchId).single();
    expect(data!.billing_status).toBe("ativa");
  });

  it("freio: a mesma conta não cria uma segunda igreja", async () => {
    const { error } = await dono.rpc("create_church", {
      p_name: "Segunda Igreja",
      p_slug: `pag2-${run}`,
    });
    expect(error).not.toBeNull();
    expect(String(error?.message)).toContain("church_limit_reached");
  });

  // Observabilidade: registrar precisa funcionar até deslogado (o erro pode
  // acontecer no login). Ler, não — mensagem de erro revela detalhe interno.
  it("erro é registrável por qualquer um, mas só a plataforma lê", async () => {
    const anon = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const ins = await anon.from("error_logs").insert({
      message: `falha de teste ${run}`,
      path: "/login",
    });
    expect(ins.error).toBeNull(); // deslogado consegue registrar

    // usuário comum não lê
    const comum = await dono.from("error_logs").select("id").limit(5);
    expect(comum.data ?? []).toEqual([]);

    // a plataforma lê
    const plat = await plataforma
      .from("error_logs")
      .select("id, message")
      .eq("message", `falha de teste ${run}`);
    expect((plat.data ?? []).length).toBe(1);
  });

  it("'já paguei': a igreja registra e só ela (e a plataforma) enxerga", async () => {
    const donoId = (await dono.auth.getUser()).data.user!.id;
    const ins = await dono.from("billing_claims").insert({
      church_id: churchId,
      claimed_by: donoId,
      note: "pix enviado hoje",
    });
    expect(ins.error).toBeNull();

    const meu = await dono.from("billing_claims").select("id").eq("church_id", churchId);
    expect((meu.data ?? []).length).toBe(1);

    // admin de OUTRA igreja não vê
    const alheio = await outro.from("billing_claims").select("id").eq("church_id", churchId);
    expect(alheio.data ?? []).toEqual([]);

    // a plataforma vê
    const plat = await plataforma.from("billing_claims").select("id").eq("church_id", churchId);
    expect((plat.data ?? []).length).toBe(1);
  });
});
