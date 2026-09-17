import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { EventScheduleForm } from "@/components/escalas/event-schedule-form";

export default async function EditarHorarioEventoPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader && !tenant.isCoord) redirect(`/${churchSlug}/escalas/${id}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, title, starts_at, ends_at")
    .eq("id", id)
    .eq("church_id", tenant.church.id)
    .maybeSingle();

  if (!event) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="page-title ">Editar data e horário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Corrija o horário do culto sem recriar o evento ou perder as escalas existentes.
        </p>
      </div>

      <EventScheduleForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        eventId={event.id}
        eventTitle={event.title}
        initialStartsAt={event.starts_at}
        initialEndsAt={event.ends_at}
      />
    </div>
  );
}
