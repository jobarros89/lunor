"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const schema = z
  .object({
    churchSlug: z.string().min(2),
    churchId: z.string().uuid(),
    ministryId: z.string().uuid(),
    sessionId: z.string().uuid().nullable().optional(),
    eventId: z.string().uuid().nullable().optional(),
    checkinId: z.string().uuid(),
    reason: z.string().max(200).default(""),
  })
  .refine((value) => !!value.sessionId || !!value.eventId, {
    message: "Contexto da recepção ausente",
  });

export async function chamarResponsavelSeguro(
  raw: unknown
): Promise<ActionResult<{ linkedAccountCount: number }>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };

  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let checkinQuery = supabase
    .from("child_checkins")
    .select("code, child_id, checked_out_at, event_id, reception_session_id")
    .eq("id", d.checkinId)
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId);

  checkinQuery = d.sessionId
    ? checkinQuery.eq("reception_session_id", d.sessionId)
    : checkinQuery.eq("event_id", d.eventId!);

  const { data: checkin, error: checkinError } = await checkinQuery.maybeSingle();

  if (checkinError || !checkin) {
    return {
      ok: false,
      error: "Presença não encontrada. Atualize a tela e tente novamente.",
    };
  }
  if (checkin.checked_out_at) {
    return { ok: false, error: "Esta criança já foi retirada desta sessão." };
  }

  const { error: pageError } = await supabase.from("child_pages").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    reception_session_id: d.sessionId ?? checkin.reception_session_id,
    event_id: d.eventId ?? checkin.event_id,
    checkin_id: d.checkinId,
    kind: "chamar",
    reason: d.reason || null,
    created_by: user?.id ?? null,
  });

  if (pageError) {
    if (pageError.code === "42501") {
      return { ok: false, error: "Sem permissão para chamar o responsável." };
    }
    if (pageError.code === "23505") {
      return { ok: false, error: "Já existe um chamado ativo para esta criança." };
    }
    return {
      ok: false,
      error: "Não foi possível registrar o chamado. Atualize a tela e tente novamente.",
    };
  }

  const { data: vinculos } = await supabase
    .from("child_guardians")
    .select("guardians!inner(user_id)")
    .eq("child_id", checkin.child_id);

  const alvos = [
    ...new Set(
      (vinculos ?? [])
        .map((v) => (v.guardians as unknown as { user_id: string | null }).user_id)
        .filter((id): id is string => !!id)
    ),
  ];

  await notifyUsers(alvos, {
    title: "Chamado do Kids 🔔",
    body: `Compareça ao Kids — código ${checkin.code}`,
    url: `/${d.churchSlug}`,
    tag: `infantil-${d.checkinId}`,
  });

  if (d.sessionId) {
    revalidatePath(`/${d.churchSlug}/infantil/recepcao/${d.sessionId}`);
  }
  if (d.eventId) {
    revalidatePath(`/${d.churchSlug}/infantil/sessao/${d.eventId}`);
  }
  revalidatePath(`/${d.churchSlug}`);

  return { ok: true, data: { linkedAccountCount: alvos.length } };
}
