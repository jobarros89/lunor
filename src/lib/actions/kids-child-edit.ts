"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const updateChildSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  childId: z.string().uuid(),
  fullName: z.string().min(2, "Informe o nome da criança").max(120),
  birthDate: z.string().min(10, "Informe a data de nascimento"),
  allergies: z.string().max(500).default(""),
  healthNotes: z.string().max(1000).default(""),
  specialNeeds: z.string().max(1000).default(""),
  emergencyName: z.string().max(120).default(""),
  emergencyPhone: z.string().max(30).default(""),
  photoConsent: z.boolean().default(false),
});

export async function updateKidsChild(raw: unknown): Promise<ActionResult> {
  const parsed = updateChildSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login novamente" };

  const { data: canOperate } = await supabase.rpc("can_operate_kids", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_event: null,
  });
  if (!canOperate) {
    return { ok: false, error: "A edição só fica disponível durante a operação em que você está escalado(a)" };
  }

  const { error } = await supabase
    .from("children")
    .update({
      full_name: d.fullName.trim(),
      birth_date: d.birthDate,
      allergies: d.allergies.trim() || null,
      health_notes: d.healthNotes.trim() || null,
      special_needs: d.specialNeeds.trim() || null,
      emergency_contact_name: d.emergencyName.trim() || null,
      emergency_contact_phone: d.emergencyPhone.trim() || null,
      photo_consent: d.photoConsent,
      photo_consent_at: d.photoConsent ? new Date().toISOString() : null,
    })
    .eq("id", d.childId)
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId);

  if (error) return { ok: false, error: "Não foi possível salvar as alterações" };

  revalidatePath(`/${d.churchSlug}/infantil`);
  revalidatePath(`/${d.churchSlug}/infantil/crianca/${d.childId}`);
  return { ok: true, data: undefined };
}

