"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const classItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Informe o nome da turma").max(50),
  minAgeYears: z.number().int().min(0).max(18),
  maxAgeYears: z.number().int().min(0).max(18),
});

const campusContextSchema = z.object({
  churchSlug: z.string().min(2),
  ministryId: z.string().uuid(),
  campusId: z.string().uuid(),
});

const saveSchema = campusContextSchema.extend({
  classes: z.array(classItemSchema).min(1).max(20),
});

const createSchema = campusContextSchema.extend({
  name: z.string().trim().min(1, "Informe o nome da turma").max(50),
  minAgeYears: z.number().int().min(0).max(18),
  maxAgeYears: z.number().int().min(0).max(18),
});

const deleteSchema = campusContextSchema.extend({
  classId: z.string().uuid(),
});

type ManagedContext = {
  tenant: Awaited<ReturnType<typeof getTenant>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
};

async function requireKidsManager(
  churchSlug: string,
  ministryId: string,
  campusId: string
): Promise<ManagedContext | ActionResult> {
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids || kids.id !== ministryId) {
    return { ok: false, error: "Ministério Kids inválido" };
  }

  const supabase = await createClient();
  let canManage = tenant.isCoord;
  if (!canManage) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministryId)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();
    canManage = membership?.role === "gerente" || membership?.role === "lider";
  }

  if (!canManage) return { ok: false, error: "Sem permissão para alterar as turmas" };

  const { data: campus } = await supabase
    .from("campuses")
    .select("id")
    .eq("id", campusId)
    .eq("church_id", tenant.church.id)
    .eq("active", true)
    .maybeSingle();
  if (!campus) return { ok: false, error: "Campus inválido ou inativo" };

  return { tenant, supabase };
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin <= bMax && bMin <= aMax;
}

function validateRanges(
  classes: Array<{ name: string; minAgeYears: number; maxAgeYears: number }>
): string | null {
  for (const item of classes) {
    if (item.minAgeYears > item.maxAgeYears) {
      return `Na turma ${item.name}, a idade mínima não pode ser maior que a máxima`;
    }
  }

  const ordered = [...classes].sort((a, b) => a.minAgeYears - b.minAgeYears);
  for (let i = 1; i < ordered.length; i++) {
    if (
      rangesOverlap(
        ordered[i - 1].minAgeYears,
        ordered[i - 1].maxAgeYears,
        ordered[i].minAgeYears,
        ordered[i].maxAgeYears
      )
    ) {
      return `As faixas de ${ordered[i - 1].name} e ${ordered[i].name} estão sobrepostas`;
    }
  }
  return null;
}

async function reorderClasses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ministryId: string,
  campusId: string
) {
  const { data } = await supabase
    .from("child_classes")
    .select("id")
    .eq("ministry_id", ministryId)
    .eq("campus_id", campusId)
    .order("min_age_months")
    .order("name");

  for (const [index, item] of (data ?? []).entries()) {
    await supabase
      .from("child_classes")
      .update({ sort_order: index + 1 })
      .eq("id", item.id)
      .eq("ministry_id", ministryId)
      .eq("campus_id", campusId);
  }
}

function revalidateKids(churchSlug: string) {
  revalidatePath(`/${churchSlug}/infantil`);
  revalidatePath(`/${churchSlug}/infantil/configuracoes`);
}

export async function saveKidsClasses(raw: unknown): Promise<ActionResult> {
  const parsed = saveSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;
  const ctx = await requireKidsManager(d.churchSlug, d.ministryId, d.campusId);
  if ("ok" in ctx) return ctx;

  const normalized = d.classes.map((item) => ({ ...item, name: item.name.trim() }));
  const uniqueNames = new Set(normalized.map((item) => item.name.toLocaleLowerCase("pt-BR")));
  if (uniqueNames.size !== normalized.length) {
    return { ok: false, error: "Use nomes diferentes para cada turma" };
  }
  const rangeError = validateRanges(normalized);
  if (rangeError) return { ok: false, error: rangeError };

  const ids = normalized.map((item) => item.id);
  const { data: existing, error: loadError } = await ctx.supabase
    .from("child_classes")
    .select("id")
    .eq("ministry_id", d.ministryId)
    .eq("campus_id", d.campusId)
    .in("id", ids);
  if (loadError || (existing ?? []).length !== ids.length) {
    return { ok: false, error: "Não foi possível validar as turmas deste campus" };
  }

  for (const item of normalized) {
    const { error } = await ctx.supabase
      .from("child_classes")
      .update({
        name: item.name,
        min_age_months: item.minAgeYears * 12,
        max_age_months: item.maxAgeYears * 12 + 11,
      })
      .eq("id", item.id)
      .eq("ministry_id", d.ministryId)
      .eq("campus_id", d.campusId);
    if (error) return { ok: false, error: "Não foi possível salvar as turmas" };
  }

  await reorderClasses(ctx.supabase, d.ministryId, d.campusId);
  revalidateKids(d.churchSlug);
  return { ok: true, data: undefined };
}

