import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Retorna a área configurada para o módulo de repertório. */
export async function getLouvorMinistry(
  churchId: string
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ministries")
    .select("id, name")
    .eq("church_id", churchId)
    .eq("module_key", "worship")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
