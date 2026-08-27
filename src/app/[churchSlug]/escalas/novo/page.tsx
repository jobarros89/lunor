import Link from "next/link";
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
  const [{ data: eventTypes }, { data: ministries }, { data: departments }] =
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
        .from("departments")
        .select("id, name, ministry_id")
        .eq("church_id", tenant.church.id)
        .eq("active", true)
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Novo evento</h1>
          <p className="text-muted-foreground">
            Culto, conferência, ensaio, reunião…
          </p>
        </div>
        <Link
          href={`/${churchSlug}/onde-servir`}
          className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Configurar “Onde servir?”
        </Link>
      </div>
      <EventForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        eventTypes={eventTypes ?? []}
        ministries={ministries ?? []}
        departments={departments ?? []}
      />
    </div>
  );
}
