"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const eventSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  typeId: z.string().uuid().nullable().default(null),
  ministryId: z.string().uuid().nullable().default(null),
  title: z.string().min(2, "Informe o título").max(120),
  description: z.string().max(2000).default(""),
  location: z.string().max(200).default(""),
  mapUrl: z.string().max(500).default(""),
  script: z.string().max(5000).default(""),
  startsAt: z.string().min(10, "Informe a data e hora"),
  endsAt: z.string().default(""),
});

export async function createEvent(raw: unknown): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: created, error } = await supabase
    .from("events")
    .insert({
      church_id: d.churchId,
      type_id: d.typeId,
      ministry_id: d.ministryId,
      department_id: null,
      title: d.title,
      description: d.description || null,
      location: d.location || null,
      map_url: d.mapUrl || null,
      script: d.script || null,
      starts_at: new Date(d.startsAt).toISOString(),
      ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { ok: false, error: "Sem permissão para criar eventos" };
  }
  revalidatePath(`/${d.churchSlug}/escalas`);
  redirect(`/${d.churchSlug}/escalas/${created.id}`);
}

const assignmentSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  departmentId: z.string().uuid().nullable().default(null),
  roleName: z.string().min(2, "Informe a função").max(80),
  arrivalTime: z.string().default(""),
  itemsToBring: z.string().max(1000).default(""),
});

export async function addAssignment(raw: unknown): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("assignments").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    event_id: d.eventId,
    user_id: d.userId,
    department_id: d.departmentId,
    role_name: d.roleName,
    arrival_time: d.arrivalTime ? new Date(d.arrivalTime).toISOString() : null,
    items_to_bring: d.itemsToBring || null,
    leader_id: user?.id ?? null,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Essa pessoa já está escalada nessa função"
          : "Sem permissão para escalar",
    };
  }

  const { data: ev } = await supabase
    .from("events")
    .select("title")
    .eq("id", d.eventId)
    .single();
  await notifyUsers([d.userId], {
    title: "Você foi escalado 🙌",
    body: `${d.roleName} · ${ev?.title ?? "Nova escala"}`,
    url: `/${d.churchSlug}/escalas/${d.eventId}`,
    tag: `assign-${d.eventId}`,
  });

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

const servingContextSchema = z.object({
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
});

export async function getAssignmentServingContext(raw: unknown) {
  const parsed = servingContextSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();

  const [{ data: departments, error: departmentsError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("departments")
        .select("id, name")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("assignments")
        .select("id, department_id, departments(name)")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .eq("event_id", d.eventId),
    ]);

  if (departmentsError || assignmentsError) {
    return { ok: false as const, error: "Não foi possível carregar onde servir" };
  }

  return {
    ok: true as const,
    data: {
      departments: departments ?? [],
      assignments: (assignments ?? []).map((assignment) => ({
        id: assignment.id,
        department_id: assignment.department_id,
        department_name:
          (assignment.departments as unknown as { name: string } | null)?.name ?? null,
      })),
    },
  };
}

const idSchema = z.object({
  churchSlug: z.string().min(2),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

export async function removeAssignment(raw: unknown): Promise<ActionResult> {
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("id", d.assignmentId);
  if (error) return { ok: false, error: "Sem permissão para remover" };
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

const equipLinkSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  equipmentId: z.string().uuid(),
});

export async function linkEquipment(raw: unknown): Promise<ActionResult> {
  const parsed = equipLinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("assignment_equipments").insert({
    assignment_id: d.assignmentId,
    equipment_id: d.equipmentId,
    church_id: d.churchId,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Equipamento já vinculado"
          : "Sem permissão para vincular equipamentos",
    };
  }
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

export async function unlinkEquipment(raw: unknown): Promise<ActionResult> {
  const parsed = equipLinkSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignment_equipments")
    .delete()
    .eq("assignment_id", d.assignmentId)
    .eq("equipment_id", d.equipmentId);
  if (error) return { ok: false, error: "Sem permissão" };
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}

const statusSchema = z.object({
  churchSlug: z.string().min(2),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  status: z.enum([
    "convidado",
    "confirmado",
    "substituicao_solicitada",
    "ausente",
    "presente",
  ]),
});

export async function setAssignmentStatus(raw: unknown): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({ status: d.status })
    .eq("id", d.assignmentId)
    .select();
  if (error || !data || data.length === 0) {
    return { ok: false, error: "Não foi possível atualizar o status" };
  }
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}`);
  return { ok: true, data: undefined };
}

const substitutionSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  reason: z.string().max(500).default(""),
});

export async function requestSubstitution(raw: unknown): Promise<ActionResult> {
  const parsed = substitutionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error: subError } = await supabase.from("substitution_requests").insert({
    church_id: d.churchId,
    assignment_id: d.assignmentId,
    requested_by: user.id,
    reason: d.reason || null,
  });
  if (subError) {
    return { ok: false, error: "Não foi possível solicitar substituição" };
  }

  const { error: statusError } = await supabase
    .from("assignments")
    .update({ status: "substituicao_solicitada" })
    .eq("id", d.assignmentId);
  if (statusError) {
    console.error("requestSubstitution: falha ao atualizar status", statusError);
    return { ok: false, error: "Pedido registrado, mas o status não atualizou" };
  }

  const [{ data: me }, { data: leaders }, { data: asg }, { data: ev }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("church_members")
      .select("user_id")
      .eq("church_id", d.churchId)
      .in("role", ["admin", "coordenador"]),
    supabase.from("assignments").select("leader_id").eq("id", d.assignmentId).single(),
    supabase.from("events").select("title").eq("id", d.eventId).single(),
  ]);
  const targets = [...(leaders ?? []).map((l) => l.user_id), asg?.leader_id];
  await notifyUsers(targets, {
    title: "Pedido de troca 🔄",
    body: `${me?.full_name || "Um voluntário"} pediu substituição${ev?.title ? ` · ${ev.title}` : ""}`,
    url: `/${d.churchSlug}/escalas/${d.eventId}`,
    tag: `sub-${d.assignmentId}`,
  });

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}
