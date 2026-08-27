"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  churchId: z.string().uuid(),
  assignmentId: z.string().uuid(),
});

export async function getAssignmentServingArea(raw: unknown) {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Dados inválidos" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("department_id, departments(name)")
    .eq("church_id", parsed.data.churchId)
    .eq("id", parsed.data.assignmentId)
    .maybeSingle();

  if (error) return { ok: false as const, error: "Não foi possível carregar onde servir" };

  return {
    ok: true as const,
    data: {
      departmentId: data?.department_id ?? null,
      departmentName:
        (data?.departments as unknown as { name: string } | null)?.name ?? null,
    },
  };
}
