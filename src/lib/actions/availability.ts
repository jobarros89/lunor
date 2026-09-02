"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const statusSchema = z.enum(["available", "unavailable"]);
const periodSchema = z.enum(["all_day", "morning", "afternoon", "evening"]);

export type AvailabilityStatus = z.infer<typeof statusSchema>;
export type AvailabilityPeriod = z.infer<typeof periodSchema>;

function revalidateAvailability(churchSlug: string) {
  revalidatePath(`/${churchSlug}/disponibilidade`);
  revalidatePath(`/${churchSlug}/escalas`);
  revalidatePath(`/${churchSlug}/louvor`);
  revalidatePath(`/${churchSlug}/louvor/disponibilidade`);
  revalidatePath(`/${churchSlug}/infantil`);
  revalidatePath(`/${churchSlug}/infantil/disponibilidade`);
}

const availabilitySchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid(),
  eventId: z.string().uuid(),
  requestId: z.string().uuid().nullable().optional(),
  status: statusSchema,
});

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

  revalidateAvailability(d.churchSlug);
  return { ok: true, data: undefined };
}

const submitAvailabilitySchema = z
  .object({
    churchSlug: z.string().min(2),
    churchId: z.string().uuid(),
    ministryId: z.string().uuid(),
    requestId: z.string().uuid(),
    responses: z
      .array(
        z.object({
          eventId: z.string().uuid(),
          status: statusSchema,
        })
      )
      .min(1, "Responda pelo menos um culto")
      .max(30),
  })
  .superRefine(({ responses }, ctx) => {
    if (new Set(responses.map((response) => response.eventId)).size !== responses.length) {
      ctx.addIssue({
        code: "custom",
        message: "Há cultos duplicados na resposta",
        path: ["responses"],
      });
    }
  });

export async function submitMyAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = submitAvailabilitySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Dados de disponibilidade inválidos",
    };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const [{ data: request, error: requestError }, { data: requestEvents, error: eventsError }] =
    await Promise.all([
      supabase
        .from("availability_requests")
        .select("id")
        .eq("id", d.requestId)
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .is("closed_at", null)
        .maybeSingle(),
      supabase
        .from("availability_request_events")
        .select("event_id")
        .eq("request_id", d.requestId)
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId),
    ]);

  const allowedEventIds = new Set((requestEvents ?? []).map((row) => row.event_id));
  const hasInvalidEvent = d.responses.some((response) => !allowedEventIds.has(response.eventId));

  if (requestError || eventsError || !request || hasInvalidEvent) {
    return {
      ok: false,
      error: "Esta solicitação não está mais disponível",
    };
  }

  const { error } = await supabase.from("member_availability").upsert(
    d.responses.map((response) => ({
      church_id: d.churchId,
      ministry_id: d.ministryId,
      event_id: response.eventId,
      user_id: user.id,
      request_id: d.requestId,
      status: response.status,
      source: "leader_request",
    })),
    { onConflict: "ministry_id,event_id,user_id" }
  );

  if (error) {
    console.error("submitMyAvailability:", error);
    return { ok: false, error: "Não foi possível enviar sua disponibilidade" };
  }

  revalidateAvailability(d.churchSlug);
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
  revalidateAvailability(d.churchSlug);
  return { ok: true, data: undefined };
}

const calendarSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid().nullable(),
  campusId: z.string().uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: periodSchema,
  status: statusSchema,
});

function scopeNullable<T extends { eq: (column: string, value: string) => T; is: (column: string, value: null) => T }>(
  query: T,
  column: string,
  value: string | null
) {
  return value ? query.eq(column, value) : query.is(column, null);
}

