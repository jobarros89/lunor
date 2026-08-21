"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const itemFields = z.object({
  type: z.enum(["WORSHIP", "SPEAKING", "MEDIA", "OTHER"]),
  title: z.string().trim().min(1, "Informe o título").max(160),
  durationMinutes: z.coerce
    .number()
    .int("Informe uma duração inteira")
    .min(0, "A duração não pode ser negativa")
    .max(1440, "A duração máxima é 1440 minutos"),
  notes: z.string().default(""),
});

const eventScope = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
});

const createSchema = eventScope.merge(itemFields);
const updateSchema = createSchema.extend({ itemId: z.string().uuid() });
const itemSchema = eventScope.extend({ itemId: z.string().uuid() });
const moveSchema = itemSchema.extend({ direction: z.enum(["up", "down"]) });

function eventPath(churchSlug: string, eventId: string) {
  return `/${churchSlug}/escalas/${eventId}`;
}

export async function createServiceItem(raw: unknown): Promise<ActionResult> {
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: last, error: positionError } = await supabase
    .from("service_items")
    .select("position")
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) {
    return { ok: false, error: "Não foi possível carregar a ordem do culto" };
  }

  const { data: created, error } = await supabase
    .from("service_items")
    .insert({
      church_id: d.churchId,
      event_id: d.eventId,
      type: d.type,
      title: d.title,
      duration_minutes: d.durationMinutes,
      notes: d.notes.trim() || null,
      position: last ? last.position + 1 : 0,
    })
    .select("id")
    .maybeSingle();
  if (error || !created) {
    return { ok: false, error: "Sem permissão para adicionar este item" };
  }

  revalidatePath(eventPath(d.churchSlug, d.eventId));
  return { ok: true, data: undefined };
}

export async function updateServiceItem(raw: unknown): Promise<ActionResult> {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: updated, error } = await supabase
    .from("service_items")
    .update({
      type: d.type,
      title: d.title,
      duration_minutes: d.durationMinutes,
      notes: d.notes.trim() || null,
    })
    .eq("id", d.itemId)
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return { ok: false, error: "Sem permissão para editar este item" };
  }

  revalidatePath(eventPath(d.churchSlug, d.eventId));
  return { ok: true, data: undefined };
}

export async function removeServiceItem(raw: unknown): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: removed, error } = await supabase
    .from("service_items")
    .delete()
    .eq("id", d.itemId)
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .select("id")
    .maybeSingle();
  if (error || !removed) {
    return { ok: false, error: "Sem permissão para remover este item" };
  }

  revalidatePath(eventPath(d.churchSlug, d.eventId));
  return { ok: true, data: undefined };
}

export async function moveServiceItem(raw: unknown): Promise<ActionResult> {
  const parsed = moveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const { data: items, error: loadError } = await supabase
    .from("service_items")
    .select("id, position")
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .order("position");
  if (loadError || !items) {
    return { ok: false, error: "Não foi possível carregar a ordem do culto" };
  }

  const currentIndex = items.findIndex((item) => item.id === d.itemId);
  if (currentIndex < 0) return { ok: false, error: "Item não encontrado" };
  const neighborIndex = d.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (neighborIndex < 0 || neighborIndex >= items.length) {
    return { ok: true, data: undefined };
  }

  const current = items[currentIndex];
  const neighbor = items[neighborIndex];
  const parkingPosition = Math.max(...items.map((item) => item.position)) + 1;

  const { data: parked, error: parkingError } = await supabase
    .from("service_items")
    .update({ position: parkingPosition })
    .eq("id", neighbor.id)
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .select("id")
    .maybeSingle();
  if (parkingError || !parked) {
    return { ok: false, error: "Sem permissão para reordenar" };
  }

  const { data: moved, error: moveError } = await supabase
    .from("service_items")
    .update({ position: neighbor.position })
    .eq("id", current.id)
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .select("id")
    .maybeSingle();
  if (moveError || !moved) {
    await supabase
      .from("service_items")
      .update({ position: neighbor.position })
      .eq("id", neighbor.id)
      .eq("church_id", d.churchId)
      .eq("event_id", d.eventId);
    return { ok: false, error: "Não foi possível alterar a ordem" };
  }

  const { data: completed, error: completionError } = await supabase
    .from("service_items")
    .update({ position: current.position })
    .eq("id", neighbor.id)
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .select("id")
    .maybeSingle();
  if (completionError || !completed) {
    await supabase
      .from("service_items")
      .update({ position: current.position })
      .eq("id", current.id)
      .eq("church_id", d.churchId)
      .eq("event_id", d.eventId);
    await supabase
      .from("service_items")
      .update({ position: neighbor.position })
      .eq("id", neighbor.id)
      .eq("church_id", d.churchId)
      .eq("event_id", d.eventId);
    return { ok: false, error: "Não foi possível concluir a nova ordem" };
  }

  revalidatePath(eventPath(d.churchSlug, d.eventId));
  return { ok: true, data: undefined };
}
