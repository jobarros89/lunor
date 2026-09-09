"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const contextSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
});

const openSchema = contextSchema.extend({
  campusId: z.string().uuid(),
  title: z.string().trim().min(2).max(120).default("Recepção Kids"),
});

export async function openStandaloneKidsReception(
  raw: unknown
): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = openSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const { data: sessionId, error } = await supabase.rpc("open_kids_reception_session", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_title: d.title,
    p_event: null,
    p_campus: d.campusId,
  });

  if (error || !sessionId) {
    const message = error?.message ?? "";
    if (message.includes("reception_already_open")) {
      return { ok: false, error: "Já existe uma recepção Kids aberta neste campus." };
    }
    if (message.includes("campus_required") || message.includes("invalid_campus")) {
      return { ok: false, error: "Escolha um campus ativo para abrir a recepção." };
    }
    return { ok: false, error: "Não foi possível abrir a recepção Kids." };
  }

  revalidatePath(`/${d.churchSlug}/infantil`);
  return { ok: true, data: { sessionId } };
}

const closeSchema = contextSchema.extend({
  sessionId: z.string().uuid(),
});

export async function closeKidsReception(raw: unknown): Promise<ActionResult> {
  const parsed = closeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const { data: closed, error } = await supabase.rpc("close_kids_reception", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_session: d.sessionId,
  });

  if (error || closed !== true) {
    const message = error?.message ?? "";
    if (message.includes("children_still_present")) {
      return {
        ok: false,
        error: "Ainda há crianças presentes. Registre as retiradas antes de encerrar a recepção.",
      };
    }
    if (message.includes("reception_not_open")) {
      return { ok: false, error: "Esta recepção já foi encerrada." };
    }
    return { ok: false, error: "Não foi possível encerrar a recepção Kids." };
  }

  revalidatePath(`/${d.churchSlug}/infantil`);
  revalidatePath(`/${d.churchSlug}`);
  return { ok: true, data: undefined };
}

const closeByEventSchema = contextSchema.extend({
  eventId: z.string().uuid(),
});

export async function closeKidsReceptionByEvent(raw: unknown): Promise<ActionResult> {
  const parsed = closeByEventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const { data: rows, error: currentError } = await supabase.rpc("current_kids_reception", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
  });

  if (currentError) return { ok: false, error: "Não foi possível localizar a recepção atual." };
  const current = (rows ?? []).find(
    (row: { session_id: string; event_id: string | null }) => row.event_id === d.eventId
  );
  if (!current) return { ok: false, error: "Esta recepção já foi encerrada." };

  return closeKidsReception({
    churchSlug: d.churchSlug,
    churchId: d.churchId,
    ministryId: d.ministryId,
    sessionId: current.session_id,
  });
}

const checkoutSchema = z.object({
  churchSlug: z.string().min(2),
  sessionId: z.string().uuid(),
  checkinId: z.string().uuid(),
  guardianId: z.string().uuid(),
  overrideReason: z.string().max(300).default(""),
});

export async function checkOutReceptionChild(raw: unknown): Promise<ActionResult> {
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("child_checkins")
    .update({
      picked_up_by: d.guardianId,
      checked_out_at: new Date().toISOString(),
      checked_out_by: user?.id ?? null,
      override_reason: d.overrideReason || null,
    })
    .eq("id", d.checkinId)
    .eq("reception_session_id", d.sessionId);

  if (error) {
    if (error.message.includes("pickup_not_authorized")) {
      return {
        ok: false,
        error: "Essa pessoa não está autorizada a retirar. Chame a liderança para liberar com justificativa.",
      };
    }
    if (error.message.includes("override_requires_leader")) {
      return { ok: false, error: "Só a liderança do setor pode liberar uma retirada excepcional." };
    }
    return { ok: false, error: "Não foi possível registrar a retirada" };
  }

  revalidatePath(`/${d.churchSlug}/infantil/recepcao/${d.sessionId}`);
  revalidatePath(`/${d.churchSlug}/infantil`);
  return { ok: true, data: undefined };
}
