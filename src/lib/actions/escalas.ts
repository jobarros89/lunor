"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAppLocalDateTime } from "@/lib/local-datetime";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import { ministryOperationalRecipientIds } from "@/lib/push/ministry-recipients";
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
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
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
  functionId: z.string().uuid().nullable().default(null),
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
  const arrivalTime = d.arrivalTime ? parseAppLocalDateTime(d.arrivalTime) : null;
  if (d.arrivalTime && !arrivalTime) {
    return { ok: false, error: "Horário de chegada inválido" };
  }

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
    function_id: d.functionId,
    role_name: d.roleName,
    arrival_time: arrivalTime?.toISOString() ?? null,
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

const eventResponsibilitySchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  roleName: z.string().min(2, "Informe a responsabilidade").max(80),
});

export async function addEventResponsibility(raw: unknown): Promise<ActionResult> {
  const parsed = eventResponsibilitySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("assignments").insert({
    church_id: d.churchId,
    event_id: d.eventId,
    user_id: d.userId,
    role_name: d.roleName.trim(),
    assignment_scope: "event",
    ministry_id: null,
    department_id: null,
    function_id: null,
    leader_id: user.id,
  });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Essa pessoa já possui esta responsabilidade no evento"
          : "Sem permissão para adicionar a responsabilidade",
    };
  }

  const { data: event } = await supabase
    .from("events")
    .select("title")
    .eq("id", d.eventId)
    .single();
  await notifyUsers([d.userId], {
    title: "Nova responsabilidade no evento",
    body: `${d.roleName.trim()} · ${event?.title ?? "Evento"}`,
    url: `/${d.churchSlug}/escalas/${d.eventId}`,
    tag: `event-role-${d.eventId}`,
  });

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  revalidatePath(`/${d.churchSlug}`);
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

  const [
    { data: departments, error: departmentsError },
    { data: functions, error: functionsError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
      supabase
        .from("departments")
        .select("id, name")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("team_functions")
        .select("id, name, department_id")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .eq("active", true)
        .order("name"),
      supabase
        .from("assignments")
        .select("id, department_id, function_id, departments(name)")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .eq("event_id", d.eventId),
    ]);

  if (departmentsError || functionsError || assignmentsError) {
    return { ok: false as const, error: "Não foi possível carregar onde servir" };
  }

  return {
    ok: true as const,
    data: {
      departments: departments ?? [],
      functions: functions ?? [],
      assignments: (assignments ?? []).map((assignment) => ({
        id: assignment.id,
        department_id: assignment.department_id,
        function_id: assignment.function_id,
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

  const { data: assignmentContext, error: assignmentError } = await supabase
    .from("assignments")
    .select("church_id, ministry_id, event_id, leader_id")
    .eq("id", d.assignmentId)
    .eq("church_id", d.churchId)
    .eq("event_id", d.eventId)
    .maybeSingle();
  if (assignmentError || !assignmentContext?.ministry_id) {
    return { ok: false, error: "Escala inválida para solicitar substituição" };
  }

  const { error: subError } = await supabase.from("substitution_requests").insert({
    church_id: assignmentContext.church_id,
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

  const [{ data: me }, { data: leaders }, { data: ev }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    supabase
      .from("ministry_members")
      .select("user_id, church_id, ministry_id, role, active")
      .eq("church_id", assignmentContext.church_id)
      .eq("ministry_id", assignmentContext.ministry_id)
      .eq("active", true)
      .in("role", ["gerente", "lider"]),
    supabase.from("events").select("title").eq("id", assignmentContext.event_id).single(),
  ]);
  const targets = ministryOperationalRecipientIds(leaders ?? [], {
    churchId: assignmentContext.church_id,
    ministryId: assignmentContext.ministry_id,
    explicitLeaderId: assignmentContext.leader_id,
  });
  await notifyUsers(targets, {
    title: "Pedido de troca 🔄",
    body: `${me?.full_name || "Um voluntário"} pediu substituição${ev?.title ? ` · ${ev.title}` : ""}`,
    url: `/${d.churchSlug}/escalas/${assignmentContext.event_id}`,
    tag: `sub-${d.assignmentId}`,
  });

  revalidatePath(`/${d.churchSlug}/escalas/${assignmentContext.event_id}`);
  return { ok: true, data: undefined };
}


const eventMinistrySchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  eventId: z.string().uuid(),
  ministryId: z.string().uuid(),
});

export async function addEventMinistry(raw: unknown): Promise<ActionResult> {
  const parsed = eventMinistrySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase.from("event_ministries").insert({
    church_id: d.churchId,
    event_id: d.eventId,
    ministry_id: d.ministryId,
    created_by: user.id,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Esta área já está vinculada ao evento"
          : "Sem permissão para adicionar esta área",
    };
  }

  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: undefined };
}
