"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const childSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  fullName: z.string().min(2, "Informe o nome da criança").max(120),
  birthDate: z.string().min(10, "Informe a data de nascimento"),
  allergies: z.string().max(500).default(""),
  healthNotes: z.string().max(1000).default(""),
  specialNeeds: z.string().max(1000).default(""),
  emergencyName: z.string().max(120).default(""),
  emergencyPhone: z.string().max(30).default(""),
  photoConsent: z.boolean().default(false),
  // consentimento do responsável é obrigatório (LGPD art. 14)
  consent: z.literal(true, { message: "É preciso o consentimento do responsável" }),
  guardianName: z.string().min(2, "Informe o responsável").max(120),
  guardianPhone: z.string().max(30).default(""),
  guardianRelationship: z.string().max(40).default(""),
});

/**
 * Cadastra criança + responsável principal + autorização em uma única
 * transação no banco. Se qualquer etapa falhar, nada fica parcialmente salvo.
 */
export async function createChild(raw: unknown): Promise<ActionResult> {
  const parsed = childSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("create_child_with_primary_guardian", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_full_name: d.fullName,
    p_birth_date: d.birthDate,
    p_allergies: d.allergies || null,
    p_health_notes: d.healthNotes || null,
    p_special_needs: d.specialNeeds || null,
    p_emergency_name: d.emergencyName || null,
    p_emergency_phone: d.emergencyPhone || null,
    p_photo_consent: d.photoConsent,
    p_guardian_name: d.guardianName,
    p_guardian_phone: d.guardianPhone || null,
    p_guardian_relationship: d.guardianRelationship || null,
  });

  if (error) return { ok: false, error: "Sem permissão ou não foi possível cadastrar" };

  revalidatePath(`/${d.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}

const guardianSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  childId: z.string().uuid(),
  fullName: z.string().min(2, "Informe o nome").max(120),
  phone: z.string().max(30).default(""),
  relationship: z.string().max(40).default(""),
  canPickup: z.boolean().default(true),
});

/** Adiciona outro responsável à criança (autorizado ou não a retirar). */
export async function addGuardian(raw: unknown): Promise<ActionResult> {
  const parsed = guardianSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: g, error: gErr } = await supabase
    .from("guardians")
    .insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      full_name: d.fullName,
      phone: d.phone || null,
    })
    .select("id")
    .single();
  if (gErr || !g) return { ok: false, error: "Sem permissão para adicionar responsável" };

  const { error } = await supabase.from("child_guardians").insert({
    child_id: d.childId,
    guardian_id: g.id,
    church_id: d.churchId,
    relationship: d.relationship || null,
    can_pickup: d.canPickup,
    is_primary: false,
  });
  if (error) return { ok: false, error: "Não foi possível vincular o responsável" };

  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  return { ok: true, data: undefined };
}

const checkinSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  childId: z.string().uuid(),
  classId: z.string().uuid().nullable().default(null),
});

/** Check-in: registra a presença e gera o código de chamada da sessão. */
export async function checkInChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // código curto e único na sessão — tenta algumas vezes em caso de colisão
  for (let i = 0; i < 12; i++) {
    const code = String(Math.floor(100 + Math.random() * 900));
    const { error } = await supabase.from("child_checkins").insert({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      event_id: d.eventId,
      child_id: d.childId,
      class_id: d.classId,
      code,
      checked_in_by: user?.id ?? null,
    });
    if (!error) {
      revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
      return { ok: true, data: undefined };
    }
    if (error.code === "23505" && error.message.includes("child_id")) {
      return { ok: false, error: "Esta criança já fez check-in nesta sessão" };
    }
    if (error.code !== "23505") {
      return { ok: false, error: "Sem permissão para fazer check-in" };
    }
    // colisão de código: tenta outro
  }
  return { ok: false, error: "Não foi possível gerar um código livre" };
}

const checkoutSchema = z.object({
  churchSlug: z.string().min(2),
  eventId: z.string().uuid(),
  checkinId: z.string().uuid(),
  guardianId: z.string().uuid(),
  overrideReason: z.string().max(300).default(""),
});

/**
 * Retirada. O banco (guard_child_pickup) é quem decide: se o responsável não
 * está na lista de autorizados, exige justificativa E liderança.
 */
export async function checkOutChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("child_checkins")
    .update({
      picked_up_by: d.guardianId,
      checked_out_at: new Date().toISOString(),
      checked_out_by: user?.id ?? null,
      override_reason: d.overrideReason || null,
    })
    .eq("id", d.checkinId);

  if (error) {
    if (error.message.includes("pickup_not_authorized")) {
      return {
        ok: false,
        error: "Essa pessoa não está autorizada a retirar. Chame a liderança para liberar com justificativa.",
      };
    }
    if (error.message.includes("override_requires_leader")) {
      return { ok: false, error: "Só a liderança do setor pode liberar uma retirada excepcional." };
    }
    return { ok: false, error: "Não foi possível registrar a retirada" };
  }
  revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
  return { ok: true, data: undefined };
}

const pageSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  checkinId: z.string().uuid(),
  reason: z.string().max(200).default(""),
});

/**
 * Chama o responsável de UMA criança: registra a chamada (vira anúncio pelo
 * código) e manda Web Push a quem tem conta. O anúncio nunca cita a criança.
 */
export async function chamarResponsavel(raw: unknown): Promise<ActionResult> {
  const parsed = pageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: checkin } = await supabase
    .from("child_checkins")
    .select("code, child_id")
    .eq("id", d.checkinId)
    .single();
  if (!checkin) return { ok: false, error: "Presença não encontrada" };

  const { error } = await supabase.from("child_pages").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    event_id: d.eventId,
    checkin_id: d.checkinId,
    kind: "chamar",
    reason: d.reason || null,
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: "Não foi possível chamar" };

  // Push apenas para responsáveis vinculados a uma conta LUNOR.
  // O conteúdo de lock-screen usa somente o código operacional, sem PII da criança.
  const { data: vinculos } = await supabase
    .from("child_guardians")
    .select("guardians!inner(user_id)")
    .eq("child_id", checkin.child_id);
  const alvos = (vinculos ?? [])
    .map((v) => (v.guardians as unknown as { user_id: string | null }).user_id)
    .filter((id): id is string => !!id);
  await notifyUsers(alvos, {
    title: "Chamado do Kids 🔔",
    body: `Compareça ao Kids — código ${checkin.code}`,
    url: `/${d.churchSlug}`,
    tag: `infantil-${d.checkinId}`,
  });

  revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}`);
  return { ok: true, data: undefined };
}

const fimSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
});

/** Fim da escolinha: avisa os responsáveis de TODAS as crianças presentes. */
export async function encerrarSessao(raw: unknown): Promise<ActionResult> {
  const parsed = fimSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: presentes } = await supabase
    .from("child_checkins")
    .select("child_id")
    .eq("event_id", d.eventId)
    .is("checked_out_at", null);
  if (!presentes || presentes.length === 0) {
    return { ok: false, error: "Nenhuma criança presente nesta sessão" };
  }

  const { error } = await supabase.from("child_pages").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    event_id: d.eventId,
    checkin_id: null,
    kind: "fim_sessao",
    created_by: user?.id ?? null,
  });
  if (error) return { ok: false, error: "Não foi possível encerrar a sessão" };

  const { data: vinculos } = await supabase
    .from("child_guardians")
    .select("guardians!inner(user_id)")
    .in("child_id", presentes.map((p) => p.child_id));
  const alvos = (vinculos ?? [])
    .map((v) => (v.guardians as unknown as { user_id: string | null }).user_id)
    .filter((id): id is string => !!id);
  await notifyUsers(alvos, {
    title: "A escolinha terminou 🙌",
    body: "Os responsáveis já podem buscar as crianças no Infantil.",
    url: `/${d.churchSlug}`,
    tag: `infantil-fim-${d.eventId}`,
  });

  revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}`);
  return { ok: true, data: undefined };
}

/** Cria as turmas padrão por faixa etária. */
export async function seedClasses(
  churchSlug: string,
  ministryId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("seed_child_classes", { p_ministry: ministryId });
  if (error) return { ok: false, error: "Não foi possível criar as turmas" };
  revalidatePath(`/${churchSlug}/infantil`);
  return { ok: true, data: undefined };
}
