"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const statusSchema = z.enum(["available", "unavailable", "maybe"]);

const availabilitySchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  requestId: z.string().uuid().nullable().optional(),
  status: statusSchema,
});

export type AvailabilityStatus = z.infer<typeof statusSchema>;

export async function setMyAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = availabilitySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados de disponibilidade inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const { error } = await supabase.from("member_availability").upsert(
    {
      church_id: d.churchId,
      ministry_id: d.ministryId,
      event_id: d.eventId,
      user_id: user.id,
      request_id: d.requestId ?? null,
      status: d.status,
      source: d.requestId ? "leader_request" : "volunteer",
    },
    { onConflict: "ministry_id,event_id,user_id" }
  );

  if (error) {
    console.error("setMyAvailability:", error);
    return { ok: false, error: "Não foi possível salvar sua disponibilidade" };
  }

  revalidatePath(`/${d.churchSlug}/disponibilidade`);
  revalidatePath(`/${d.churchSlug}/escalas`);
  return { ok: true, data: undefined };
}

const clearSchema = availabilitySchema.omit({ status: true });

export async function clearMyAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = clearSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const { error } = await supabase
    .from("member_availability")
    .delete()
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId)
    .eq("event_id", d.eventId)
    .eq("user_id", user.id);

  if (error) return { ok: false, error: "Não foi possível limpar sua resposta" };
  revalidatePath(`/${d.churchSlug}/disponibilidade`);
  return { ok: true, data: undefined };
}

const requestSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  title: z.string().trim().min(2, "Informe um título").max(120),
  eventIds: z.array(z.string().uuid()).min(1, "Selecione pelo menos um culto").max(30),
  respondBy: z.string().datetime().nullable().optional(),
});

export async function createAvailabilityRequest(
  raw: unknown
): Promise<ActionResult<{ requestId: string }>> {
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const { data: requestId, error } = await supabase.rpc("create_availability_request", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_title: d.title,
    p_event_ids: d.eventIds,
    p_respond_by: d.respondBy ?? null,
  });

  if (error || !requestId) {
    console.error("createAvailabilityRequest:", error);
    return { ok: false, error: "Sem permissão ou não foi possível criar a solicitação" };
  }

  const { data: members } = await supabase
    .from("ministry_members")
    .select("user_id")
    .eq("church_id", d.churchId)
    .eq("ministry_id", d.ministryId)
    .eq("active", true);

  await notifyUsers(
    (members ?? []).map((member) => member.user_id).filter((id) => id !== user.id),
    {
      title: "Disponibilidade solicitada",
      body: d.title,
      url: `/${d.churchSlug}/disponibilidade`,
      tag: `availability-${requestId}`,
    }
  );

  revalidatePath(`/${d.churchSlug}/disponibilidade`);
  return { ok: true, data: { requestId: String(requestId) } };
}
