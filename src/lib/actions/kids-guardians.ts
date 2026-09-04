"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const baseSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  childId: z.string().uuid(),
});

const linkSchema = baseSchema.extend({
  guardianId: z.string().uuid().nullable().default(null),
  fullName: z.string().max(120).default(""),
  phone: z.string().max(30).default(""),
  relationship: z.string().max(40).default(""),
  canPickup: z.boolean().default(true),
});

const updateSchema = baseSchema.extend({
  guardianId: z.string().uuid(),
  relationship: z.string().max(40).default(""),
  canPickup: z.boolean(),
});

const guardianSchema = baseSchema.extend({
  guardianId: z.string().uuid(),
});

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

async function validateChildScope(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: z.infer<typeof baseSchema>
): Promise<boolean> {
  const { data } = await supabase
    .from("children")
    .select("id")
    .eq("id", input.childId)
    .eq("church_id", input.churchId)
    .eq("ministry_id", input.ministryId)
    .maybeSingle();
  return !!data;
}

export async function addChildGuardian(raw: unknown): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  if (!(await validateChildScope(supabase, d))) {
    return { ok: false, error: "Criança não encontrada ou sem permissão" };
  }

  let guardianId = d.guardianId;
  let createdGuardianId: string | null = null;

  if (guardianId) {
    const { data: guardian } = await supabase
      .from("guardians")
      .select("id")
      .eq("id", guardianId)
      .eq("church_id", d.churchId)
      .eq("ministry_id", d.ministryId)
      .maybeSingle();
    if (!guardian) return { ok: false, error: "Responsável não encontrado" };
  } else {
    const fullName = d.fullName.trim();
    if (fullName.length < 2) return { ok: false, error: "Informe o nome do responsável" };

    const normalizedPhone = normalizePhone(d.phone);
    if (normalizedPhone) {
      const { data: existingGuardians } = await supabase
        .from("guardians")
        .select("id, phone")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId);
      const samePhone = (existingGuardians ?? []).find(
        (item) => normalizePhone(item.phone) === normalizedPhone
      );
      if (samePhone) guardianId = samePhone.id;
    }

    if (!guardianId) {
      const { data: guardian, error } = await supabase
        .from("guardians")
        .insert({
          church_id: d.churchId,
          ministry_id: d.ministryId,
          full_name: fullName,
          phone: d.phone.trim() || null,
        })
        .select("id")
        .single();
      if (error || !guardian) {
        return { ok: false, error: "Não foi possível cadastrar o responsável" };
      }
      guardianId = guardian.id;
      createdGuardianId = guardian.id;
    }
  }

  const { data: existingLink } = await supabase
    .from("child_guardians")
    .select("guardian_id")
    .eq("child_id", d.childId)
    .eq("guardian_id", guardianId)
    .maybeSingle();
  if (existingLink) return { ok: false, error: "Esse responsável já está vinculado à criança" };

  const { data: currentLinks } = await supabase
    .from("child_guardians")
    .select("guardian_id, is_primary")
    .eq("child_id", d.childId)
    .eq("church_id", d.churchId);

  const makePrimary = !(currentLinks ?? []).some((item) => item.is_primary);
  const { error } = await supabase.from("child_guardians").insert({
    child_id: d.childId,
    guardian_id: guardianId,
    church_id: d.churchId,
    relationship: d.relationship.trim() || null,
    can_pickup: d.canPickup,
    is_primary: makePrimary,
  });
  if (error) {
    if (createdGuardianId) {
      await supabase.from("guardians").delete().eq("id", createdGuardianId);
    }
    return { ok: false, error: "Não foi possível vincular o responsável" };
  }

  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  revalidatePath(`/${d.churchSlug}/infantil/responsaveis`);
  return { ok: true, data: undefined };
}

