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

function guardianAccountError(message: string) {
  if (message.includes("target_user_not_active")) {
    return "Essa conta não está ativa nesta igreja";
  }
  if (message.includes("guardian_not_found")) {
    return "Responsável não encontrado";
  }
  if (message.includes("not_allowed")) {
    return "Você precisa fazer parte da equipe Kids para realizar esta ação";
  }
  return "Não foi possível atualizar o acesso familiar";
}

function revalidateGuardianPages(churchSlug: string) {
  revalidatePath(`/${churchSlug}/infantil`);
  revalidatePath(`/${churchSlug}/infantil/responsaveis`);
}

export async function linkGuardianAccount(raw: unknown): Promise<ActionResult> {
  const parsed = linkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: linked, error } = await supabase.rpc("link_guardian_account", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_guardian: d.guardianId,
    p_user: d.userId,
  });

  if (error || linked !== true) {
    return { ok: false, error: guardianAccountError(error?.message ?? "") };
  }

  revalidateGuardianPages(d.churchSlug);
  return { ok: true, data: undefined };
}

const unlinkSchema = linkSchema.omit({ userId: true });

export async function unlinkGuardianAccount(raw: unknown): Promise<ActionResult> {
  const parsed = unlinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: unlinked, error } = await supabase.rpc("unlink_guardian_account", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_guardian: d.guardianId,
  });

  if (error || unlinked !== true) {
    return { ok: false, error: guardianAccountError(error?.message ?? "") };
  }

  revalidateGuardianPages(d.churchSlug);
  return { ok: true, data: undefined };
}
