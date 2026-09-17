import { PageHeader } from "@/components/ui/page-header";
import { notFound, redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { signedMediaUrl } from "@/lib/media";
import {
  EquipmentForm,
  type EquipmentFormValues,
} from "@/components/equipamentos/equipment-form";

export default async function EditarEquipamentoPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const { data: eq } = await supabase
    .from("equipments")
    .select("*")
    .eq("id", id)
    .eq("church_id", tenant.church.id)
    .maybeSingle();

  if (!eq) notFound();

  // Gestor edita qualquer um; membro comum só o próprio equipamento pessoal.
  const canEdit = tenant.isManager || eq.owner_id === tenant.userId;
  if (!canEdit) redirect(`/${churchSlug}/equipamentos/${id}`);

  const [{ data: categories }, { data: members }] = await Promise.all([
    supabase
      .from("equipment_categories")
      .select("id, name")
      .eq("church_id", tenant.church.id)
      .order("name"),
    tenant.isManager
      ? supabase
          .from("church_members")
          .select("user_id, profiles!inner(full_name)")
          .eq("church_id", tenant.church.id)
          .eq("status", "active")
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const initial: EquipmentFormValues = {
    id: eq.id,
    name: eq.name,
    categoryId: eq.category_id,
    subcategory: eq.subcategory ?? "",
    brand: eq.brand ?? "",
    model: eq.model ?? "",
    serialNumber: eq.serial_number ?? "",
    assetNumber: eq.asset_number ?? "",
    valueReais: eq.value_cents === null ? null : eq.value_cents / 100,
    supplier: eq.supplier ?? "",
    invoiceRef: eq.invoice_ref ?? "",
    warrantyUntil: eq.warranty_until ?? "",
    manualUrl: eq.manual_url ?? "",
    photoUrl: eq.photo_url ?? "",
    status: eq.status,
    location: eq.location ?? "",
    purchaseDate: eq.purchase_date ?? "",
    lifespanMonths: eq.lifespan_months,
    responsibleId: eq.responsible_id,
    ownerId: eq.owner_id,
    notes: eq.notes ?? "",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Editar equipamento</>}
        description={<>{eq.name}</>}
      />
      <EquipmentForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        categories={categories ?? []}
        members={(members ?? []).map((m) => ({
          user_id: m.user_id,
          full_name: (m.profiles as unknown as { full_name: string }).full_name,
        }))}
        initial={initial}
        photoPreview={await signedMediaUrl(eq.photo_url)}
        canChooseOwner={tenant.isManager}
        currentUserId={tenant.userId}
      />
    </div>
  );
}
