import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry } from "@/lib/infantil";
import { ChildForm } from "@/components/infantil/child-form";

export default async function NovaCriancaPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  // Momento da renderização no servidor; usado somente para resolver a sessão atual.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { data: events } = await supabase
    .from("events")
    .select("id, starts_at, ends_at")
    .eq("church_id", tenant.church.id)
    .gte("starts_at", new Date(now - 6 * 60 * 60 * 1000).toISOString())
    .order("starts_at")
    .limit(8);

  const operational = (events ?? []).find((event) => {
    const startsAt = new Date(event.starts_at).getTime();
    const endsAt = event.ends_at
      ? new Date(event.ends_at).getTime()
      : startsAt + 4 * 60 * 60 * 1000;
    return now >= startsAt - 90 * 60 * 1000 && now <= endsAt + 60 * 60 * 1000;
  });
  if (!operational) redirect(`/${churchSlug}/infantil`);

  const { data: canOperate } = await supabase.rpc("can_operate_kids", {
    p_church: tenant.church.id,
    p_ministry: ministry.id,
    p_event: operational.id,
  });
  if (!canOperate) redirect(`/${churchSlug}/infantil`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cadastrar criança</h1>
        <p className="text-muted-foreground">
          Só o necessário para cuidar bem e com segurança.
        </p>
      </div>
      <ChildForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
        eventId={operational.id}
      />
    </div>
  );
}
