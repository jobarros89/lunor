import Link from "next/link";
import { Plus } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/media";
import { LoadError } from "@/components/shell/load-error";
import { formatBRL, STATUS_LABELS } from "@/lib/equipamentos";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { EquipmentDirectory } from "@/components/equipamentos/equipment-directory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_BADGE: Record<string, string> = {
  disponivel: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  em_uso: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  manutencao: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  emprestado: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  indisponivel: "bg-red-500/15 text-red-700 dark:text-red-400",
  baixado: "bg-muted text-muted-foreground",
};

export default async function EquipamentosPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);

  const supabase = await createClient();
  const [{ data: equipments, error: equipError }, { data: categories }] =
    await Promise.all([
      supabase
        .from("equipments")
        .select(
          "id, name, brand, model, photo_url, status, value_cents, category_id, warranty_until, owner_id, profiles:owner_id(full_name)"
        )
        .eq("church_id", tenant.church.id)
        .neq("status", "baixado")
        .order("name"),
      supabase
        .from("equipment_categories")
        .select("id, name")
        .eq("church_id", tenant.church.id),
    ]);
  if (equipError) console.error("equipamentos:", equipError);

  const items = equipments ?? [];
  const photoUrls = await signedMediaUrls(items.map((e) => e.photo_url));
  const totalValue = items.reduce((sum, e) => sum + (e.value_cents ?? 0), 0);
  const inMaintenance = items.filter((e) => e.status === "manutencao").length;
  const soon = new Date();
  soon.setDate(soon.getDate() + 60);
  const warrantyExpiring = items.filter(
    (e) =>
      e.warranty_until &&
      new Date(e.warranty_until) <= soon &&
      new Date(e.warranty_until) >= new Date()
  ).length;

  const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
  const byCategory = new Map<string, { count: number; value: number }>();
  for (const e of items) {
    const key = catName.get(e.category_id ?? "") ?? "Sem categoria";
    const cur = byCategory.get(key) ?? { count: 0, value: 0 };
    byCategory.set(key, {
      count: cur.count + 1,
      value: cur.value + (e.value_cents ?? 0),
    });
  }
  const maxValue = Math.max(1, ...[...byCategory.values()].map((v) => v.value));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipamentos"
        description={`${items.length} itens ativos · patrimônio, situação e manutenção em um só lugar.`}
        actions={
          <Button
            nativeButton={false}
            render={<Link href={`/${churchSlug}/equipamentos/novo`} />}
          >
            <Plus className="size-4" />
            Novo equipamento
          </Button>
        }
      />

      {tenant.isManager && (
        <>
          <div className="grid gap-3 min-[400px]:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">
                  {formatBRL(totalValue)}
                </p>
              </CardContent>
            </Card>
            <Link href={`/${churchSlug}/manutencoes`}>
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">Em manutenção</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">
                    {inMaintenance}
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Card>
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Garantias (60d)</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">
                  {warrantyExpiring}
                </p>
              </CardContent>
            </Card>
          </div>

          {byCategory.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Valor por categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...byCategory.entries()]
                  .sort((a, b) => b[1].value - a[1].value)
                  .map(([name, { count, value }]) => (
                    <div key={name} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>
                          {name}{" "}
                          <span className="text-muted-foreground">
                            · {count}
                          </span>
                        </span>
                        <span className="font-medium">{formatBRL(value)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/70"
                          style={{ width: `${(value / maxValue) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      <div className="space-y-3">
        {items.length > 0 && (
          <EquipmentDirectory
            churchSlug={churchSlug}
            items={items.map((item) => ({
              id: item.id,
              name: item.name,
              details: [item.brand, item.model].filter(Boolean).join(" "),
              owner: item.owner_id
                ? `De ${(item.profiles as unknown as { full_name: string } | null)?.full_name ?? "voluntário"}`
                : "Da igreja",
              status: item.status,
              statusLabel: STATUS_LABELS[item.status],
              statusClassName: STATUS_BADGE[item.status],
              photoUrl: item.photo_url
                ? (photoUrls.get(item.photo_url) ?? null)
                : null,
              valueLabel:
                tenant.isManager && item.value_cents !== null
                  ? formatBRL(item.value_cents)
                  : null,
            }))}
          />
        )}
        {equipError ? (
          <LoadError oQue="os equipamentos" />
        ) : (
          items.length === 0 && (
            <EmptyState
              title="Seu inventário começa aqui"
              description="Os equipamentos cadastrados aparecerão com sua situação, localização e informações de manutenção."
              action={
                tenant.isManager ? (
                  <Button
                    nativeButton={false}
                    render={<Link href={`/${churchSlug}/equipamentos/novo`} />}
                  >
                    Cadastrar o primeiro
                  </Button>
                ) : undefined
              }
            />
          )
        )}
      </div>
    </div>
  );
}
