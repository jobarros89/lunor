import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { MinistryEventSchedule } from "@/components/escalas/ministry-event-schedule";
import { LouvorSectionNav } from "@/components/louvor/louvor-section-nav";

export default async function LouvorEscalaDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; eventId: string }>;
}) {
  const { churchSlug, eventId } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  return (
    <div className="space-y-8">
      <LouvorSectionNav churchSlug={churchSlug} active="escalas" />
      <MinistryEventSchedule
        churchSlug={churchSlug}
        ministryId={louvor.id}
        ministryName="Louvor"
        eventId={eventId}
        backHref={`/${churchSlug}/louvor/escalas`}
        backLabel="Escalas do Louvor"
      />
    </div>
  );
}
