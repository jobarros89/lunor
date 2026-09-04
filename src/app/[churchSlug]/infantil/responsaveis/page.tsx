import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { GuardianInvitePanel } from "@/components/infantil/guardian-invite-panel";
import { Card, CardContent } from "@/components/ui/card";

export default async function ResponsaveisPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) redirect(`/${churchSlug}/infantil`);

  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  if (!tenant.isCoord) {
    const { data: membership } = await supabase
      .from("ministry_members")
      .select("id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministry.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();
    if (!membership) redirect(`/${churchSlug}`);
  }

  const { data: guardians } = await supabase
    .from("guardians")
    .select("id, full_name, user_id")
    .eq("church_id", tenant.church.id)
    .eq("ministry_id", ministry.id)
    .order("full_name");

  const rows = (guardians ?? []).map((guardian) => ({
    id: guardian.id,
    fullName: guardian.full_name,
    userId: guardian.user_id,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LUNOR Kids
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Responsáveis</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Gere o acesso familiar para pais e responsáveis. Eles podem usar o QR Code ou o link para criar uma conta ou entrar no LUNOR Kids.
        </p>
      </div>

      <Card className="rounded-3xl border-[#6e5ce6]/20 bg-[#6e5ce6]/5 shadow-none">
        <CardContent className="flex gap-3 py-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#6e5ce6]" />
          <div className="text-sm">
            <p className="font-medium">Acesso restrito à família</p>
            <p className="mt-1 text-muted-foreground">
              O convite vincula a conta ao responsável selecionado. A família vê somente as crianças associadas ao próprio vínculo.
            </p>
          </div>
        </CardContent>
      </Card>

      <GuardianInvitePanel churchSlug={churchSlug} guardians={rows} />
    </div>
  );
}
