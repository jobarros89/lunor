"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const linkSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  guardianId: z.string().uuid(),
  userId: z.string().uuid(),
});

export async function linkGuardianAccount(raw: unknown): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("church_members")
    .select("user_id")
    .eq("church_id", d.churchId)
    .eq("user_id", d.userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    return { ok: false, error: "Essa conta não está ativa nesta igreja" };
  }

  const { data: guardian, error } = await supabase
    .from("guardians")
    .update({ user_id: d.userId })
    .eq("id", d.guardianId)
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId)
    .select("id")
    .maybeSingle();

  if (error || !guardian) {
    return { ok: false, error: "Sem permissão ou não foi possível vincular a conta" };
  }

  revalidatePath(`/${d.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}

const unlinkSchema = linkSchema.omit({ userId: true });

export async function unlinkGuardianAccount(raw: unknown): Promise<ActionResult> {
  const parsed = unlinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: guardian, error } = await supabase
    .from("guardians")
    .update({ user_id: null })
    .eq("id", d.guardianId)
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId)
    .select("id")
    .maybeSingle();

  if (error || !guardian) {
    return { ok: false, error: "Sem permissão ou não foi possível remover o vínculo" };
  }

  revalidatePath(`/${d.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}
