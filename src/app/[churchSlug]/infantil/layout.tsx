import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { KidsSectionNav } from "@/components/infantil/kids-section-nav";

export default async function InfantilLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const kids = await getInfantilMinistry(tenant.church.id);

  if (!kids) return children;

  if (!tenant.isCoord) {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", kids.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();

    if (!membership) return children;
  }

  return (
    <div className="space-y-6">
      <KidsSectionNav churchSlug={churchSlug} />
      {children}
    </div>
  );
}
