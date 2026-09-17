import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/escalas/event-form";

export default async function NovoEventoPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader) redirect(`/${churchSlug}/escalas`);

  const supabase = await createClient();
  const [{ data: eventTypes }, { data: ministries }, { data: campuses }] =
    await Promise.all([
      supabase
        .from("event_types")
        .select("id, name")
        .eq("church_id", tenant.church.id)
        .order("name"),
      supabase
        .from("ministries")
        .select("id, name")
        .eq("church_id", tenant.church.id)
        .order("name"),
      supabase
        .from("campuses")
        .select("id, name")
        .eq("church_id", tenant.church.id)
        .eq("active", true)
        .order("sort_order")
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title ">Novo evento</h1>
        <p className="text-muted-foreground">
          Culto, conferência, ensaio, reunião…
        </p>
      </div>
      <EventForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        eventTypes={eventTypes ?? []}
        ministries={ministries ?? []}
        campuses={campuses ?? []}
      />
    </div>
  );
}
