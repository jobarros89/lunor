import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";

export default async function KidsAvailabilityPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);

  if (!kids) redirect(`/${churchSlug}/infantil`);
  redirect(`/${churchSlug}/disponibilidade?ministry=${kids.id}`);
}
