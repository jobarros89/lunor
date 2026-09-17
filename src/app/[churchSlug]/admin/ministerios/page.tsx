import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { MinistriesTeamsManager } from "@/components/admin/ministries-teams-manager";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

export default async function MinistriesAndTeamsPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isCoord) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const churchId = tenant.church.id;
  const [
    { data: ministries, error: ministriesError },
    { data: teams, error: teamsError },
    { data: functions, error: functionsError },
  ] = await Promise.all([
    supabase
      .from("ministries")
      .select("id, name, module_key, active")
      .eq("church_id", churchId)
      .order("active", { ascending: false })
      .order("name"),
    supabase
      .from("departments")
      .select("id, ministry_id, name, active")
      .eq("church_id", churchId)
      .order("active", { ascending: false })
      .order("name"),
    supabase
      .from("team_functions")
      .select("id, ministry_id, department_id, name, active")
      .eq("church_id", churchId)
      .order("active", { ascending: false })
      .order("name"),
  ]);

  if (ministriesError || teamsError || functionsError) {
    throw new Error("Não foi possível carregar os ministérios e times");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Ministérios e times</>}
        eyebrow={<>Configurações</>}
        description={<>Organize as áreas, os times e as funções usadas nas escalas.</>}
      />
      <MinistriesTeamsManager
        churchSlug={churchSlug}
        churchId={churchId}
        ministries={ministries ?? []}
        teams={teams ?? []}
        functions={functions ?? []}
      />
    </div>
  );
}
