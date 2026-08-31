import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { MinistryScheduleList } from "@/components/escalas/ministry-schedule-list";

export default async function LouvorEscalasPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Ministério de música
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Escalas do Louvor</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Equipe, confirmações e pendências do Louvor separadas da visão geral do culto.
        </p>
      </header>

      <MinistryScheduleList
        churchSlug={churchSlug}
        ministryId={louvor.id}
        ministryName="Louvor"
        detailBaseHref={`/${churchSlug}/louvor/escalas`}
      />
    </div>
  );
}
