import { redirect } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { TicketForm } from "@/components/manutencoes/ticket-form";

export default async function NovoChamadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<{ equipamento?: string }>;
}) {
  const { churchSlug } = await params;
  const { equipamento } = await searchParams;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader) redirect(`/${churchSlug}/manutencoes`);

  const supabase = await createClient();
  const { data: equipments } = await supabase
    .from("equipments")
    .select("id, name")
    .eq("church_id", tenant.church.id)
    .neq("status", "baixado")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title ">Novo chamado</h1>
        <p className="text-muted-foreground">
          O equipamento entra em manutenção automaticamente
        </p>
      </div>
      <TicketForm
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        equipments={equipments ?? []}
        preselectedId={equipamento}
      />
    </div>
  );
}
