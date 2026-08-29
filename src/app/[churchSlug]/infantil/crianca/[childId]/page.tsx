import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry } from "@/lib/infantil";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChildEditPanel } from "@/components/infantil/child-edit-panel";
import { GuardianAccountLink } from "@/components/infantil/guardian-account-link";

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
  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();
  const canManage = tenant.isCoord || membership?.role === "gerente" || membership?.role === "lider";
  if (!canManage) redirect(`/${churchSlug}/infantil`);

  const [
    { data: child },
    { data: links },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("children")
      .select("id, full_name, birth_date, allergies, health_notes, special_needs, emergency_contact_name, emergency_contact_phone, photo_consent")
      .eq("id", childId)
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministry.id)
      .maybeSingle(),
    supabase
      .from("child_guardians")
      .select("guardian_id, relationship, can_pickup, is_primary, guardians!inner(id, full_name, phone, user_id)")
      .eq("child_id", childId)
      .eq("church_id", tenant.church.id),
    supabase
      .from("church_members")
      .select("user_id, profiles!inner(full_name)")
      .eq("church_id", tenant.church.id)
      .eq("status", "active"),
  ]);

  if (!child) notFound();

  const guardians = (links ?? []).map((link) => {
    const guardian = link.guardians as unknown as {
      id: string;
      full_name: string;
      phone: string | null;
      user_id: string | null;
    };
    return {
      id: guardian.id,
      fullName: guardian.full_name,
      phone: guardian.phone,
      userId: guardian.user_id,
      relationship: link.relationship,
      canPickup: link.can_pickup,
      isPrimary: link.is_primary,
    };
  });

  const accountRows = (members ?? [])
    .map((member) => ({
      id: member.user_id,
      fullName: (member.profiles as unknown as { full_name: string }).full_name,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kids · Cadastro</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{child.full_name}</h1>
        <p className="text-muted-foreground">Edite os dados e gerencie os responsáveis desta criança.</p>
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

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Responsáveis cadastrados</CardTitle>
          <CardDescription>{guardians.length} responsável(is) vinculado(s) a esta criança</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {guardians.map((guardian) => (
            <div key={guardian.id} className="rounded-2xl border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{guardian.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {guardian.relationship || "Parentesco não informado"}
                    {guardian.phone ? ` · ${guardian.phone}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  {guardian.isPrimary && <span className="rounded-full bg-muted px-2 py-1">Principal</span>}
                  <span className="rounded-full bg-muted px-2 py-1">
                    {guardian.canPickup ? "Pode retirar" : "Sem retirada"}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {guardians.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum responsável vinculado.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Conta LUNOR dos responsáveis</CardTitle>
          <CardDescription>
            Vincule quem tiver conta na igreja para receber os chamados do Kids no próprio celular.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GuardianAccountLink
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            ministryId={ministry.id}
            guardians={guardians.map((guardian) => ({
              id: guardian.id,
              fullName: guardian.fullName,
              userId: guardian.userId,
            }))}
            accounts={accountRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
