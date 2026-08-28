import { createClient } from "@/lib/supabase/server";

export type InfantilMinistry = { id: string; name: string };

/**
 * O módulo Kids aceita os nomes históricos "Infantil" e "Crianças".
 * A rota interna continua /infantil por compatibilidade.
 */
export async function getInfantilMinistry(
  churchId: string
): Promise<InfantilMinistry | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ministries")
    .select("id, name")
    .eq("church_id", churchId)
    .or("slug.eq.kids,slug.eq.infantil,slug.eq.criancas,name.ilike.%kids%,name.ilike.%infantil%,name.ilike.%crianças%,name.ilike.%criancas%")
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

/** Idade em meses (para sugerir a turma). */
export function ageInMonths(birthDate: string, ref = new Date()): number {
  const b = new Date(birthDate + "T00:00:00");
  let m = (ref.getFullYear() - b.getFullYear()) * 12 + (ref.getMonth() - b.getMonth());
  if (ref.getDate() < b.getDate()) m -= 1;
  return Math.max(0, m);
}

export function formatAge(birthDate: string): string {
  const m = ageInMonths(birthDate);
  const anos = Math.floor(m / 12);
  const meses = m % 12;
  if (anos === 0) return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  return meses === 0 ? `${anos} ${anos === 1 ? "ano" : "anos"}` : `${anos}a ${meses}m`;
}

export type ChildClass = {
  id: string;
  name: string;
  min_age_months: number;
  max_age_months: number;
};

/** Sugere a turma pela idade; null se nenhuma faixa cobre. */
export function suggestClass(birthDate: string, classes: ChildClass[]): ChildClass | null {
  const m = ageInMonths(birthDate);
  return (
    classes.find((c) => m >= c.min_age_months && m <= c.max_age_months) ?? null
  );
}
