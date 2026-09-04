import { createClient } from "@/lib/supabase/server";
import { buildOnboardingChecklist, type OnboardingChecklist } from "@/lib/onboarding-checklist";

/**
 * O progresso não fica salvo em nenhuma coluna — é sempre calculado a
 * partir do que já existe (gente na igreja, culto, escala, música). Assim
 * ele nunca desalinha da realidade e não exige escrever nada quando o
 * admin completa um passo por fora do checklist.
 */
export async function loadOnboardingChecklist({
  churchId,
  churchSlug,
  initialModules,
}: {
  churchId: string;
  churchSlug: string;
  initialModules: string[];
}): Promise<OnboardingChecklist> {
  const supabase = await createClient();

  const [membersResult, eventsResult, assignmentsResult, songsResult] = await Promise.all([
    supabase
      .from("church_members")
      .select("user_id", { count: "exact", head: true })
      .eq("church_id", churchId)
      .eq("status", "active"),
    supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId),
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("church_id", churchId),
    initialModules.includes("worship")
      ? supabase
          .from("songs")
          .select("id", { count: "exact", head: true })
          .eq("church_id", churchId)
      : Promise.resolve({ count: 0 }),
  ]);

  return buildOnboardingChecklist({
    churchSlug,
    initialModules,
    counts: {
      activeMembers: membersResult.count ?? 0,
      events: eventsResult.count ?? 0,
      assignments: assignmentsResult.count ?? 0,
      songs: songsResult.count ?? 0,
    },
  });
}
