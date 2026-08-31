import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import { EventForm } from "@/components/escalas/event-form";

export default async function NovaEscalaLouvorPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  let canCreate = tenant.isCoord;

  if (!canCreate) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();

    canCreate = membership?.role === "gerente" || membership?.role === "lider";
  }

  if (!canCreate) redirect(`/${churchSlug}/louvor/escalas`);

  const [{ data: eventTypes }, { data: campuses }] = await Promise.all([
    supabase
      .from("event_types")
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
      <Link
        href={`/${churchSlug}/louvor/escalas`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Escalas do Louvor
      </Link>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Louvor
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nova escala do Louvor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crie o culto ou evento já dentro do contexto do Louvor e depois monte a equipe.
        </p>
      </div>

      <EventForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        eventTypes={eventTypes ?? []}
        ministries={[{ id: louvor.id, name: "Louvor" }]}
        campuses={campuses ?? []}
        initialMinistryId={louvor.id}
        fixedMinistryName="Louvor"
        redirectContext="louvor"
      />
    </div>
  );
}
