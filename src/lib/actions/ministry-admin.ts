"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/types";

const baseSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
});

const ministrySchema = baseSchema.extend({
  name: z.string().trim().min(2, "Informe o nome do ministério").max(60),
});

const ministryUpdateSchema = ministrySchema.extend({
  ministryId: z.string().uuid(),
});

const activeMinistrySchema = baseSchema.extend({
  ministryId: z.string().uuid(),
  active: z.boolean(),
});

const teamSchema = baseSchema.extend({
  ministryId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome do time").max(60),
});

const teamUpdateSchema = teamSchema.extend({
  teamId: z.string().uuid(),
});

const activeTeamSchema = baseSchema.extend({
  teamId: z.string().uuid(),
  active: z.boolean(),
});

const functionSchema = baseSchema.extend({
  ministryId: z.string().uuid(),
  teamId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome da função").max(80),
});

const functionUpdateSchema = functionSchema.extend({
  functionId: z.string().uuid(),
});

const activeFunctionSchema = baseSchema.extend({
  functionId: z.string().uuid(),
  active: z.boolean(),
});

function refresh(churchSlug: string) {
  revalidatePath(`/${churchSlug}/admin`);
  revalidatePath(`/${churchSlug}/admin/ministerios`);
  revalidatePath(`/${churchSlug}`, "layout");
}

export async function createAdminMinistry(raw: unknown): Promise<ActionResult> {
  const parsed = ministrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("ministries").insert({
    church_id: d.churchId,
    name: d.name,
    slug: slugify(d.name),
  });
  if (error) return { ok: false, error: error.code === "23505" ? "Já existe um ministério com esse nome" : "Sem permissão para criar ministérios" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function updateAdminMinistry(raw: unknown): Promise<ActionResult> {
  const parsed = ministryUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ministries")
    .update({ name: d.name })
    .eq("id", d.ministryId)
    .eq("church_id", d.churchId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Sem permissão para editar este ministério" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function setAdminMinistryActive(raw: unknown): Promise<ActionResult> {
  const parsed = activeMinistrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("ministries")
    .update({ active: d.active })
    .eq("id", d.ministryId)
    .eq("church_id", d.churchId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Sem permissão para alterar este ministério" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function createAdminTeam(raw: unknown): Promise<ActionResult> {
  const parsed = teamSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    name: d.name,
  });
  if (error) return { ok: false, error: "Sem permissão para criar este time" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function updateAdminTeam(raw: unknown): Promise<ActionResult> {
  const parsed = teamUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments")
    .update({ name: d.name })
    .eq("id", d.teamId)
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Sem permissão para editar este time" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function setAdminTeamActive(raw: unknown): Promise<ActionResult> {
  const parsed = activeTeamSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments")
    .update({ active: d.active })
    .eq("id", d.teamId)
    .eq("church_id", d.churchId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Sem permissão para alterar este time" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function createAdminFunction(raw: unknown): Promise<ActionResult> {
  const parsed = functionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("team_functions").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    department_id: d.teamId,
    name: d.name,
  });
  if (error) return { ok: false, error: "Sem permissão para criar esta função" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function updateAdminFunction(raw: unknown): Promise<ActionResult> {
  const parsed = functionUpdateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_functions")
    .update({ name: d.name })
    .eq("id", d.functionId)
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId)
    .eq("department_id", d.teamId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Sem permissão para editar esta função" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function setAdminFunctionActive(raw: unknown): Promise<ActionResult> {
  const parsed = activeFunctionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("team_functions")
    .update({ active: d.active })
    .eq("id", d.functionId)
    .eq("church_id", d.churchId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Sem permissão para alterar esta função" };
  refresh(d.churchSlug);
  return { ok: true, data: undefined };
}
