"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
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
});

export async function createEventWithContext(raw: unknown): Promise<ActionResult> {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
      starts_at: new Date(d.startsAt).toISOString(),
      ends_at: d.endsAt ? new Date(d.endsAt).toISOString() : null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !created) return { ok: false, error: "Sem permissão para criar eventos" };

  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/infantil`);
  redirect(`/${d.churchSlug}/escalas/${created.id}`);
}
