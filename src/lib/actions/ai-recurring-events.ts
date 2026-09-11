"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { humanReviewSchema, recurringReviewSnapshot, REVIEW_REQUIRED, REVIEW_CHANGED } from "@/lib/ai/human-review";
import {
  localClockKey,
  localDateKey,
  localWeekdayIndex,
} from "@/lib/ai/recurring-events";
import { createClient } from "@/lib/supabase/server";
import { getTenant } from "@/lib/tenant";
import type { ActionResult } from "@/lib/actions/types";

const schema = z.object({
  review: humanReviewSchema,
  churchSlug: z.string().trim().min(2).max(100),
  templateEventId: z.string().uuid(),
  startsAt: z
    .array(z.string().datetime({ offset: true }))
    .min(1)
    .max(60)
    .refine((items) => new Set(items).size === items.length, {
      message: "A proposta contém datas repetidas",
    }),
});

type TemplateEvent = {
  id: string;
  church_id: string;
  type_id: string | null;
  ministry_id: string | null;
  department_id: string | null;
  campus_id: string | null;
  service_period: "manha" | "tarde" | "noite" | null;
  title: string;
  description: string | null;
  location: string | null;
  map_url: string | null;
  script: string | null;
  starts_at: string;
  ends_at: string | null;
};

async function canCreateFromTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  churchId: string,
  ministryId: string | null
) {
  const [{ data: isMaster }, { data: churchMembership }] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    supabase
      .from("church_members")
      .select("role")
      .eq("church_id", churchId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  if (
    isMaster ||
    churchMembership?.role === "admin" ||
    churchMembership?.role === "coordenador"
  ) {
    return true;
  }
  if (!ministryId) return false;

  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("church_id", churchId)
    .eq("ministry_id", ministryId)
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  return membership?.role === "gerente" || membership?.role === "lider";
}

export async function confirmAssistantRecurringEvents(
  raw: unknown
): Promise<ActionResult<{ created: number; skippedExisting: number; eventIds: string[] }>> {
  const review = humanReviewSchema.safeParse((raw as { review?: unknown } | null)?.review);
  if (!review.success) return { ok: false, error: REVIEW_REQUIRED };
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Proposta de cultos inválida" };
  const d = parsed.data;

  const tenant = await getTenant(d.churchSlug);
  if (tenant.guardianOnly) return { ok: false, error: "Sem permissão para criar cultos" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login novamente para continuar" };

  const { data: templateData, error: templateError } = await supabase
    .from("events")
    .select(
      "id, church_id, type_id, ministry_id, department_id, campus_id, service_period, title, description, location, map_url, script, starts_at, ends_at"
    )
    .eq("id", d.templateEventId)
    .eq("church_id", tenant.church.id)
    .maybeSingle();
  const template = templateData as TemplateEvent | null;
  if (templateError || !template) {
    return { ok: false, error: "O culto usado como modelo não existe mais" };
  }
  if (!template.campus_id || !template.service_period) {
    return { ok: false, error: "O culto modelo precisa ter campus e período definidos" };
  }

  if (
    !(await canCreateFromTemplate(
      supabase,
      user.id,
      tenant.church.id,
      template.ministry_id
    ))
  ) {
    return { ok: false, error: "Sem permissão para criar esta série de cultos" };
  }

  const duration = template.ends_at
    ? Math.max(0, new Date(template.ends_at).getTime() - new Date(template.starts_at).getTime())
    : 0;
  const snapshot = recurringReviewSnapshot({
    templateEventId: template.id, title: template.title,
    campus: { id: template.campus_id }, servicePeriod: template.service_period,
    templateStartsAt: template.starts_at, location: template.location,
    occurrences: d.startsAt.map(startsAt => ({
      startsAt, endsAt: duration ? new Date(new Date(startsAt).getTime() + duration).toISOString() : null,
    })),
  });
  if (d.review.snapshot !== snapshot) return { ok: false, error: REVIEW_CHANGED };

  const templateWeekday = localWeekdayIndex(template.starts_at);
  const templateClock = localClockKey(template.starts_at);
  const today = localDateKey(new Date());
  const requested = d.startsAt
    .map((startsAt) => ({ startsAt, dateKey: localDateKey(startsAt) }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  for (const occurrence of requested) {
    const startsAt = new Date(occurrence.startsAt);
    if (Number.isNaN(startsAt.getTime())) {
      return { ok: false, error: "Uma das datas da proposta ficou inválida. Gere a série novamente." };
    }
    if (occurrence.dateKey < today) {
      return { ok: false, error: "A proposta contém uma data que já passou. Gere a série novamente." };
    }
    if (
      localWeekdayIndex(startsAt) !== templateWeekday ||
      localClockKey(startsAt) !== templateClock
    ) {
      return {
        ok: false,
        error: "A proposta não corresponde mais ao padrão do culto modelo. Gere a série novamente.",
      };
    }
  }

  const first = new Date(requested[0].startsAt);
  const last = new Date(requested[requested.length - 1].startsAt);
  const rangeStart = new Date(first.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(last.getTime() + 36 * 60 * 60 * 1000).toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("events")
    .select("starts_at")
    .eq("church_id", tenant.church.id)
    .eq("campus_id", template.campus_id)
    .eq("service_period", template.service_period)
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd);
  if (existingError) {
    return { ok: false, error: "Não foi possível verificar os cultos que já existem" };
  }
  const existingDates = new Set((existing ?? []).map((event) => localDateKey(event.starts_at)));
  const missing = requested.filter((occurrence) => !existingDates.has(occurrence.dateKey));
  const skippedExisting = requested.length - missing.length;

  if (missing.length === 0) {
    return { ok: true, data: { created: 0, skippedExisting, eventIds: [] } };
  }

  const durationMs = template.ends_at
    ? Math.max(0, new Date(template.ends_at).getTime() - new Date(template.starts_at).getTime())
    : null;
  const rows = missing.map((occurrence) => {
    const startsAt = new Date(occurrence.startsAt);
    return {
      church_id: tenant.church.id,
      type_id: template.type_id,
      ministry_id: template.ministry_id,
      department_id: template.department_id,
      campus_id: template.campus_id,
      service_period: template.service_period,
      title: template.title,
      description: template.description,
      location: template.location,
      map_url: template.map_url,
      script: template.script,
      starts_at: startsAt.toISOString(),
      ends_at: durationMs
        ? new Date(startsAt.getTime() + durationMs).toISOString()
        : null,
      created_by: user.id,
    };
  });

  const { data: created, error: insertError } = await supabase
    .from("events")
    .insert(rows)
    .select("id");
  if (insertError) {
    console.error("confirmAssistantRecurringEvents:", insertError.code, insertError.message);
    if (insertError.code === "42501") {
      return { ok: false, error: "Você não tem permissão para criar estes cultos" };
    }
    return { ok: false, error: "Não foi possível criar a série de cultos" };
  }

  revalidatePath(`/${d.churchSlug}`);
  revalidatePath(`/${d.churchSlug}/assistente`);
  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/louvor/escalas`);
  revalidatePath(`/${d.churchSlug}/infantil/escalas`);
  revalidatePath(`/${d.churchSlug}/infantil`);

  return {
    ok: true,
    data: {
      created: created?.length ?? 0,
      skippedExisting,
      eventIds: (created ?? []).map((event) => event.id),
    },
  };
}

