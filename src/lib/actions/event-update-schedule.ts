"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inferServicePeriod } from "@/lib/event-context";
import { parseAppLocalDateTime } from "@/lib/local-datetime";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const scheduleSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  startsAt: z.string().min(10, "Informe a data e hora de início"),
  endsAt: z.string().default(""),
});

export async function updateEventSchedule(raw: unknown): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const d = parsed.data;
  const startsAt = parseAppLocalDateTime(d.startsAt);
  const endsAt = d.endsAt ? parseAppLocalDateTime(d.endsAt) : null;

  if (!startsAt || (d.endsAt && !endsAt)) {
    return { ok: false, error: "Data ou horário inválido" };
  }
  if (endsAt && endsAt <= startsAt) {
    return { ok: false, error: "O horário de término precisa ser posterior ao horário de início" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Faça login novamente para continuar" };

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id, ministry_id")
    .eq("id", d.eventId)
    .eq("church_id", d.churchId)
    .maybeSingle();

  if (eventError || !event) return { ok: false, error: "Culto não encontrado" };

  const [{ data: isMaster }, { data: churchMembership }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase
      .from("church_members")
      .select("role")
      .eq("church_id", d.churchId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  let canEdit =
    Boolean(isMaster) ||
    churchMembership?.role === "admin" ||
    churchMembership?.role === "coordenador";

  if (event.ministry_id && !canEdit) {
    const { data: ministryMembership } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", d.churchId)
      .eq("ministry_id", event.ministry_id)
      .eq("user_id", user.id)
      .eq("active", true)
      .maybeSingle();

    canEdit =
      ministryMembership?.role === "gerente" ||
      ministryMembership?.role === "lider";
  }

  if (!canEdit) {
    return {
      ok: false,
      error: "Você não tem permissão para editar a data ou o horário deste culto",
    };
  }

  const { error } = await supabase
    .from("events")
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      service_period: inferServicePeriod(d.startsAt),
    })
    .eq("id", d.eventId)
    .eq("church_id", d.churchId);

  if (error) {
    console.error("updateEventSchedule:", error);
    if (error.code === "42501") {
      return { ok: false, error: "Você não tem permissão para editar este culto" };
    }
    if (error.message?.includes("events_time_order")) {
      return { ok: false, error: "O horário de término precisa ser posterior ao horário de início" };
    }
    return { ok: false, error: "Não foi possível atualizar a data e o horário" };
  }

  revalidatePath(`/${d.churchSlug}`);
  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}/louvor/escalas`);
  revalidatePath(`/${d.churchSlug}/louvor/escalas/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}/infantil`);
  revalidatePath(`/${d.churchSlug}/infantil/escalas`);
  revalidatePath(`/${d.churchSlug}/infantil/escalas/${d.eventId}`);

  return { ok: true, data: undefined };
}
