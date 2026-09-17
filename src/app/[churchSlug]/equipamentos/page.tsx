import Link from "next/link";
import { Plus } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { signedMediaUrls } from "@/lib/media";
import { LoadError } from "@/components/shell/load-error";
import { formatBRL, STATUS_LABELS } from "@/lib/equipamentos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title ">
            Equipamentos
          </h1>
          <p className="text-muted-foreground">{items.length} itens ativos</p>
        </div>
        <Button
          className="h-11 rounded-full px-5"
          nativeButton={false}
          render={<Link href={`/${churchSlug}/equipamentos/novo`} />}
        >
          <Plus className="size-4" />
          Novo
        </Button>
      </div>

      {tenant.isManager && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="rounded-3xl">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">Valor total</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">
                  {formatBRL(totalValue)}
                </p>
              </CardContent>
            </Card>
            <Link href={`/${churchSlug}/manutencoes`}>
              <Card className="h-full rounded-3xl transition-colors hover:bg-accent/40">
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground">
                    Em manutenção
                  </p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">
                    {inMaintenance}
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Card className="rounded-3xl">
              <CardContent className="pt-5">
                <p className="text-xs text-muted-foreground">
                  Garantias (60d)
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight">
                  {warrantyExpiring}
                </p>
              </CardContent>
            </Card>
          </div>

          {byCategory.size > 0 && (
            <Card className="rounded-3xl">
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
        {items.map((e) => (
          <Link key={e.id} href={`/${churchSlug}/equipamentos/${e.id}`} className="block">
            <Card className="rounded-3xl transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                  {e.photo_url && photoUrls.get(e.photo_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrls.get(e.photo_url)}
                      alt={e.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-semibold text-muted-foreground">
                      {e.name[0]}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[e.brand, e.model].filter(Boolean).join(" ") || "—"}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.owner_id
                      ? `de ${(e.profiles as unknown as { full_name: string } | null)?.full_name ?? "voluntário"}`
                      : "Da igreja"}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    className={`rounded-full border-0 ${STATUS_BADGE[e.status]}`}
                  >
                    {STATUS_LABELS[e.status]}
                  </Badge>
                  {tenant.isManager && e.value_cents !== null && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatBRL(e.value_cents)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {equipError ? (
          <LoadError oQue="os equipamentos" />
        ) : (
          items.length === 0 && (
            <Card className="rounded-3xl">
              <CardContent className="space-y-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum equipamento cadastrado ainda.
                </p>
                {tenant.isManager && (
                  <Link href={`/${churchSlug}/equipamentos/novo`}>
                    <Button className="h-11 rounded-full px-5">
                      Cadastrar o primeiro
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
