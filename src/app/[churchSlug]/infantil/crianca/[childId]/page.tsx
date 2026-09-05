import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry } from "@/lib/infantil";
import { Button } from "@/components/ui/button";
import { ChildEditPanel } from "@/components/infantil/child-edit-panel";
import { ChildGuardianManager } from "@/components/infantil/child-guardian-manager";

export default async function KidsChildPage({
  params,
}: {
  params: Promise<{ churchSlug: string; childId: string }>;
}) {
  const { churchSlug, childId } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { data: canOperate } = await supabase.rpc("can_operate_kids", {
    p_church: tenant.church.id,
    p_ministry: ministry.id,
    p_event: null,
  });
  if (!canOperate) redirect(`/${churchSlug}/infantil`);

  const [{ data: child }, { data: links }, { data: allGuardians }] = await Promise.all([
    supabase
      .from("children")
      .select("id, full_name, birth_date, allergies, health_notes, special_needs, emergency_contact_name, emergency_contact_phone, photo_consent")
      .eq("id", childId)
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministry.id)
      .maybeSingle(),
    supabase
      .from("child_guardians")
      .select("guardian_id, relationship, can_pickup, is_primary, guardians!inner(id, full_name, email, phone, user_id)")
      .eq("child_id", childId)
      .eq("church_id", tenant.church.id)
      .order("created_at"),
    supabase
      .from("guardians")
      .select("id, full_name, email, phone, user_id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministry.id)
      .order("full_name"),
  ]);

  if (!child) notFound();

  const guardians = (links ?? []).map((link) => {
    const guardian = link.guardians as unknown as {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
      user_id: string | null;
    };
    return {
      id: guardian.id,
      fullName: guardian.full_name,
      email: guardian.email,
      phone: guardian.phone,
      relationship: link.relationship,
      canPickup: link.can_pickup,
      isPrimary: link.is_primary,
      hasAccount: !!guardian.user_id,
    };
  });

  const guardianOptions = (allGuardians ?? []).map((guardian) => ({
    id: guardian.id,
    fullName: guardian.full_name,
    email: guardian.email,
    phone: guardian.phone,
    hasAccount: !!guardian.user_id,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Button
          nativeButton={false}
          variant="ghost"
          className="-ml-3 h-9 rounded-full"
          render={<Link href={`/${churchSlug}/infantil`} />}
        >
          <ArrowLeft className="size-4" />
          Voltar ao Kids
        </Button>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Kids · Cadastro
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{child.full_name}</h1>
          <p className="text-muted-foreground">
            Edite os dados operacionais da criança. Toda alteração fica registrada.
          </p>
        </div>
      </div>

      <ChildEditPanel
        child={{
          id: child.id,
          fullName: child.full_name,
          birthDate: child.birth_date,
          allergies: child.allergies,
          healthNotes: child.health_notes,
          specialNeeds: child.special_needs,
          emergencyName: child.emergency_contact_name,
          emergencyPhone: child.emergency_contact_phone,
          photoConsent: child.photo_consent,
        }}
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
      />

      <ChildGuardianManager
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
        childId={child.id}
        guardians={guardians}
        availableGuardians={guardianOptions}
      />
    </div>
  );
}
