import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Baby,
  BellRing,
  ChevronRight,
  DoorOpen,
  LogIn,
  LogOut,
  TriangleAlert,
  Users,
} from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry, formatAge, suggestClass, type ChildClass } from "@/lib/infantil";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SeedClassesButton } from "@/components/infantil/seed-classes-button";
import { GuardianAccountLink } from "@/components/infantil/guardian-account-link";

const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000;

export default async function InfantilPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const ministry = await getInfantilMinistry(tenant.church.id);

  if (!ministry) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            LUNOR Kids
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Kids</h1>
        </div>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Kids ainda não está ativo</CardTitle>
            <CardDescription>
              Crie um ministério Infantil/Kids na Administração para ativar o módulo.
            </CardDescription>
          </CardHeader>
          {tenant.isCoord && (
            <CardContent>
              <Button
                nativeButton={false}
                className="h-11 rounded-full"
                render={<Link href={`/${churchSlug}/admin`} />}
              >
                Ir para Administração
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: vinculo } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();
  if (!vinculo && !tenant.isCoord) redirect(`/${churchSlug}`);

  const podeGerir =
    tenant.isCoord || vinculo?.role === "gerente" || vinculo?.role === "lider";

  // Momento desta renderização no servidor; usado apenas para escolher a
  // sessão operacional atual/próxima, sem participar de hidratação client-side.
  // eslint-disable-next-line react-hooks/purity
  const requestNowMs = Date.now();
  const sessionWindowStart = new Date(requestNowMs - 6 * 60 * 60 * 1000).toISOString();

  const [
    { data: classes },
    { data: children },
    { data: eventos },
    { data: guardians },
    { data: members },
  ] = await Promise.all([
    supabase
      .from("child_classes")
      .select("id, name, min_age_months, max_age_months")
      .eq("ministry_id", ministry.id)
      .order("sort_order"),
    supabase
      .from("children")
      .select("id, full_name, birth_date, allergies, special_needs")
      .eq("ministry_id", ministry.id)
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at")
      .eq("church_id", tenant.church.id)
      .gte("starts_at", sessionWindowStart)
      .order("starts_at")
      .limit(6),
    supabase
      .from("guardians")
      .select("id, full_name, user_id")
      .eq("ministry_id", ministry.id)
      .order("full_name"),
    supabase
      .from("church_members")
      .select("user_id, profiles!inner(full_name)")
      .eq("church_id", tenant.church.id)
      .eq("status", "active"),
  ]);

  const guardianRows = (guardians ?? []).map((guardian) => ({
    id: guardian.id,
    fullName: guardian.full_name,
    userId: guardian.user_id,
  }));
  const accountRows = (members ?? [])
    .map((member) => ({
      id: member.user_id,
      fullName: (member.profiles as unknown as { full_name: string }).full_name,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR"));

  const eventoAtual =
    eventos?.find((event) => {
      const startMs = new Date(event.starts_at).getTime();
      const endMs = event.ends_at
        ? new Date(event.ends_at).getTime()
        : startMs + DEFAULT_EVENT_DURATION_MS;
      return endMs >= requestNowMs;
    }) ?? null;

  let checkins: Array<{ class_id: string | null; checked_out_at: string | null }> = [];
  let chamadasPendentes = 0;

  if (eventoAtual) {
    const [{ data: checkinsData }, { count: pagesCount }] = await Promise.all([
      supabase
        .from("child_checkins")
        .select("class_id, checked_out_at")
        .eq("event_id", eventoAtual.id),
      supabase
        .from("child_pages")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventoAtual.id)
        .is("resolved_at", null),
    ]);
    checkins = checkinsData ?? [];
    chamadasPendentes = pagesCount ?? 0;
  }

  const turmas = (classes ?? []) as ChildClass[];
  const presentes = checkins.filter((item) => !item.checked_out_at).length;
  const entradas = checkins.length;
  const saidas = checkins.filter((item) => !!item.checked_out_at).length;

  const presentesPorTurma = new Map<string, number>();
  for (const item of checkins) {
    if (!item.checked_out_at && item.class_id) {
      presentesPorTurma.set(
        item.class_id,
        (presentesPorTurma.get(item.class_id) ?? 0) + 1
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            LUNOR Kids
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard Kids</h1>
          <p className="text-muted-foreground">
            Veja a operação do Kids e entre rapidamente na recepção.
          </p>
        </div>
        {eventoAtual && (
          <Button
            nativeButton={false}
            className="h-11 rounded-full px-5"
            render={<Link href={`/${churchSlug}/infantil/sessao/${eventoAtual.id}`} />}
          >
            <DoorOpen className="size-4" />
            Abrir recepção
          </Button>
        )}
      </div>

      {turmas.length === 0 && podeGerir && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Criar as turmas</CardTitle>
            <CardDescription>
              Comece com Berçário, Maternal, Jardim, Primários e Juniores.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SeedClassesButton churchSlug={churchSlug} ministryId={ministry.id} />
          </CardContent>
        </Card>
      )}

      {eventoAtual ? (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Operação atual</CardTitle>
            <CardDescription>
              {eventoAtual.title} · {formatEventDate(eventoAtual.starts_at)} · {formatEventTime(eventoAtual.starts_at)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={Users} value={presentes} label="Presentes agora" />
            <Metric icon={LogIn} value={entradas} label="Check-ins" />
            <Metric icon={LogOut} value={saidas} label="Check-outs" />
            <Metric icon={BellRing} value={chamadasPendentes} label="Chamadas pendentes" />
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-3xl">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Nenhum culto próximo. Crie um evento em Escalas para iniciar a operação do Kids.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Turmas</CardTitle>
          <CardDescription>Presença atual por faixa etária</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {turmas.map((turma) => {
            const qtd = presentesPorTurma.get(turma.id) ?? 0;
            return (
              <div
                key={turma.id}
                className="flex items-center justify-between rounded-2xl border px-4 py-3"
              >
                <div>
                  <p className="font-medium">{turma.name}</p>
                  <p className="text-xs text-muted-foreground">{qtd} presentes agora</p>
                </div>
                <Badge variant="secondary" className="rounded-full">
                  {qtd}
                </Badge>
              </div>
            );
          })}
          {turmas.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma turma configurada.</p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Crianças</CardTitle>
            <CardDescription>{children?.length ?? 0} cadastradas no Kids</CardDescription>
          </div>
          {podeGerir && (
            <Button
              nativeButton={false}
              className="h-10 shrink-0 rounded-full px-4"
              render={<Link href={`/${churchSlug}/infantil/nova`} />}
            >
              + Cadastrar
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {(children ?? []).slice(0, 8).map((c) => {
            const turma = suggestClass(c.birth_date, turmas);
            const content = (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Baby className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAge(c.birth_date)}{turma ? ` · ${turma.name}` : ""}
                  </p>
                </div>
                {c.allergies && (
                  <Badge className="shrink-0 rounded-full border-0 bg-amber-100 text-amber-800">
                    <TriangleAlert className="mr-1 size-3" />
                    Alergia
                  </Badge>
                )}
                {podeGerir && (
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                )}
              </>
            );

            return podeGerir ? (
              <Link
                key={c.id}
                href={`/${churchSlug}/infantil/crianca/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-accent/40"
              >
                {content}
              </Link>
            ) : (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border px-4 py-3">
                {content}
              </div>
            );
          })}
          {(children ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma criança cadastrada ainda.</p>
          )}
        </CardContent>
      </Card>

      {podeGerir && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Responsáveis e conta LUNOR</CardTitle>
            <CardDescription>
              Vincule o responsável a uma conta ativa da igreja para que os chamados do Kids cheguem ao aparelho correto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GuardianAccountLink
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              ministryId={ministry.id}
              guardians={guardianRows}
              accounts={accountRows}
            />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Próximas sessões</CardTitle>
          <CardDescription>Abra a recepção diretamente no culto desejado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(eventos ?? [])
            .filter((event) => {
              const startMs = new Date(event.starts_at).getTime();
              const endMs = event.ends_at
                ? new Date(event.ends_at).getTime()
                : startMs + DEFAULT_EVENT_DURATION_MS;
              return endMs >= requestNowMs;
            })
            .slice(0, 3)
            .map((e) => (
              <Link
                key={e.id}
                href={`/${churchSlug}/infantil/sessao/${e.id}`}
                className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventDate(e.starts_at)} · {formatEventTime(e.starts_at)}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
        </CardContent>
      </Card>

      <p className="px-1 text-xs text-muted-foreground">
        Dados de menores permanecem restritos a quem serve no Kids e à coordenação da igreja.
      </p>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
