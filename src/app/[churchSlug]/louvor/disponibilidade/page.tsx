import { redirect } from "next/navigation";
import DisponibilidadePage from "../../disponibilidade/page";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";

export default async function LouvorAvailabilityPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);

  if (!louvor) redirect(`/${churchSlug}`);

  return DisponibilidadePage({
    params: Promise.resolve({ churchSlug }),
    searchParams: Promise.resolve({ ministry: louvor.id, module: "louvor" }),
  });
}
