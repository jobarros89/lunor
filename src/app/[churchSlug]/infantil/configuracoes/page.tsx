import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { kidsPrintSettingsFromRow } from "@/lib/kids-print-settings";
import { KidsClassSettingsForm } from "@/components/infantil/kids-class-settings-form";
import { KidsPrintSettingsForm } from "@/components/infantil/kids-print-settings-form";

export default async function KidsPrintSettingsPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry || tenant.guardianOnly) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("church_id", tenant.church.id)
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();

  const canManage =
    tenant.isCoord || membership?.role === "gerente" || membership?.role === "lider";
  if (!canManage) redirect(`/${churchSlug}/infantil`);

  const [{ data: row }, { data: classes }] = await Promise.all([
    supabase
      .from("kids_print_settings")
      .select(
        "print_mode, label_width_mm, label_height_mm, margin_mm, orientation, copies, qr_enabled"
      )
      .eq("ministry_id", ministry.id)
      .maybeSingle(),
    supabase
      .from("child_classes")
      .select("id, name, min_age_months, max_age_months, sort_order")
      .eq("ministry_id", ministry.id)
      .order("sort_order")
      .order("name"),
  ]);

  const settings = kidsPrintSettingsFromRow(row);
  const classRows = (classes ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    minAgeMonths: item.min_age_months,
    maxAgeMonths: item.max_age_months,
  }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kids · Configurações
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Configurações do Kids
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Personalize as turmas e ajuste a impressão usada na operação do Kids.
        </p>
      </div>

      <KidsClassSettingsForm
        churchSlug={churchSlug}
        ministryId={ministry.id}
        initialClasses={classRows}
      />

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Impressão de etiquetas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Defina o formato usado no check-in. O modo Universal continua sendo a opção compatível com o diálogo de impressão do dispositivo.
          </p>
        </div>
        <KidsPrintSettingsForm
          churchSlug={churchSlug}
          ministryId={ministry.id}
          initialSettings={settings}
        />
      </section>
    </div>
  );
}
