import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import { LouvorSectionNav } from "@/components/louvor/louvor-section-nav";

export default async function LouvorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);

  if (!louvor) redirect(`/${churchSlug}`);

  if (!tenant.isCoord) {
    const supabase = await createClient();
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();

    if (!membership) redirect(`/${churchSlug}`);
  }

  return (
    <div className="space-y-6">
      <LouvorSectionNav churchSlug={churchSlug} />
      {children}
    </div>
  );
}
