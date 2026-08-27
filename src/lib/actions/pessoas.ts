"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "./types";

const skillActionSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  userId: z.string().uuid(),
  skillId: z.string().uuid(),
  source: z.enum(["experience", "training", "both"]).default("experience"),
});

export async function approveSkill(raw: unknown): Promise<ActionResult> {
  const parsed = skillActionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, churchId, userId, skillId, source } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data, error } = await supabase
    .from("member_skills")
    .upsert(
      {
        skill_id: skillId,
        church_id: churchId,
        user_id: userId,
        source,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      },
      { onConflict: "skill_id,user_id" }
    )
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para aprovar aptidões" };
  }
  revalidatePath(`/${churchSlug}/pessoas/${userId}`);
  return { ok: true, data: undefined };
}

export async function removeSkill(raw: unknown): Promise<ActionResult> {
  const parsed = skillActionSchema
    .omit({ source: true })
    .safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, userId, skillId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("member_skills")
    .delete()
    .eq("skill_id", skillId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Sem permissão para remover" };
  revalidatePath(`/${churchSlug}/pessoas/${userId}`);
  return { ok: true, data: undefined };
}

const ministrySchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  name: z.string().min(2, "Informe o nome").max(60),
});

export async function createMinistry(raw: unknown): Promise<ActionResult> {
  const parsed = ministrySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { churchSlug, churchId, name } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ministries").insert({
    church_id: churchId,
    name,
    slug: slugify(name),
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Já existe uma equipe com esse nome"
          : "Sem permissão para criar equipes",
    };
  }
  revalidatePath(`/${churchSlug}/admin`);
  revalidatePath(`/${churchSlug}`, "layout");
  return { ok: true, data: undefined };
}

const churchRoleSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["admin", "coordenador", "member"]),
});

export async function setChurchRole(raw: unknown): Promise<ActionResult> {
  const parsed = churchRoleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, churchId, userId, role } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };
  if (user.id === userId) {
    return {
      ok: false,
      error: "Você não pode alterar o seu próprio papel de administrador",
    };
  }

  const { data, error } = await supabase
    .from("church_members")
    .update({ role })
    .eq("church_id", churchId)
    .eq("user_id", userId)
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para alterar administradores" };
  }
  revalidatePath(`/${churchSlug}/pessoas/${userId}`);
  return { ok: true, data: undefined };
}

const membershipSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["gerente", "lider", "instrutor", "voluntario"]),
});

export async function setMinistryRole(raw: unknown): Promise<ActionResult> {
  const parsed = membershipSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, churchId, ministryId, userId, role } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ministry_members")
    .upsert(
      { ministry_id: ministryId, church_id: churchId, user_id: userId, role, active: true },
      { onConflict: "ministry_id,user_id" }
    )
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Sem permissão para gerenciar a equipe" };
  }
  revalidatePath(`/${churchSlug}/pessoas/${userId}`);
  return { ok: true, data: undefined };
}

export async function removeFromMinistry(raw: unknown): Promise<ActionResult> {
  const parsed = membershipSchema.omit({ role: true }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const { churchSlug, ministryId, userId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ministry_members")
    .delete()
    .eq("ministry_id", ministryId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "Sem permissão para remover" };
  revalidatePath(`/${churchSlug}/pessoas/${userId}`);
  return { ok: true, data: undefined };
}