export async function setMyCalendarAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = calendarSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Data ou disponibilidade inválida" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const baseDelete = supabase
    .from("member_availability_calendar")
    .delete()
    .eq("church_id", d.churchId)
    .eq("user_id", user.id)
    .eq("availability_date", d.date)
    .eq("period", d.period);
  const ministryDelete = scopeNullable(baseDelete, "ministry_id", d.ministryId);
  const { error: deleteError } = await scopeNullable(ministryDelete, "campus_id", d.campusId);
  if (deleteError) {
    console.error("setMyCalendarAvailability/delete:", deleteError);
    return { ok: false, error: "Não foi possível atualizar o calendário" };
  }

  const { error } = await supabase.from("member_availability_calendar").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    campus_id: d.campusId,
    user_id: user.id,
    availability_date: d.date,
    period: d.period,
    status: d.status,
  });

  if (error) {
    console.error("setMyCalendarAvailability/insert:", error);
    return { ok: false, error: "Não foi possível salvar no calendário" };
  }

  revalidateAvailability(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function clearMyCalendarAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = calendarSchema.omit({ status: true }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const baseDelete = supabase
    .from("member_availability_calendar")
    .delete()
    .eq("church_id", d.churchId)
    .eq("user_id", user.id)
    .eq("availability_date", d.date)
    .eq("period", d.period);
  const ministryDelete = scopeNullable(baseDelete, "ministry_id", d.ministryId);
  const { error } = await scopeNullable(ministryDelete, "campus_id", d.campusId);
  if (error) return { ok: false, error: "Não foi possível limpar esta data" };

  revalidateAvailability(d.churchSlug);
  return { ok: true, data: undefined };
}

const submitCalendarMonthSchema = z
  .object({
    churchSlug: z.string().min(2),
    churchId: z.string().uuid(),
    ministryId: z.string().uuid().nullable(),
    campusId: z.string().uuid().nullable(),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    period: periodSchema,
    entries: z
      .array(
        z.object({
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          status: statusSchema,
        })
      )
      .max(31),
  })
  .superRefine(({ month, entries }, ctx) => {
    const dates = entries.map((entry) => entry.date);
    if (dates.some((date) => !date.startsWith(`${month}-`))) {
      ctx.addIssue({
        code: "custom",
        message: "Há datas fora do mês selecionado",
        path: ["entries"],
      });
    }
    if (new Set(dates).size !== dates.length) {
      ctx.addIssue({
        code: "custom",
        message: "Há datas duplicadas",
        path: ["entries"],
      });
    }
  });

function nextCalendarMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function submitMyCalendarAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = submitCalendarMonthSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Disponibilidade mensal inválida",
    };
  }

  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const monthStart = `${d.month}-01`;
  const baseSelect = supabase
    .from("member_availability_calendar")
    .select("id, availability_date, status")
    .eq("church_id", d.churchId)
    .eq("user_id", user.id)
    .eq("period", d.period)
    .gte("availability_date", monthStart)
    .lt("availability_date", nextCalendarMonth(d.month));
  const ministrySelect = scopeNullable(baseSelect, "ministry_id", d.ministryId);
  const { data: existingRows, error: selectError } = await scopeNullable(
    ministrySelect,
    "campus_id",
    d.campusId
  );

  if (selectError) {
    console.error("submitMyCalendarAvailability/select:", selectError);
    return { ok: false, error: "Não foi possível carregar a disponibilidade do mês" };
  }

  const existingByDate = new Map(
    (existingRows ?? []).map((row) => [row.availability_date, row])
  );
  const desiredDates = new Set(d.entries.map((entry) => entry.date));
  const writeResults = await Promise.all(
    d.entries.map((entry) => {
      const current = existingByDate.get(entry.date);
      if (current) {
        if (current.status === entry.status) return Promise.resolve({ error: null });
        return supabase
          .from("member_availability_calendar")
          .update({ status: entry.status })
          .eq("id", current.id)
          .eq("user_id", user.id);
      }

      return supabase.from("member_availability_calendar").insert({
        church_id: d.churchId,
        ministry_id: d.ministryId,
        campus_id: d.campusId,
        user_id: user.id,
        availability_date: entry.date,
        period: d.period,
        status: entry.status,
      });
    })
  );
  const writeError = writeResults.find((result) => result.error)?.error;

  if (writeError) {
    console.error("submitMyCalendarAvailability/write:", writeError);
    return { ok: false, error: "Não foi possível enviar a disponibilidade do mês" };
  }

  const staleIds = (existingRows ?? [])
    .filter((row) => !desiredDates.has(row.availability_date))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("member_availability_calendar")
      .delete()
      .eq("church_id", d.churchId)
      .eq("user_id", user.id)
      .in("id", staleIds);

    if (deleteError) {
      console.error("submitMyCalendarAvailability/delete:", deleteError);
      return { ok: false, error: "Não foi possível limpar as datas removidas" };
    }
  }

  if (d.ministryId) {
    const { error: submissionError } = await supabase
      .from("member_availability_month_submissions")
      .upsert(
        {
          church_id: d.churchId,
          ministry_id: d.ministryId,
          campus_id: d.campusId,
          user_id: user.id,
          month_start: monthStart,
          period: d.period,
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "church_id,ministry_id,user_id,campus_id,month_start,period",
        }
      );

    if (submissionError) {
      console.error("submitMyCalendarAvailability/submission:", submissionError);
      return { ok: false, error: "As datas foram salvas, mas não foi possível confirmar o mês" };
    }
  }

  revalidateAvailability(d.churchSlug);
  return { ok: true, data: undefined };
}

const recurringSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid().nullable(),
  campusId: z.string().uuid().nullable(),
  weekday: z.number().int().min(0).max(6),
  period: periodSchema,
  status: statusSchema,
});

export async function setMyRecurringAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = recurringSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Regra recorrente inválida" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const baseDelete = supabase
    .from("member_availability_recurring")
    .delete()
    .eq("church_id", d.churchId)
    .eq("user_id", user.id)
    .eq("weekday", d.weekday)
    .eq("period", d.period);
  const ministryDelete = scopeNullable(baseDelete, "ministry_id", d.ministryId);
  const { error: deleteError } = await scopeNullable(ministryDelete, "campus_id", d.campusId);
  if (deleteError) return { ok: false, error: "Não foi possível atualizar a recorrência" };

  const { error } = await supabase.from("member_availability_recurring").insert({
    church_id: d.churchId,
    ministry_id: d.ministryId,
    campus_id: d.campusId,
    user_id: user.id,
    weekday: d.weekday,
    period: d.period,
    status: d.status,
  });
  if (error) {
    console.error("setMyRecurringAvailability:", error);
    return { ok: false, error: "Não foi possível salvar a recorrência" };
  }

  revalidateAvailability(d.churchSlug);
  return { ok: true, data: undefined };
}

export async function clearMyRecurringAvailability(raw: unknown): Promise<ActionResult> {
  const parsed = recurringSchema.omit({ status: true }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sua sessão expirou" };

  const baseDelete = supabase
    .from("member_availability_recurring")
    .delete()
    .eq("church_id", d.churchId)
    .eq("user_id", user.id)
    .eq("weekday", d.weekday)
    .eq("period", d.period);
  const ministryDelete = scopeNullable(baseDelete, "ministry_id", d.ministryId);
  const { error } = await scopeNullable(ministryDelete, "campus_id", d.campusId);
  if (error) return { ok: false, error: "Não foi possível limpar a recorrência" };

  revalidateAvailability(d.churchSlug);
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

  revalidateAvailability(d.churchSlug);
  return { ok: true, data: { requestId: String(requestId) } };
}
