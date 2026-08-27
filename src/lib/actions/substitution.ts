"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const schema = z.object({
  churchSlug: z.string().min(2),
  eventId: z.string().uuid(),
  assignmentId: z.string().uuid(),
  replacementUserId: z.string().uuid(),
});

type ResolveSubstitutionResult = {
  newAssignmentId: string;
  replacementName: string | null;
};

export async function resolveSubstitution(raw: unknown): Promise<ActionResult<ResolveSubstitutionResult>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Dados inválidos" };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: newAssignmentId, error } = await supabase.rpc("resolve_assignment_substitution", {
    p_assignment_id: d.assignmentId,
    p_replacement_user_id: d.replacementUserId,
  });

  if (error || !newAssignmentId) {
    const message = error?.message ?? "";
    if (message.includes("unavailable")) return { ok: false, error: "Essa pessoa está indisponível nesta data" };
    if (message.includes("already assigned")) return { ok: false, error: "Essa pessoa já está escalada neste culto" };
    if (message.includes("active in ministry")) return { ok: false, error: "Essa pessoa não está ativa nesta equipe" };
    return { ok: false, error: "Não foi possível concluir a substituição" };
  }

  const [{ data: replacement }, { data: assignment }, { data: event }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", d.replacementUserId).maybeSingle(),
    supabase.from("assignments").select("role_name").eq("id", newAssignmentId).maybeSingle(),
    supabase.from("events").select("title").eq("id", d.eventId).maybeSingle(),
  ]);

  await notifyUsers([d.replacementUserId], {
    title: "Você foi chamado para substituir",
    body: `${assignment?.role_name ?? "Escala"}${event?.title ? ` · ${event.title}` : ""}`,
    url: `/${d.churchSlug}/escalas/${d.eventId}`,
    tag: `replacement-${newAssignmentId}`,
  });

  revalidatePath(`/${d.churchSlug}`);
  revalidatePath(`/${d.churchSlug}/escalas`);
  revalidatePath(`/${d.churchSlug}/escalas/${d.eventId}`);
  return { ok: true, data: { newAssignmentId, replacementName: replacement?.full_name ?? null } };
}
