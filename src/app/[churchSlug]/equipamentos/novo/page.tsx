import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { EquipmentForm } from "@/components/equipamentos/equipment-form";

export default async function NovoEquipamentoPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  // Qualquer membro pode cadastrar equipamento PESSOAL; gestor cadastra os da igreja.

  const supabase = await createClient();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title ">
          Novo equipamento
        </h1>
        <p className="text-muted-foreground">
          {tenant.isManager
            ? "Cadastre um item do patrimônio"
            : "Cadastre um equipamento seu (pessoal)"}
        </p>
      </div>
      <EquipmentForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        categories={categories ?? []}
        members={(members ?? []).map((m) => ({
          user_id: m.user_id,
          full_name: (m.profiles as unknown as { full_name: string }).full_name,
        }))}
        canChooseOwner={tenant.isManager}
        currentUserId={tenant.userId}
      />
    </div>
  );
}
