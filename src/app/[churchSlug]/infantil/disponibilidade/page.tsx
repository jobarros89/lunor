import { redirect } from "next/navigation";
import DisponibilidadePage from "../../disponibilidade/page";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";

export default async function KidsAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<{ view?: "mine" | "team" }>;
}) {
  const [{ churchSlug }, query] = await Promise.all([params, searchParams]);
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);

  if (!kids) redirect(`/${churchSlug}/infantil`);

  return DisponibilidadePage({
    params: Promise.resolve({ churchSlug }),
    searchParams: Promise.resolve({ ministry: kids.id, module: "kids", view: query.view }),
  });
}
