import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  downtimeLabel,
  PRIORITY_BADGE,
  PRIORITY_LABELS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
} from "@/lib/manutencoes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function ManutencoesPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const { data: tickets } = await supabase
    .from("maintenance_tickets")
    .select(
      "id, title, priority, status, opened_at, resolved_at, equipments!inner(name)",
    )
    .eq("church_id", tenant.church.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const open = (tickets ?? []).filter(
    (t) => !["concluido", "cancelado"].includes(t.status),
  );
  const closed = (tickets ?? []).filter((t) =>
    ["concluido", "cancelado"].includes(t.status),
  );

  const TicketCard = ({ t }: { t: NonNullable<typeof tickets>[number] }) => (
    <Link href={`/${churchSlug}/manutencoes/${t.id}`}>
      <Card className="mb-3 transition-colors hover:bg-accent/40">
        <CardContent className="space-y-2 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{t.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {(t.equipments as unknown as { name: string }).name} ·{" "}
                {downtimeLabel(t.opened_at, t.resolved_at)} parado
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
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
        </CardContent>
      </Card>
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>Manutenções</>}
        description={<>{open.length} chamados abertos</>}
        actions={
          <>
            {tenant.isLeader && (
              <Button
                className="px-5"
                nativeButton={false}
                render={<Link href={`/${churchSlug}/manutencoes/novo`} />}
              >
                <Plus className="size-4" />
                Novo
              </Button>
            )}
          </>
        }
      />

      <div>
        {open.map((t) => (
          <TicketCard key={t.id} t={t} />
        ))}
        {open.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum chamado aberto. 🎉
            </CardContent>
          </Card>
        )}
      </div>

      {closed.length > 0 && (
        <div>
          <h2 className="mb-3 px-1 text-sm font-medium text-muted-foreground">
            Encerrados
          </h2>
          {closed.map((t) => (
            <TicketCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
