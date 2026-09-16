"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parseAppLocalDateTime } from "@/lib/local-datetime";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "./types";

const eventSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  typeId: z.string().uuid().nullable().default(null),
  ministryId: z.string().uuid().nullable().default(null),
  campusId: z.string().uuid().nullable().default(null),
  servicePeriod: z.enum(["manha", "tarde", "noite"]).nullable().default(null),
  title: z.string().min(2, "Informe o título").max(120),
  description: z.string().max(2000).default(""),
  location: z.string().max(200).default(""),
  mapUrl: z.string().max(500).default(""),
  script: z.string().max(5000).default(""),
  startsAt: z.string().min(10, "Informe a data e hora"),
  endsAt: z.string().default(""),
  redirectContext: z.enum(["louvor", "kids"]).nullable().default(null),
});

export async function createEventWithContext(raw: unknown): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(raw);
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

  let canCreate =
    Boolean(isMaster) ||
    churchMembership?.role === "admin" ||
    churchMembership?.role === "coordenador";

  if (d.ministryId) {
    const { data: ministry } = await supabase
      .from("ministries")
      .select("id")
      .eq("id", d.ministryId)
      .eq("church_id", d.churchId)
      .maybeSingle();

    if (!ministry) return { ok: false, error: "Ministério inválido" };

    if (!canCreate) {
      const { data: ministryMembership } = await supabase
        .from("ministry_members")
        .select("role")
        .eq("church_id", d.churchId)
        .eq("ministry_id", d.ministryId)
        .eq("user_id", user.id)
        .eq("active", true)
        .maybeSingle();

      canCreate =
        ministryMembership?.role === "gerente" ||
        ministryMembership?.role === "lider";
    }
  }

  if (!canCreate) {
    return {
      ok: false,
      error: "Apenas Admin, Coordenador, Gerente ou Líder podem criar esta escala",
    };
  }

  let campusName: string | null = null;
  if (d.campusId) {
    const { data: campus, error: campusError } = await supabase
      .from("campuses")
      .select("name")
      .eq("id", d.campusId)
      .eq("church_id", d.churchId)
      .eq("active", true)
      .maybeSingle();
    if (campusError || !campus) {
      return { ok: false, error: "Campus inválido ou inativo" };
    }
    campusName = campus.name;
  }

  const { data: created, error } = await supabase
    .from("events")
    .insert({
      church_id: d.churchId,
      type_id: d.typeId,
      ministry_id: d.ministryId,
      department_id: null,
      campus_id: d.campusId,
      service_period: d.servicePeriod,
      title: d.title,
      description: d.description || null,
      // Mantém compatibilidade com telas/integrações antigas que ainda leem location.
      location: d.location || campusName || null,
      map_url: d.mapUrl || null,
      script: d.script || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt?.toISOString() ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !created) {
    console.error("createEventWithContext:", error);
    if (error?.code === "42501") {
      return { ok: false, error: "Você não tem permissão para criar este evento" };
    }
    if (error?.message?.includes("events_time_order")) {
      return { ok: false, error: "O horário de término precisa ser posterior ao horário de início" };
    }
    return { ok: false, error: "Não foi possível criar o evento" };
  }

  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/louvor/escalas`);
  revalidatePath(`/${d.churchSlug}/infantil/escalas`);
  revalidatePath(`/${d.churchSlug}/infantil`);

  if (d.redirectContext === "louvor") {
    redirect(`/${d.churchSlug}/louvor/escalas/${created.id}`);
  }
  if (d.redirectContext === "kids") {
    redirect(`/${d.churchSlug}/infantil/escalas/${created.id}`);
  }

  redirect(`/${d.churchSlug}/escalas/${created.id}`);
}
