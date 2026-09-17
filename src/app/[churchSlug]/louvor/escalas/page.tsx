import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import { MinistryScheduleList } from "@/components/escalas/ministry-schedule-list";
import { Button } from "@/components/ui/button";

export default async function LouvorEscalasPage({
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

  return (
    <div className="space-y-8">
      <PageHeader
        title={<>Escalas do Louvor</>}
        eyebrow={<>Ministério de música</>}
        description={
          <>
            Equipe, confirmações e pendências do Louvor separadas da visão geral
            do culto.
          </>
        }
        actions={
          <>
            {canCreate && (
              <Button
                className="px-5"
                nativeButton={false}
                render={<Link href={`/${churchSlug}/louvor/escalas/nova`} />}
              >
                <Plus className="size-4" />
                Nova escala
              </Button>
            )}
          </>
        }
      />

      <MinistryScheduleList
        churchSlug={churchSlug}
        ministryId={louvor.id}
        ministryName="Louvor"
        detailBaseHref={`/${churchSlug}/louvor/escalas`}
      />
    </div>
  );
}
