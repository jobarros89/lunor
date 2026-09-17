import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import {
  MinistryEventPicker,
  type MinistryEventPickerRow,
} from "@/components/escalas/ministry-event-picker";

export default async function NovaEscalaKidsPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);
  if (!kids) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  let canCreate = tenant.isCoord;

  if (!canCreate) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", kids.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();

    canCreate = membership?.role === "gerente" || membership?.role === "lider";
  }

  if (!canCreate) redirect(`/${churchSlug}/infantil/escalas`);

  const { data: events } = await supabase
    .from("events")
    .select("id, title, starts_at, location, service_period, campuses(name)")
    .eq("church_id", tenant.church.id)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(30);

  return (
    <div className="space-y-6">
      <Link
        href={`/${churchSlug}/infantil/escalas`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Escalas do Kids
      </Link>

      <PageHeader
        title={<>Adicionar escala do Kids</>}
        eyebrow={<>LUNOR Kids</>}
        description={
          <>
            Escolha um culto existente. O horário do Kids será configurado
            dentro dele, sem criar um evento duplicado.
          </>
        }
      />

      <MinistryEventPicker
        churchSlug={churchSlug}
        ministryName="Kids"
        events={(events ?? []) as unknown as MinistryEventPickerRow[]}
        detailBaseHref={`/${churchSlug}/infantil/escalas`}
      />
    </div>
  );
}