export type CreatedKidsClass = {
  id: string;
  name: string;
  minAgeMonths: number;
  maxAgeMonths: number;
};

export async function createKidsClass(raw: unknown): Promise<ActionResult<CreatedKidsClass>> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;
  if (d.minAgeYears > d.maxAgeYears) {
    return { ok: false, error: "A idade mínima não pode ser maior que a máxima" };
  }

  const ctx = await requireKidsManager(d.churchSlug, d.ministryId, d.campusId);
  if ("ok" in ctx) return ctx as ActionResult<CreatedKidsClass>;

  const { data: current, error: currentError } = await ctx.supabase
    .from("child_classes")
    .select("name, min_age_months, max_age_months")
    .eq("ministry_id", d.ministryId)
    .eq("campus_id", d.campusId);
  if (currentError) return { ok: false, error: "Não foi possível validar as turmas atuais" };
  if ((current ?? []).length >= 20) return { ok: false, error: "O limite é de 20 turmas por campus" };

  const normalizedName = d.name.trim();
  if (
    (current ?? []).some(
      (item) => item.name.toLocaleLowerCase("pt-BR") === normalizedName.toLocaleLowerCase("pt-BR")
    )
  ) {
    return { ok: false, error: "Já existe uma turma com esse nome neste campus" };
  }

  const minMonths = d.minAgeYears * 12;
  const maxMonths = d.maxAgeYears * 12 + 11;
  const overlap = (current ?? []).find((item) =>
    rangesOverlap(minMonths, maxMonths, item.min_age_months, item.max_age_months)
  );
  if (overlap) {
    return { ok: false, error: `A faixa etária se sobrepõe à turma ${overlap.name}` };
  }

  const { data: created, error } = await ctx.supabase
    .from("child_classes")
    .insert({
      church_id: ctx.tenant.church.id,
      ministry_id: d.ministryId,
      campus_id: d.campusId,
      name: normalizedName,
      min_age_months: minMonths,
      max_age_months: maxMonths,
      sort_order: (current ?? []).length + 1,
    })
    .select("id, name, min_age_months, max_age_months")
    .single();
  if (error || !created) return { ok: false, error: "Não foi possível adicionar a turma" };

  await reorderClasses(ctx.supabase, d.ministryId, d.campusId);
  revalidateKids(d.churchSlug);
  return {
    ok: true,
    data: {
      id: created.id,
      name: created.name,
      minAgeMonths: created.min_age_months,
      maxAgeMonths: created.max_age_months,
    },
  };
}

export async function deleteKidsClass(raw: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = deleteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const ctx = await requireKidsManager(d.churchSlug, d.ministryId, d.campusId);
  if ("ok" in ctx) return ctx as ActionResult<{ id: string }>;

  const { data: classRow } = await ctx.supabase
    .from("child_classes")
    .select("id, name")
    .eq("id", d.classId)
    .eq("ministry_id", d.ministryId)
    .eq("campus_id", d.campusId)
    .maybeSingle();
  if (!classRow) return { ok: false, error: "Turma não encontrada neste campus" };

  const { count: checkins } = await ctx.supabase
    .from("child_checkins")
    .select("id", { count: "exact", head: true })
    .eq("class_id", d.classId);
  if ((checkins ?? 0) > 0) {
    return {
      ok: false,
      error: `A turma ${classRow.name} já possui histórico de check-in e não pode ser removida. Renomeie a turma se ela não for mais usada.`,
    };
  }

  const { error } = await ctx.supabase
    .from("child_classes")
    .delete()
    .eq("id", d.classId)
    .eq("ministry_id", d.ministryId)
    .eq("campus_id", d.campusId);
  if (error) return { ok: false, error: "Não foi possível remover a turma" };

  await reorderClasses(ctx.supabase, d.ministryId, d.campusId);
  revalidateKids(d.churchSlug);
  return { ok: true, data: { id: d.classId } };
}
