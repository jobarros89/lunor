import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { createClient } from "@/lib/supabase/server";
import { kidsPrintSettingsFromRow } from "@/lib/kids-print-settings";
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

  const { data: row } = await supabase
    .from("kids_print_settings")
    .select(
      "print_mode, label_width_mm, label_height_mm, margin_mm, orientation, copies, qr_enabled"
    )
    .eq("ministry_id", ministry.id)
    .maybeSingle();

  const settings = kidsPrintSettingsFromRow(row);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Kids · Configurações
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Impressão de etiquetas
        </h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Defina o formato usado no check-in. O modo Universal continua sendo a opção compatível com o diálogo de impressão do dispositivo.
        </p>
      </div>

      <KidsPrintSettingsForm
        churchSlug={churchSlug}
        ministryId={ministry.id}
        initialSettings={settings}
      />
    </div>
  );
}
