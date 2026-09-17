import { notFound, redirect } from "next/navigation";
import { MinistryEventSchedule } from "@/components/escalas/ministry-event-schedule";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";

export default async function GenericTeamSchedulePage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string; ministryId: string }>;
}) {
  const { churchSlug, id: eventId, ministryId } = await params;
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();

  const [{ data: ministry }, { data: linked }] = await Promise.all([
    supabase
      .from("ministries")
      .select("id, name, module_key")
      .eq("id", ministryId)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("event_ministries")
      .select("event_id")
      .eq("church_id", tenant.church.id)
      .eq("event_id", eventId)
      .eq("ministry_id", ministryId)
      .maybeSingle(),
  ]);

  if (!ministry || !linked) notFound();
  if (ministry.module_key === "worship") {
    redirect(`/${churchSlug}/louvor/escalas/${eventId}`);
  }
  if (ministry.module_key === "kids") {
    redirect(`/${churchSlug}/infantil/escalas/${eventId}`);
  }

  return (
    <MinistryEventSchedule
      churchSlug={churchSlug}
      ministryId={ministry.id}
      ministryName={ministry.name}
      eventId={eventId}
      backHref={`/${churchSlug}/escalas/${eventId}`}
      backLabel="Voltar ao culto"
    />
  );
}
