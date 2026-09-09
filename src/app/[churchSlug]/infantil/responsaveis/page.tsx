import { redirect } from "next/navigation";
import { Link2, ShieldCheck } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { GuardianInvitePanel } from "@/components/infantil/guardian-invite-panel";
import { GuardianAccountLink } from "@/components/infantil/guardian-account-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  const [{ data: guardians }, { data: members }] = await Promise.all([
    supabase
      .from("guardians")
      .select("id, full_name, user_id, email")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", ministry.id)
      .order("full_name"),
    supabase
      .from("church_members")
      .select("user_id, profiles!inner(full_name)")
      .eq("church_id", tenant.church.id)
      .eq("status", "active"),
  ]);

  const rows = (guardians ?? []).map((guardian) => ({
    id: guardian.id,
    fullName: guardian.full_name,
    userId: guardian.user_id,
    email: guardian.email,
  }));

  const accountRows = (members ?? [])
    .map((member) => ({
      id: member.user_id,
      fullName: (member.profiles as unknown as { full_name: string }).full_name,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  const guardianAccountRows = rows.map((guardian) => ({
    id: guardian.id,
    fullName: guardian.fullName,
    userId: guardian.userId,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LUNOR Kids
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Responsáveis</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Gere o acesso familiar para pais e responsáveis ou vincule uma conta LUNOR já existente.
        </p>
      </div>

      <Card className="rounded-3xl border-[#6e5ce6]/20 bg-[#6e5ce6]/5 shadow-none">
        <CardContent className="flex gap-3 py-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#6e5ce6]" />
          <div className="text-sm">
            <p className="font-medium">Acesso restrito à família</p>
            <p className="mt-1 text-muted-foreground">
              O convite ou vínculo associa a conta ao responsável selecionado. A família vê somente as crianças associadas ao próprio vínculo.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Gerar acesso familiar</h2>
          <p className="text-sm text-muted-foreground">
            Gere QR Code e link para quem ainda não possui uma conta LUNOR vinculada.
          </p>
        </div>
        <GuardianInvitePanel churchSlug={churchSlug} guardians={rows} />
      </section>

      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Link2 className="size-5" />
            </span>
            <div>
              <CardTitle className="text-base">Vincular conta existente</CardTitle>
              <CardDescription className="mt-1">
                Use quando o responsável já possui uma conta LUNOR ativa nesta igreja.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <GuardianAccountLink
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            ministryId={ministry.id}
            guardians={guardianAccountRows}
            accounts={accountRows}
            showInvites={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
