import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/equipamentos";
import {
  downtimeLabel,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
} from "@/lib/manutencoes";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketUpdate } from "@/components/manutencoes/ticket-update";

export default async function ChamadoDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const { data: t } = await supabase
    .from("maintenance_tickets")
    .select(
      "*, equipments!inner(id, name), profiles(full_name)"
    )
    .eq("id", id)
    .eq("church_id", tenant.church.id)
    .maybeSingle();

  if (!t) notFound();
  const equipment = t.equipments as unknown as { id: string; name: string };
  const openedBy = t.profiles as unknown as { full_name: string } | null;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-2 flex gap-1.5">
          <Badge
            className={`rounded-full border-0 ${PRIORITY_BADGE[t.priority]}`}
          >
            {PRIORITY_LABELS[t.priority]}
          </Badge>
          <Badge
            className={`rounded-full border-0 ${TICKET_STATUS_BADGE[t.status]}`}
          >
            {TICKET_STATUS_LABELS[t.status]}
          </Badge>
        </div>
        <h1 className="page-title ">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link
            href={`/${churchSlug}/equipamentos/${equipment.id}`}
            className="underline underline-offset-4"
          >
            {equipment.name}
          </Link>{" "}
          · aberto em {new Date(t.opened_at).toLocaleDateString("pt-BR")}
          {openedBy ? ` por ${openedBy.full_name}` : ""} ·{" "}
          {downtimeLabel(t.opened_at, t.resolved_at)} parado
        </p>
      </div>

      {t.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {t.description}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resolução</CardTitle>
        </CardHeader>
        <CardContent>
          {tenant.isLeader ? (
            <TicketUpdate
              churchSlug={churchSlug}
              ticketId={id}
              initial={{
                status: t.status,
                supplier: t.supplier ?? "",
                parts: t.parts ?? "",
                costReais: t.cost_cents === null ? null : t.cost_cents / 100,
              }}
            />
          ) : (
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Fornecedor: {t.supplier || "—"}</p>
              <p>Peças: {t.parts || "—"}</p>
              <p>Custo: {formatBRL(t.cost_cents)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
