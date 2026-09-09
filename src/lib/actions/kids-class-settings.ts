"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const schema = z.object({
  churchSlug: z.string().min(2),
  ministryId: z.string().uuid(),
  classes: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(1, "Informe o nome da turma").max(50),
      })
    )
    .min(1)
    .max(20),
});

export async function saveKidsClassNames(raw: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  const d = parsed.data;
  const tenant = await getTenant(d.churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids || kids.id !== d.ministryId) {
    return { ok: false, error: "Ministério Kids inválido" };
  }

  const supabase = await createClient();
  let canManage = tenant.isCoord;
  if (!canManage) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", d.ministryId)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();
    canManage = membership?.role === "gerente" || membership?.role === "lider";
  }
  if (!canManage) return { ok: false, error: "Sem permissão para alterar as turmas" };

  const normalized = d.classes.map((item) => ({
    id: item.id,
    name: item.name.trim(),
  }));
  const uniqueNames = new Set(normalized.map((item) => item.name.toLocaleLowerCase("pt-BR")));
  if (uniqueNames.size !== normalized.length) {
    return { ok: false, error: "Use nomes diferentes para cada turma" };
  }

  const ids = normalized.map((item) => item.id);
  const { data: existing, error: loadError } = await supabase
    .from("child_classes")
    .select("id")
    .eq("ministry_id", d.ministryId)
    .in("id", ids);
  if (loadError || (existing ?? []).length !== ids.length) {
    return { ok: false, error: "Não foi possível validar as turmas" };
  }

  for (const item of normalized) {
    const { error } = await supabase
      .from("child_classes")
      .update({ name: item.name })
      .eq("id", item.id)
      .eq("ministry_id", d.ministryId);
    if (error) return { ok: false, error: "Não foi possível salvar os nomes das turmas" };
  }

  revalidatePath(`/${d.churchSlug}/infantil`);
  revalidatePath(`/${d.churchSlug}/infantil/configuracoes`);
  return { ok: true, data: undefined };
}
