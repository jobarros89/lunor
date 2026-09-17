import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { getInfantilMinistry } from "@/lib/infantil";
import { ChildForm } from "@/components/infantil/child-form";

export default async function NovaCriancaPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);
  if (!ministry) redirect(`/${churchSlug}/infantil`);

  // Cadastro de criança é manutenção da base do Kids, não uma operação de culto.
  // Coordenadores e integrantes ativos do Kids podem cadastrar a qualquer momento.
  const canRegister =
    tenant.isCoord ||
    tenant.ministryMemberships.some((membership) => membership.id === ministry.id);

  if (!canRegister) redirect(`/${churchSlug}/infantil`);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Cadastrar criança</>}
        description={
          <>
            Cadastre a criança e o responsável. O check-in é feito separadamente
            no culto.
          </>
        }
      />
      <ChildForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
      />
    </div>
  );
}
