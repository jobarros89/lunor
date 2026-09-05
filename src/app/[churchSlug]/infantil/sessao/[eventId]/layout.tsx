import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry } from "@/lib/infantil";

export default async function KidsSessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string; eventId: string }>;
}) {
  const { churchSlug, eventId } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { data: opened, error } = await supabase.rpc("open_kids_reception", {
    p_church: tenant.church.id,
    p_ministry: ministry.id,
    p_event: eventId,
  });

  if (error || opened !== true) redirect(`/${churchSlug}/infantil`);

  return children;
}
