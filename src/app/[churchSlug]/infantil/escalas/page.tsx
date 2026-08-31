import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { MinistryScheduleList } from "@/components/escalas/ministry-schedule-list";
import { Button } from "@/components/ui/button";

export default async function KidsEscalasPage({
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

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            LUNOR Kids
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Escalas do Kids</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Equipe, confirmações e pendências do Kids separadas da operação de recepção.
          </p>
        </div>

        {canCreate && (
          <Button
            className="h-11 rounded-full px-5"
            nativeButton={false}
            render={<Link href={`/${churchSlug}/infantil/escalas/nova`} />}
          >
            <Plus className="size-4" />
            Nova escala
          </Button>
        )}
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
