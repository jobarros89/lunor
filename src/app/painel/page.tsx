import Link from "next/link";
import { Building2, Users, Package, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/equipamentos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BillingPanel } from "@/components/painel/billing-panel";
import type { BillingStatus } from "@/lib/billing";
import { NovaIgreja } from "@/components/painel/nova-igreja";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  insert: "criou",
  update: "alterou",
  delete: "removeu",
};

const TABLE_LABELS: Record<string, string> = {
  equipments: "equipamento",
  events: "evento",
  assignments: "escala",
  maintenance_tickets: "chamado",
  evaluations: "avaliação",
};

export default async function PainelPage() {
  const supabase = await createClient();

  const [
    { data: churches },
    { data: members },
    { data: profilesCount },
    { data: equipments },
    { data: tickets },
    { data: logs },
  ] = await Promise.all([
    supabase
      .from("churches")
      .select(
        "id, name, slug, created_at, billing_status, paid_until"
      )
      .order("created_at", { ascending: false }),
    supabase.from("church_members").select("church_id, user_id"),
    supabase.from("profiles").select("id"),
    supabase.from("equipments").select("church_id, value_cents, status"),
    supabase.from("maintenance_tickets").select("church_id, status"),
    supabase
      .from("audit_logs")
      .select("id, table_name, action, church_id, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  // Janela relativa ao momento desta renderização no servidor. O uso de
  // Date.now() aqui é intencional: não participa de render client/hidratação.
  // eslint-disable-next-line react-hooks/purity
  const desde = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
  const { data: claims } = await supabase
    .from("billing_claims")
    .select("church_id")
    .gte("created_at", desde);
  const avisaram = new Set((claims ?? []).map((c) => c.church_id));

  // eslint-disable-next-line react-hooks/purity -- janela de observabilidade calculada no servidor
  const desde48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: erros } = await supabase
    .from("error_logs")
    .select("id, message, path, church_id, created_at")
    .gte("created_at", desde48h)
    .order("created_at", { ascending: false })
    .limit(20);

  const churchList = churches ?? [];
  const totalPatrimonio = (equipments ?? []).reduce(
    (s, e) => s + (e.value_cents ?? 0),
    0
  );
  const chamadosAbertos = (tickets ?? []).filter(
    (t) => !["concluido", "cancelado"].includes(t.status)
  ).length;

  const membersByChurch = new Map<string, number>();
  for (const m of members ?? []) {
    membersByChurch.set(
      m.church_id,
      (membersByChurch.get(m.church_id) ?? 0) + 1
    );
  }
  const equipByChurch = new Map<string, number>();
  for (const e of equipments ?? []) {
    equipByChurch.set(e.church_id, (equipByChurch.get(e.church_id) ?? 0) + 1);
  }
  const churchName = new Map(churchList.map((c) => [c.id, c.name]));

  const stats = [
    { label: "Igrejas", value: churchList.length, icon: Building2 },
    { label: "Pessoas", value: (profilesCount ?? []).length, icon: Users },
    {
      label: "Patrimônio",
      value: formatBRL(totalPatrimonio),
      icon: Package,
    },
    { label: "Chamados abertos", value: chamadosAbertos, icon: Wrench },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão geral</h1>
          <p className="text-muted-foreground">
            Todas as igrejas e atividades da plataforma
          </p>
        </div>
        <NovaIgreja />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="rounded-3xl">
            <CardContent className="space-y-2 pt-5">
              <div className="flex size-9 items-center justify-center rounded-2xl bg-muted">
                <s.icon className="size-4.5" />
              </div>
              <p className="text-xl font-semibold tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            Igrejas cadastradas ({churchList.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {churchList.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  /{c.slug} · desde {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <p>{membersByChurch.get(c.id) ?? 0} pessoas</p>
                <p>{equipByChurch.get(c.id) ?? 0} equip.</p>
              </div>
            </Link>
          ))}
          {churchList.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma igreja cadastrada ainda. Crie a primeira para começar a
                gerenciar.
              </p>
              <NovaIgreja />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">
            Saúde do sistema
            {(erros ?? []).length > 0 && (
              <span className="ml-2 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                {(erros ?? []).length} erro
                {(erros ?? []).length === 1 ? "" : "s"} em 48h
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(erros ?? []).map((e) => (
            <div key={e.id} className="rounded-2xl border px-4 py-3">
              <p className="break-words text-sm font-medium">{e.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {e.path ?? "—"}
                {e.church_id && churchName.get(e.church_id)
                  ? ` · ${churchName.get(e.church_id)}`
                  : ""}{" "}
                · {new Date(e.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
          {(erros ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum erro nas últimas 48 horas. Logs detalhados ficam no painel
              do Cloudflare.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Sustentação</CardTitle>
        </CardHeader>
        <CardContent>
          <BillingPanel
            churches={churchList.map((c) => ({
              id: c.id,
              name: c.name,
              status: (c.billing_status ?? "trial") as BillingStatus,
              paidUntil: c.paid_until ?? null,
              avisouPagamento: avisaram.has(c.id),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Atividade recente (logs)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(logs ?? []).map((l) => (
            <div key={l.id} className="flex gap-3 text-sm">
              <div className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground/40" />
              <div className="min-w-0">
                <p>
                  <span className="font-medium">
                    {AUDIT_ACTION_LABELS[l.action] ?? l.action}
                  </span>{" "}
                  {TABLE_LABELS[l.table_name] ?? l.table_name}
                  {l.church_id && churchName.get(l.church_id) ? (
                    <span className="text-muted-foreground">
                      {" "}
                      · {churchName.get(l.church_id)}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          ))}
          {(logs ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
