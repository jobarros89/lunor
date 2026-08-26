"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "./types";

const modules = ["teams", "worship", "children", "equipment"] as const;

const churchSetupSchema = z.object({
  modules: z.array(z.enum(modules)).min(1, "Escolha pelo menos um módulo"),
  ministryName: z.string().trim().min(2, "Informe o primeiro ministério").max(60),
});

export async function completeChurchOnboarding(raw: unknown): Promise<ActionResult> {
  const parsed = churchSetupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("church_members")
    .select("church_id, role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) return { ok: false, error: "Somente o administrador pode configurar a igreja" };

  const { data: church } = await supabase
    .from("churches")
    .select("slug, settings")
    .eq("id", membership.church_id)
    .single();
  if (!church) return { ok: false, error: "Igreja não encontrada" };

  const currentSettings = church.settings && typeof church.settings === "object" && !Array.isArray(church.settings)
    ? church.settings as Record<string, unknown>
    : {};
  const { error: settingsError } = await supabase
    .from("churches")
    .update({ settings: { ...currentSettings, initial_modules: parsed.data.modules, setup_completed: true } })
    .eq("id", membership.church_id);
  if (settingsError) return { ok: false, error: "Não foi possível salvar os módulos" };

  const ministrySlug = slugify(parsed.data.ministryName);
  const { data: existing } = await supabase
    .from("ministries")
    .select("id")
    .eq("church_id", membership.church_id)
    .eq("slug", ministrySlug)
    .maybeSingle();
  let ministryId = existing?.id;
  if (!ministryId) {
    const { data: ministry, error } = await supabase
      .from("ministries")
      .insert({ church_id: membership.church_id, name: parsed.data.ministryName, slug: ministrySlug })
      .select("id")
      .single();
    if (error || !ministry) return { ok: false, error: "Não foi possível criar o ministério" };
    ministryId = ministry.id;
  }

  const { error: memberError } = await supabase.from("ministry_members").upsert({
    church_id: membership.church_id,
    ministry_id: ministryId,
    user_id: user.id,
    role: "gerente",
    active: true,
  }, { onConflict: "ministry_id,user_id" });
  if (memberError) return { ok: false, error: "Não foi possível vincular o ministério" };

  await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  await supabase
    .from("church_members")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("church_id", membership.church_id)
    .eq("user_id", user.id);
  redirect(`/${church.slug}?welcome=1`);
}

const memberSetupSchema = z.object({
  ministryIds: z.array(z.string().uuid()).min(1, "Selecione pelo menos um ministério"),
  phone: z.string().trim().max(30).default(""),
  departments: z.array(z.string().trim().min(1)).default([]),
});

export async function completeMemberOnboarding(raw: unknown): Promise<ActionResult> {
  const parsed = memberSetupSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("church_members")
    .select("church_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/comecar");

  const { data: church } = await supabase.from("churches").select("slug").eq("id", membership.church_id).single();
  const uniqueMinistryIds = [...new Set(parsed.data.ministryIds)];
  const { data: ministries } = await supabase
    .from("ministries")
    .select("id")
    .eq("church_id", membership.church_id)
    .in("id", uniqueMinistryIds);
  if (!church || ministries?.length !== uniqueMinistryIds.length) {
    return { ok: false, error: "Um ou mais ministérios são inválidos" };
  }

  const { error: joinError } = await supabase.rpc("complete_member_onboarding", {
    p_church_id: membership.church_id,
    p_ministry_ids: uniqueMinistryIds,
    p_phone: parsed.data.phone || null,
    p_availability: {},
  });
  if (joinError) return { ok: false, error: "Não foi possível concluir seu cadastro" };

  const departments = [...new Set(parsed.data.departments)];
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ departments })
    .eq("id", user.id);
  if (profileError) return { ok: false, error: "Não foi possível salvar os departamentos" };

  redirect(`/${church.slug}/escalas`);
}