export async function updateChildGuardian(raw: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  if (!(await validateChildScope(supabase, d))) {
    return { ok: false, error: "Criança não encontrada ou sem permissão" };
  }

  const { data: current } = await supabase
    .from("child_guardians")
    .select("can_pickup")
    .eq("child_id", d.childId)
    .eq("guardian_id", d.guardianId)
    .eq("church_id", d.churchId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Vínculo não encontrado" };

  if (current.can_pickup && !d.canPickup) {
    const { count } = await supabase
      .from("child_guardians")
      .select("guardian_id", { count: "exact", head: true })
      .eq("child_id", d.childId)
      .eq("church_id", d.churchId)
      .eq("can_pickup", true)
      .neq("guardian_id", d.guardianId);
    if ((count ?? 0) === 0) {
      return { ok: false, error: "Mantenha pelo menos um responsável autorizado para retirada" };
    }
  }

  const { error } = await supabase
    .from("child_guardians")
    .update({
      relationship: d.relationship.trim() || null,
      can_pickup: d.canPickup,
    })
    .eq("child_id", d.childId)
    .eq("guardian_id", d.guardianId)
    .eq("church_id", d.churchId);
  if (error) return { ok: false, error: "Não foi possível atualizar o responsável" };

  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  return { ok: true, data: undefined };
}

export async function setPrimaryChildGuardian(raw: unknown): Promise<ActionResult> {
  const parsed = guardianSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  if (!(await validateChildScope(supabase, d))) {
    return { ok: false, error: "Criança não encontrada ou sem permissão" };
  }

  const { data: target } = await supabase
    .from("child_guardians")
    .select("guardian_id")
    .eq("child_id", d.childId)
    .eq("guardian_id", d.guardianId)
    .eq("church_id", d.churchId)
    .maybeSingle();
  if (!target) return { ok: false, error: "Vínculo não encontrado" };

  const { error: targetError } = await supabase
    .from("child_guardians")
    .update({ is_primary: true })
    .eq("child_id", d.childId)
    .eq("guardian_id", d.guardianId)
    .eq("church_id", d.churchId);
  if (targetError) return { ok: false, error: "Não foi possível alterar o responsável principal" };

  const { error: clearError } = await supabase
    .from("child_guardians")
    .update({ is_primary: false })
    .eq("child_id", d.childId)
    .eq("church_id", d.churchId)
    .neq("guardian_id", d.guardianId);
  if (clearError) return { ok: false, error: "Responsável principal salvo, mas não foi possível limpar o vínculo anterior" };

  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  return { ok: true, data: undefined };
}

export async function removeChildGuardian(raw: unknown): Promise<ActionResult> {
  const parsed = guardianSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  if (!(await validateChildScope(supabase, d))) {
    return { ok: false, error: "Criança não encontrada ou sem permissão" };
  }

  const { data: links } = await supabase
    .from("child_guardians")
    .select("guardian_id, can_pickup, is_primary")
    .eq("child_id", d.childId)
    .eq("church_id", d.churchId)
    .order("created_at");

  const current = (links ?? []).find((item) => item.guardian_id === d.guardianId);
  if (!current) return { ok: false, error: "Vínculo não encontrado" };
  if ((links ?? []).length <= 1) {
    return { ok: false, error: "A criança precisa manter pelo menos um responsável vinculado" };
  }
  if (current.can_pickup && !(links ?? []).some((item) => item.guardian_id !== d.guardianId && item.can_pickup)) {
    return { ok: false, error: "Mantenha pelo menos um responsável autorizado para retirada" };
  }

  const remaining = (links ?? []).filter((item) => item.guardian_id !== d.guardianId);
  const nextPrimary = current.is_primary && remaining.length > 0
    ? (remaining.find((item) => item.can_pickup) ?? remaining[0])
    : null;

  if (nextPrimary) {
    const { error: promoteError } = await supabase
      .from("child_guardians")
      .update({ is_primary: true })
      .eq("child_id", d.childId)
      .eq("guardian_id", nextPrimary.guardian_id)
      .eq("church_id", d.churchId);
    if (promoteError) return { ok: false, error: "Não foi possível definir um novo responsável principal" };
  }

  const { error } = await supabase
    .from("child_guardians")
    .delete()
    .eq("child_id", d.childId)
    .eq("guardian_id", d.guardianId)
    .eq("church_id", d.churchId);
  if (error) {
    if (nextPrimary) {
      await supabase
        .from("child_guardians")
        .update({ is_primary: false })
        .eq("child_id", d.childId)
        .eq("guardian_id", nextPrimary.guardian_id)
        .eq("church_id", d.churchId);
    }
    return { ok: false, error: "Não foi possível remover o vínculo" };
  }

  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  revalidatePath(`/${d.churchSlug}/infantil/responsaveis`);
  return { ok: true, data: undefined };
}
