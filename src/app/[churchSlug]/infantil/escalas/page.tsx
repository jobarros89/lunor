import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { MinistryScheduleList } from "@/components/escalas/ministry-schedule-list";

export default async function KidsEscalasPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids) redirect(`/${churchSlug}`);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          LUNOR Kids
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Escalas do Kids</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Equipe, confirmações e pendências do Kids separadas da operação de recepção.
        </p>
      </header>

      <MinistryScheduleList
        churchSlug={churchSlug}
        ministryId={kids.id}
        ministryName="Kids"
        detailBaseHref={`/${churchSlug}/infantil/escalas`}
      />
    </div>
  );
}
