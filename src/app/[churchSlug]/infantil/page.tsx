import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Baby,
  BellRing,
  ChevronDown,
  ChevronRight,
  LogIn,
  LogOut,
  TriangleAlert,
  Users,
} from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { getInfantilMinistry, formatAge } from "@/lib/infantil";
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
import { GuardianAccountLink } from "@/components/infantil/guardian-account-link";
import { GuardianKidsPage } from "@/components/infantil/guardian-kids-page";
import { KidsReceptionBar } from "@/components/infantil/kids-reception-bar";

const DEFAULT_EVENT_DURATION_MS = 4 * 60 * 60 * 1000;

type ActiveReception = {
  session_id: string;
  title: string;
  event_id: string | null;
  campus_id: string | null;
  campus_name: string | null;
  opened_at: string;
};

type KidsClassRow = {
  id: string;
  campus_id: string | null;
  name: string;
  min_age_months: number;
  max_age_months: number;
};

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
          <h1 className="page-title ">Kids</h1>
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

  if (tenant.guardianOnly) {
    return (
      <GuardianKidsPage
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
        userId={tenant.userId}
      />
    );
  }

  const { data: vinculo } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("ministry_id", ministry.id)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();

  if (!vinculo && !tenant.isCoord) redirect(`/${churchSlug}`);

  const canManageReception =
    tenant.isCoord || vinculo?.role === "gerente" || vinculo?.role === "lider";

  const { data: canOperate } = await supabase.rpc("can_operate_kids", {
    p_church: tenant.church.id,
    p_ministry: ministry.id,
    p_event: null,
  });
  const podeGerir = canManageReception || canOperate === true;

  // eslint-disable-next-line react-hooks/purity
  const requestNowMs = Date.now();
  const sessionWindowStart = new Date(requestNowMs - 6 * 60 * 60 * 1000).toISOString();

  const [
    { data: classes },
    { data: children },
    { data: eventos },
    { data: guardians },
    { data: members },
    { data: receptionRows },
    { data: campuses },
  ] = await Promise.all([
    supabase
      .from("child_classes")
      .select("id, campus_id, name, min_age_months, max_age_months")
      .eq("ministry_id", ministry.id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("children")
      .select("id, full_name, birth_date, allergies, special_needs")
      .eq("ministry_id", ministry.id)
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, campus_id, campuses(name)")
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
    supabase.rpc("current_kids_reception", {
      p_church: tenant.church.id,
      p_ministry: ministry.id,
    }),
    supabase
      .from("campuses")
      .select("id, name, sort_order")
      .eq("church_id", tenant.church.id)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
  ]);

  const activeReceptions = (receptionRows ?? []) as ActiveReception[];
  const campusRows = (campuses ?? []).map((campus) => ({
    id: campus.id,
    name: campus.name,
  }));
  const turmas = (classes ?? []) as KidsClassRow[];

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

  let checkins: Array<{ class_id: string | null; checked_out_at: string | null }> = [];
  let chamadasPendentes = 0;
  const sessionIds = activeReceptions.map((reception) => reception.session_id);

  if (sessionIds.length > 0) {
    const [{ data: checkinsData }, { count: pagesCount }] = await Promise.all([
      supabase
        .from("child_checkins")
        .select("class_id, checked_out_at")
        .in("reception_session_id", sessionIds),
      supabase
        .from("child_pages")
        .select("id", { count: "exact", head: true })
        .in("reception_session_id", sessionIds)
        .is("resolved_at", null),
    ]);
    checkins = checkinsData ?? [];
    chamadasPendentes = pagesCount ?? 0;
  }

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

  const campusesWithoutClasses = campusRows.filter(
    (campus) => !turmas.some((turma) => turma.campus_id === campus.id)
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          LUNOR Kids
        </p>
        <h1 className="page-title mt-1">Dashboard Kids</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crianças, turmas e operação da recepção em um só lugar.
        </p>
      </div>

      <KidsReceptionBar
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        ministryId={ministry.id}
        canManageReception={canManageReception}
        campuses={campusRows}
        activeReceptions={activeReceptions.map((reception) => ({
          sessionId: reception.session_id,
          title: reception.title,
          eventId: reception.event_id,
          campusId: reception.campus_id,
          campusName: reception.campus_name,
          openedAt: reception.opened_at,
        }))}
      />

      {activeReceptions.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Operação atual</CardTitle>
            <CardDescription>
              {activeReceptions.length === 1
                ? `${activeReceptions[0].campus_name ?? "Campus não definido"} · ${activeReceptions[0].title}`
                : `${activeReceptions.length} recepções abertas`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric icon={Users} value={presentes} label="Presentes" />
            <Metric icon={LogIn} value={entradas} label="Check-ins" />
            <Metric icon={LogOut} value={saidas} label="Check-outs" />
            <Metric icon={BellRing} value={chamadasPendentes} label="Chamadas" />
          </CardContent>
        </Card>
      )}

      {campusesWithoutClasses.length > 0 && podeGerir && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Configurar turmas por campus</CardTitle>
            <CardDescription>
              {campusesWithoutClasses.map((campus) => campus.name).join(", ")} ainda {campusesWithoutClasses.length === 1 ? "não possui" : "não possuem"} turmas configuradas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              nativeButton={false}
              className="h-11 rounded-full"
              render={<Link href={`/${churchSlug}/infantil/configuracoes`} />}
            >
              Configurar turmas
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Turmas</CardTitle>
          <CardDescription>
            Expanda somente o campus que deseja visualizar. Campi com recepção aberta ficam abertos por padrão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {campusRows.map((campus) => {
            const campusClasses = turmas.filter((turma) => turma.campus_id === campus.id);
            const receptionOpen = activeReceptions.some(
              (reception) => reception.campus_id === campus.id
            );
            const campusPresentes = campusClasses.reduce(
              (total, turma) => total + (presentesPorTurma.get(turma.id) ?? 0),
              0
            );

            return (
              <details
                key={campus.id}
                open={receptionOpen}
                className="group overflow-hidden rounded-2xl border bg-card"
              >
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{campus.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{receptionOpen ? "Recepção aberta" : "Recepção fechada"}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {campusClasses.length} {campusClasses.length === 1 ? "turma" : "turmas"}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {campusPresentes} {campusPresentes === 1 ? "presente" : "presentes"}
                      </span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {receptionOpen && (
                      <Badge className="hidden rounded-full border-0 bg-emerald-100 text-emerald-800 sm:inline-flex">
                        Aberta
                      </Badge>
                    )}
                    <ChevronDown className="size-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
                  </div>
                </summary>

                <div className="space-y-2 border-t px-3 py-3 sm:px-4 sm:py-4">
                  {podeGerir && (
                    <div className="flex justify-end">
                      <Button
                        nativeButton={false}
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-3 text-xs"
                        render={<Link href={`/${churchSlug}/infantil/configuracoes`} />}
                      >
                        Configurar {campus.name}
                      </Button>
                    </div>
                  )}

                  {campusClasses.map((turma) => {
                    const qtd = presentesPorTurma.get(turma.id) ?? 0;
                    return (
                      <div
                        key={turma.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{turma.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {qtd} {qtd === 1 ? "presente" : "presentes"}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 rounded-full">
                          {qtd}
                        </Badge>
                      </div>
                    );
                  })}

                  {campusClasses.length === 0 && (
                    <div className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
                      Nenhuma turma configurada para este campus.
                    </div>
                  )}
                </div>
              </details>
            );
          })}

          {campusRows.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum campus ativo. Cadastre os campi na Administração.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Crianças</CardTitle>
            <CardDescription>{children?.length ?? 0} cadastradas</CardDescription>
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
            const content = (
              <>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Baby className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAge(c.birth_date)}
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
            <CardTitle className="text-base">Responsáveis</CardTitle>
            <CardDescription>
              Vincule contas LUNOR ou gere convites de acesso familiar.
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

      {(eventos ?? []).some((event) => {
        const startMs = new Date(event.starts_at).getTime();
        const endMs = event.ends_at
          ? new Date(event.ends_at).getTime()
          : startMs + DEFAULT_EVENT_DURATION_MS;
        return endMs >= requestNowMs;
      }) && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Cultos próximos</CardTitle>
            <CardDescription>
              O campus do culto define quais turmas do Kids serão usadas.
            </CardDescription>
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
              .map((e) => {
                const eventCampus = e.campuses as unknown as { name: string } | null;
                return (
                  <Link
                    key={e.id}
                    href={`/${churchSlug}/infantil/sessao/${e.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatEventDate(e.starts_at)} · {formatEventTime(e.starts_at)}
                        {eventCampus?.name ? ` · ${eventCampus.name}` : " · campus não definido"}
                      </p>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </Link>
                );
              })}
          </CardContent>
        </Card>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Dados de menores permanecem restritos à equipe Kids e à coordenação da igreja.
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
