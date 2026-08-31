import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { MinistryEventSchedule } from "@/components/escalas/ministry-event-schedule";
import { KidsSectionNav } from "@/components/infantil/kids-section-nav";

export default async function KidsEscalaDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; eventId: string }>;
}) {
  const { churchSlug, eventId } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids) redirect(`/${churchSlug}`);

  return (
    <div className="space-y-8">
      <KidsSectionNav churchSlug={churchSlug} active="escalas" />
      <MinistryEventSchedule
        churchSlug={churchSlug}
        ministryId={kids.id}
        ministryName="Kids"
        eventId={eventId}
        backHref={`/${churchSlug}/infantil/escalas`}
        backLabel="Escalas do Kids"
        actionHref={`/${churchSlug}/infantil/sessao/${eventId}`}
        actionLabel="Abrir recepção"
      />
    </div>
  );
}
