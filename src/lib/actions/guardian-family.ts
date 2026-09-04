"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const inviteSchema = z.object({
  churchSlug: z.string().min(2),
  guardianId: z.string().uuid(),
});

async function requestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  if (!host) throw new Error("missing_request_host");
  return `${protocol}://${host}`;
}

export async function createGuardianInvite(
  raw: unknown
): Promise<ActionResult<{ url: string }>> {
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_guardian_invite", {
    p_guardian: parsed.data.guardianId,
  });

  if (error || !token) {
    return {
      ok: false,
      error: "O convite só pode ser criado por um integrante ativo da equipe Kids.",
    };
  }

  const origin = await requestOrigin();
  revalidatePath(`/${parsed.data.churchSlug}/infantil`);
  revalidatePath(`/${parsed.data.churchSlug}/infantil/responsaveis`);
  return {
    ok: true,
    data: { url: `${origin}/familia/${token}` },
  };
}

const checkinSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  childId: z.string().uuid(),
});

export async function guardianCheckIn(raw: unknown): Promise<ActionResult> {
  const parsed = checkinSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const data = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("guardian_checkin_child", {
    p_church: data.churchId,
    p_ministry: data.ministryId,
    p_event: data.eventId,
    p_child: data.childId,
    p_class: null,
  });

  if (error) {
    return {
      ok: false,
      error: "O check-in não está disponível agora ou a criança não pertence a esta conta.",
    };
  }

  revalidatePath(`/${data.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}

const checkoutSchema = z.object({
  churchSlug: z.string().min(2),
  checkinId: z.string().uuid(),
});

export async function guardianCheckOut(raw: unknown): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("guardian_checkout_child", {
    p_checkin: parsed.data.checkinId,
  });

  if (error) {
    return {
      ok: false,
      error: "A retirada não está disponível ou esta conta não está autorizada.",
    };
  }

  revalidatePath(`/${parsed.data.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}
