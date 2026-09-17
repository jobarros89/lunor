import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Wrench } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { signedMediaUrl } from "@/lib/media";
import {
  EVENT_LABELS,
  formatBRL,
  formatDate,
  STATUS_LABELS,
} from "@/lib/equipamentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}

export default async function EquipamentoDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const [{ data: eq }, { data: events }] = await Promise.all([
    supabase
      .from("equipments")
      .select(
        "*, equipment_categories(name), responsible:profiles!responsible_id(full_name), owner:profiles!owner_id(full_name)"
      )
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("equipment_events")
      .select("id, event_type, payload, created_at, profiles(full_name)")
      .eq("equipment_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (!eq) notFound();
  const photoUrl = await signedMediaUrl(eq.photo_url);
  const category = eq.equipment_categories as unknown as { name: string } | null;
  const responsible = eq.responsible as unknown as {
    full_name: string;
  } | null;
  const owner = eq.owner as unknown as { full_name: string } | null;
  const canEdit = tenant.isManager || eq.owner_id === tenant.userId;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt={eq.name}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-xl font-semibold text-muted-foreground">
                {eq.name[0]}
              </span>
            )}
          </div>
          <div>
            <h1 className="page-title ">{eq.name}</h1>
            <Badge variant="secondary" className="mt-1 rounded-full">
              {STATUS_LABELS[eq.status]}
            </Badge>
          </div>
        </div>
        {canEdit && (
          <div className="flex shrink-0 flex-col gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-full px-4"
              nativeButton={false}
              render={
                <Link href={`/${churchSlug}/equipamentos/${id}/editar`} />
              }
            >
              <Pencil className="size-4" />
              Editar
            </Button>
            {tenant.isManager && (
              <Button
                variant="outline"
                className="h-10 rounded-full px-4"
                nativeButton={false}
                render={
                  <Link
                    href={`/${churchSlug}/manutencoes/novo?equipamento=${id}`}
                  />
                }
              >
                <Wrench className="size-4" />
                Chamado
              </Button>
            )}
          </div>
        )}
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow
            label="Propriedade"
            value={owner ? `Pessoal de ${owner.full_name}` : "Da igreja"}
          />
          <InfoRow label="Categoria" value={category?.name} />
          <InfoRow label="Subcategoria" value={eq.subcategory} />
          <InfoRow label="Marca" value={eq.brand} />
          <InfoRow label="Modelo" value={eq.model} />
          <InfoRow label="Nº de série" value={eq.serial_number} />
          <InfoRow label="Nº patrimonial" value={eq.asset_number} />
          {tenant.isManager && (
            <>
              <InfoRow label="Valor" value={formatBRL(eq.value_cents)} />
              <InfoRow label="Fornecedor" value={eq.supplier} />
              <InfoRow label="Nota fiscal" value={eq.invoice_ref} />
            </>
          )}
          <InfoRow label="Garantia até" value={formatDate(eq.warranty_until)} />
          <InfoRow label="Compra" value={formatDate(eq.purchase_date)} />
          <InfoRow
            label="Vida útil"
            value={eq.lifespan_months ? `${eq.lifespan_months} meses` : "—"}
          />
          <InfoRow label="Localização" value={eq.location} />
          <InfoRow label="Responsável" value={responsible?.full_name} />
          {eq.manual_url && (
            <InfoRow
              label="Manual"
              value={
                <a
                  href={eq.manual_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4"
                >
                  Abrir
                </a>
              }
            />
          )}
          <InfoRow label="Observações" value={eq.notes} />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(events ?? []).map((ev) => {
            const who = ev.profiles as unknown as { full_name: string } | null;
            const changes =
              ev.event_type === "alteracao"
                ? Object.keys(ev.payload as Record<string, unknown>)
                : [];
            return (
              <div key={ev.id} className="flex gap-3 text-sm">
                <div className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground/40" />
                <div>
                  <p className="font-medium">
                    {EVENT_LABELS[ev.event_type] ?? ev.event_type}
                    {changes.length > 0 && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {changes.join(", ")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString("pt-BR")}
                    {who?.full_name ? ` · ${who.full_name}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
          {(events ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Sem eventos.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
