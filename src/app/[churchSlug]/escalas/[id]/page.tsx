import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, CalendarDays, Clock3, MapPin, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { getInfantilMinistry } from "@/lib/infantil";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
  formatEventDate,
  formatEventTime,
} from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { LoadError } from "@/components/shell/load-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AssignmentManager,
  type AssignmentRow,
} from "@/components/escalas/assignment-manager";
import { MyAssignmentCard } from "@/components/escalas/my-assignment-card";
import { DeleteFutureEventButton } from "@/components/escalas/event-delete-control";
import {
  ServiceOrderCard,
  type ServiceItem,
} from "@/components/escalas/service-order-card";
import {
  EventSetlistSummary,
  type EventSetlistSummaryItem,
} from "@/components/louvor/event-setlist-summary";

type EventAssignment = {
  id: string;
  ministry_id: string;
  user_id: string;
  role_name: string;
  status: string;
  arrival_time: string | null;
  items_to_bring: string | null;
  ministries: { id: string; name: string } | { id: string; name: string }[];
  profiles: { full_name: string } | { full_name: string }[] | null;
  leader: { full_name: string } | { full_name: string }[] | null;
};

type TeamGroup = {
  ministryId: string;
  ministryName: string;
  rows: EventAssignment[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function assignmentStatusClass(status: string) {
  return ASSIGNMENT_STATUS_BADGE[status] ?? "bg-muted text-muted-foreground";
}

function assignmentStatusLabel(status: string) {
  return ASSIGNMENT_STATUS_LABELS[status] ?? status;
}

export default async function EventoDetailPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);
  const { active } = await getActiveMinistry(churchSlug);
  const canManageActive = active?.canManage ?? false;
  const activeMinistryId = active?.id ?? null;

  const supabase = await createClient();
  const [
    { data: event, error: eventError },
    { data: assignments, error: assignmentsError },
    { data: serviceItems, error: serviceItemsError },
    louvor,
    kids,
  ] = await Promise.all([
    supabase
      .from("events")
      .select("*, event_types(name), departments(name)")
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select(
        "id, ministry_id, user_id, role_name, status, arrival_time, items_to_bring, ministries!inner(id, name), profiles!assignments_user_id_fkey(full_name), leader:profiles!assignments_leader_id_fkey(full_name)"
      )
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("created_at"),
    supabase
      .from("service_items")
      .select("id, type, title, notes, duration_minutes, position")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("position"),
    getLouvorMinistry(tenant.church.id),
    getInfantilMinistry(tenant.church.id),
  ]);

  if (eventError) console.error("evento:", eventError);
  if (!event) notFound();

  const allAssignments = (assignments ?? []) as unknown as EventAssignment[];
  const isDedicatedMinistry =
    !!activeMinistryId &&
    (activeMinistryId === louvor?.id || activeMinistryId === kids?.id);
  const canManageGeneric =
    !!activeMinistryId && canManageActive && !isDedicatedMinistry;

  let canOpenLouvor = tenant.isCoord;
  if (louvor && !canOpenLouvor) {
    const { data: louvorMembership } = await supabase
      .from("ministry_members")
      .select("id")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle();
    canOpenLouvor = !!louvorMembership;
  }

  const { data: setlist, error: setlistError } = await supabase
    .from("setlist_items")
    .select("id, position, key_override, songs(id, title, artist, default_key, bpm)")
    .eq("church_id", tenant.church.id)
    .eq("event_id", id)
    .order("position");
  const itensRepertorio = (setlist ?? []) as unknown as EventSetlistSummaryItem[];

  const mineAssignments = allAssignments.filter((a) => a.user_id === tenant.userId);
  const activeAssignments = activeMinistryId
    ? allAssignments.filter((a) => a.ministry_id === activeMinistryId)
    : [];
  const equipmentAssignmentIds = [
    ...new Set(
      [...mineAssignments, ...(canManageGeneric ? activeAssignments : [])].map((a) => a.id)
    ),
  ];
  const { data: links } = equipmentAssignmentIds.length
    ? await supabase
        .from("assignment_equipments")
        .select("assignment_id, equipments!inner(id, name)")
        .eq("church_id", tenant.church.id)
        .in("assignment_id", equipmentAssignmentIds)
    : { data: [] as { assignment_id: string; equipments: unknown }[] };

  const equipByAssignment = new Map<string, { id: string; name: string }[]>();
  for (const link of links ?? []) {
    const eq = link.equipments as unknown as { id: string; name: string };
    equipByAssignment.set(link.assignment_id, [
      ...(equipByAssignment.get(link.assignment_id) ?? []),
      eq,
    ]);
  }

  const activeRows: AssignmentRow[] = activeAssignments.map((a) => ({
    id: a.id,
    user_id: a.user_id,
    full_name: firstRelated(a.profiles)?.full_name ?? "—",
    role_name: a.role_name,
    status: a.status,
    equipments: equipByAssignment.get(a.id) ?? [],
  }));

  let members: {
    user_id: string;
    full_name: string;
    cargaMes: number;
    indisponivel: boolean;
    aptidoes: string[];
    interesses: string[];
  }[] = [];
  let equipments: { id: string; name: string }[] = [];

  // Enquanto os demais ministérios ainda não têm módulo próprio, preservamos
  // a gestão do ministério ativo aqui. Louvor e Kids são geridos nos módulos dedicados.
  if (canManageGeneric && activeMinistryId) {
    const dt = new Date(event.starts_at);
    const mesIni = new Date(dt.getFullYear(), dt.getMonth(), 1).toISOString();
    const mesFim = new Date(dt.getFullYear(), dt.getMonth() + 1, 1).toISOString();
    const eventoDia = (event.starts_at as string).slice(0, 10);
    const cid = tenant.church.id;

    const [
      { data: m },
      { data: eq },
      { data: cargas },
      { data: indisp },
      { data: apts },
      { data: ints },
    ] = await Promise.all([
      supabase
        .from("ministry_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("church_id", cid)
        .eq("ministry_id", activeMinistryId)
        .eq("active", true),
      supabase
        .from("equipments")
        .select("id, name")
        .eq("church_id", cid)
        .or(`ministry_id.eq.${activeMinistryId},ministry_id.is.null`)
        .in("status", ["disponivel", "em_uso"])
        .order("name"),
      supabase
        .from("assignments")
        .select("user_id, events!inner(starts_at)")
        .eq("church_id", cid)
        .eq("ministry_id", activeMinistryId)
        .gte("events.starts_at", mesIni)
        .lt("events.starts_at", mesFim),
      supabase
        .from("unavailability")
        .select("user_id")
        .eq("church_id", cid)
        .lte("start_date", eventoDia)
        .gte("end_date", eventoDia),
      supabase
        .from("member_skills")
        .select("user_id, skills!inner(name)")
        .eq("church_id", cid)
        .not("approved_by", "is", null),
      supabase
        .from("member_interests")
        .select("user_id, skills!inner(name)")
        .eq("church_id", cid),
    ]);

    const cargaBy = new Map<string, number>();
    for (const a of cargas ?? []) {
      cargaBy.set(a.user_id, (cargaBy.get(a.user_id) ?? 0) + 1);
    }
    const indispSet = new Set((indisp ?? []).map((u) => u.user_id));
    const skillsBy = new Map<string, string[]>();
    for (const skill of apts ?? []) {
      const nome = (skill.skills as unknown as { name: string }).name;
      skillsBy.set(skill.user_id, [...(skillsBy.get(skill.user_id) ?? []), nome]);
    }
    const intBy = new Map<string, string[]>();
    for (const interest of ints ?? []) {
      const nome = (interest.skills as unknown as { name: string }).name;
      intBy.set(interest.user_id, [...(intBy.get(interest.user_id) ?? []), nome]);
    }

    members = (m ?? []).map((member) => ({
      user_id: member.user_id,
      full_name: (member.profiles as unknown as { full_name: string }).full_name,
      cargaMes: cargaBy.get(member.user_id) ?? 0,
      indisponivel: indispSet.has(member.user_id),
      aptidoes: skillsBy.get(member.user_id) ?? [],
      interesses: intBy.get(member.user_id) ?? [],
    }));
    equipments = eq ?? [];
  }

  const teamMap = new Map<string, TeamGroup>();
  for (const assignment of allAssignments) {
    const ministry = firstRelated(assignment.ministries);
    if (!ministry) continue;
    const current = teamMap.get(assignment.ministry_id);
    if (current) {
      current.rows.push(assignment);
    } else {
      teamMap.set(assignment.ministry_id, {
        ministryId: assignment.ministry_id,
        ministryName: ministry.name,
        rows: [assignment],
      });
    }
  }
  const teams = [...teamMap.values()].sort((a, b) =>
    a.ministryName.localeCompare(b.ministryName, "pt-BR")
  );

  const totalConfirmados = allAssignments.filter((a) =>
    ["confirmado", "presente"].includes(a.status)
  ).length;
  const totalPendencias = allAssignments.filter((a) =>
    ["convidado", "substituicao_solicitada", "falar_lider"].includes(a.status)
  ).length;

  const type = event.event_types as unknown as { name: string } | null;
  const dept = event.departments as unknown as { name: string } | null;
  const canDeleteEvent =
    tenant.role === "admin" &&
    !tenant.isMaster &&
    new Date(event.starts_at).getTime() > new Date().getTime();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {type?.name ?? "Evento"}
          </Badge>
          {dept?.name && (
            <Badge variant="outline" className="rounded-full">
              {dept.name}
            </Badge>
          )}
          <Badge
            className={`rounded-full border-0 ${
              event.setlist_status === "publicado"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            }`}
          >
            Repertório {event.setlist_status === "publicado" ? "publicado" : "em rascunho"}
          </Badge>
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          {event.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Visão geral do culto: programação, repertório e todos os times que servem neste evento.
        </p>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Data
              </p>
              <p className="mt-0.5 font-medium">{formatEventDate(event.starts_at)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Horário
              </p>
              <p className="mt-0.5 font-medium">
                {formatEventTime(event.starts_at)}
                {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Local / campus
              </p>
              {event.location ? (
                event.map_url ? (
                  <a
                    href={event.map_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block truncate font-medium underline underline-offset-4"
                  >
                    {event.location}
                  </a>
                ) : (
                  <p className="mt-0.5 truncate font-medium">{event.location}</p>
                )
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">Não informado</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="repertorio-title">
        <h2 id="repertorio-title" className="px-1 text-lg font-semibold tracking-tight">
          Repertório
        </h2>
        {setlistError ? (
          <LoadError oQue="o repertório" />
        ) : (
          <EventSetlistSummary
            churchSlug={churchSlug}
            eventId={id}
            items={itensRepertorio}
            published={event.setlist_status === "publicado"}
            canOpenLouvor={canOpenLouvor}
          />
        )}
      </section>

      <section className="space-y-3" aria-labelledby="ordem-culto-title">
        <h2
          id="ordem-culto-title"
          className="px-1 text-lg font-semibold tracking-tight"
        >
          Ordem do Culto
        </h2>
        {serviceItemsError ? (
          <LoadError oQue="a ordem do culto" />
        ) : (
          <ServiceOrderCard
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            eventId={id}
            startsAt={event.starts_at}
            items={(serviceItems ?? []) as ServiceItem[]}
            canManage={canManageActive}
          />
        )}
      </section>

      <section className="space-y-4" aria-labelledby="times-title">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <div className="flex items-center gap-2">
              <Users className="size-5" />
              <h2 id="times-title" className="text-lg font-semibold tracking-tight">
                Times do culto
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Visão consolidada das equipes deste evento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="rounded-full">
              {teams.length} {teams.length === 1 ? "ministério" : "ministérios"}
            </Badge>
            <Badge variant="secondary" className="rounded-full">
              {allAssignments.length} escalados
            </Badge>
            <Badge className="rounded-full border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {totalConfirmados} confirmados
            </Badge>
            {totalPendencias > 0 && (
              <Badge className="rounded-full border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {totalPendencias} pendências
              </Badge>
            )}
          </div>
        </div>

        {mineAssignments.length > 0 && (
          <div className="space-y-3">
            <p className="px-1 text-sm font-medium">Minha participação</p>
            {mineAssignments.map((mine) => {
              const ministry = firstRelated(mine.ministries);
              return (
                <div key={mine.id} className="space-y-1">
                  {ministry && (
                    <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {ministry.name}
                    </p>
                  )}
                  <MyAssignmentCard
                    churchSlug={churchSlug}
                    churchId={tenant.church.id}
                    eventId={id}
                    assignmentId={mine.id}
                    roleName={mine.role_name}
                    status={mine.status}
                    arrivalTime={mine.arrival_time}
                    itemsToBring={mine.items_to_bring}
                    equipments={(equipByAssignment.get(mine.id) ?? []).map((e) => e.name)}
                    leaderName={firstRelated(mine.leader)?.full_name ?? null}
                  />
                </div>
              );
            })}
          </div>
        )}

        {assignmentsError ? (
          <LoadError oQue="os times do culto" />
        ) : teams.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {teams.map((team) => {
              const confirmed = team.rows.filter((row) =>
                ["confirmado", "presente"].includes(row.status)
              ).length;
              const pending = team.rows.filter((row) =>
                ["convidado", "substituicao_solicitada", "falar_lider"].includes(row.status)
              ).length;
              const dedicatedHref =
                team.ministryId === louvor?.id
                  ? `/${churchSlug}/louvor/escalas/${id}`
                  : team.ministryId === kids?.id
                    ? `/${churchSlug}/infantil/escalas/${id}`
                    : null;

              return (
                <Card key={team.ministryId} className="rounded-3xl">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{team.ministryName}</CardTitle>
                        <CardDescription>
                          {team.rows.length} escalados · {confirmed} confirmados
                          {pending > 0 ? ` · ${pending} pendências` : ""}
                        </CardDescription>
                      </div>
                      {dedicatedHref && (
                        <Link
                          href={dedicatedHref}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-accent"
                        >
                          Abrir escala
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {team.rows.map((row) => (
                      <div
                        key={row.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {firstRelated(row.profiles)?.full_name ?? "—"}
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {row.role_name}
                          </p>
                        </div>
                        <Badge
                          className={`shrink-0 rounded-full border-0 ${assignmentStatusClass(row.status)}`}
                        >
                          {assignmentStatusLabel(row.status)}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="rounded-3xl">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum time escalado neste evento ainda.
            </CardContent>
          </Card>
        )}
      </section>

      {canManageGeneric && activeMinistryId && active && (
        <section className="space-y-3" aria-labelledby="gestao-time-title">
          <div className="px-1">
            <h2 id="gestao-time-title" className="text-lg font-semibold tracking-tight">
              Gerenciar {active.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Este ministério ainda usa a área geral de Escalas para montar sua equipe.
            </p>
          </div>
          <Card className="rounded-3xl">
            <CardContent className="pt-6">
              <AssignmentManager
                churchSlug={churchSlug}
                churchId={tenant.church.id}
                ministryId={activeMinistryId}
                eventId={id}
                assignments={activeRows}
                members={members}
                equipments={equipments}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {(event.description || event.script) && (
        <section className="space-y-3" aria-labelledby="informacoes-title">
          <h2 id="informacoes-title" className="px-1 text-lg font-semibold tracking-tight">
            Informações do culto
          </h2>
          {event.description && (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {event.description}
                </p>
              </CardContent>
            </Card>
          )}
          {event.script && (
            <Card className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">Roteiro do culto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {event.script}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {canDeleteEvent && (
        <section className="hidden border-t pt-6 md:flex md:justify-end">
          <DeleteFutureEventButton
            context={{
              churchSlug,
              churchId: tenant.church.id,
              eventId: id,
              eventTitle: event.title,
            }}
            redirectTo={`/${churchSlug}/escalas`}
          />
        </section>
      )}
    </div>
  );
}