import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { KidsSectionNav } from "@/components/infantil/kids-section-nav";
import { KidsReceptionBar } from "@/components/infantil/kids-reception-bar";

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

  if (!kids || tenant.guardianOnly) return children;

  const supabase = await createClient();
  let canManageSettings = tenant.isCoord;

  if (!tenant.isCoord) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", kids.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();

    if (!membership) return children;
    canManageSettings = membership.role === "gerente" || membership.role === "lider";
  }

  const { data: receptionRows } = await supabase.rpc("current_kids_reception", {
    p_church: tenant.church.id,
    p_ministry: kids.id,
  });
  const reception = receptionRows?.[0] ?? null;

  return (
    <div className="space-y-6">
      <KidsSectionNav
        churchSlug={churchSlug}
        canManageSettings={canManageSettings}
      />
      <KidsReceptionBar
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={kids.id}
        canManageReception={canManageSettings}
        activeReception={
          reception
            ? {
                sessionId: reception.session_id,
                title: reception.title,
                eventId: reception.event_id,
                openedAt: reception.opened_at,
              }
            : null
        }
      />
      {children}
    </div>
  );
}
