import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { MinistryEventSchedule } from "@/components/escalas/ministry-event-schedule";
import { WhatsAppPublishControl } from "@/components/escalas/whatsapp-publish-control";

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
    <>
      <WhatsAppPublishControl
        churchSlug={churchSlug}
        ministryId={kids.id}
        eventId={eventId}
      />
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
    </>
  );
}
