import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, Clock3, MapPin, Users } from "lucide-react";
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
import { MyAssignmentCard } from "@/components/escalas/my-assignment-card";
import { DeleteFutureEventButton } from "@/components/escalas/event-delete-control";
import {
  ServiceOrderCard,
  type ServiceItem,
} from "@/components/escalas/service-order-card";
import { AddEventTeam } from "@/components/escalas/event-team-controls";
import {
  EventResponsibilities,
  type EventResponsibilityMember,
} from "@/components/escalas/event-responsibilities";
import {
  EventSetlistSummary,
  type EventSetlistSummaryItem,
} from "@/components/louvor/event-setlist-summary";

type EventAssignment = {
  id: string;
  ministry_id: string | null;
  assignment_scope: "team" | "event";
  user_id: string;
  role_name: string;
  status: string;
  arrival_time: string | null;
  items_to_bring: string | null;
  ministries: { id: string; name: string } | { id: string; name: string }[] | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
  leader: { full_name: string } | { full_name: string }[] | null;
};

type EventMinistryLink = {
  ministry_id: string;
  ministries: { id: string; name: string; module_key: "generic" | "worship" | "kids" } | { id: string; name: string; module_key: "generic" | "worship" | "kids" }[];
};

type TeamGroup = {
  ministryId: string;
  ministryName: string;
  moduleKey: "generic" | "worship" | "kids";
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
  const { options } = await getActiveMinistry(churchSlug);

  const supabase = await createClient();
  const [
    { data: event, error: eventError },
    { data: assignments, error: assignmentsError },
    { data: serviceItems, error: serviceItemsError },
    { data: eventMinistries, error: eventMinistriesError },
    { data: churchMembers, error: churchMembersError },
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
        "id, ministry_id, assignment_scope, user_id, role_name, status, arrival_time, items_to_bring, ministries(id, name), profiles!assignments_user_id_fkey(full_name), leader:profiles!assignments_leader_id_fkey(full_name)"
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
    supabase
      .from("event_ministries")
      .select("ministry_id, ministries!inner(id, name, module_key)")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id),
    tenant.isCoord
      ? supabase
          .from("church_members")
          .select("user_id, profiles!inner(full_name)")
          .eq("church_id", tenant.church.id)
          .eq("status", "active")
          .order("full_name", { referencedTable: "profiles" })
      : Promise.resolve({ data: [], error: null }),
    getLouvorMinistry(tenant.church.id),
    getInfantilMinistry(tenant.church.id),
  ]);

  if (eventError) console.error("evento:", eventError);
  if (!event) notFound();

  const canManageAtEventCampus = (option: (typeof options)[number]) =>
    option.canManage &&
    (
      tenant.isCoord ||
      option.permissionCampusIds === null ||
      (
        event.campus_id !== null &&
        option.permissionCampusIds.includes(event.campus_id)
      )
    );
  const canManageEvent = tenant.isCoord || options.some(canManageAtEventCampus);

  const allAssignments = (assignments ?? []) as unknown as EventAssignment[];
  const eventResponsibilities = allAssignments.filter(
    (assignment) => assignment.assignment_scope === "event"
  );
  const teamAssignments = allAssignments.filter(
    (assignment) => assignment.assignment_scope !== "event"
  );
  const responsibilityMembers = (churchMembers ?? []).map((membership) => ({
    user_id: membership.user_id,
    full_name:
      firstRelated(
        membership.profiles as unknown as
          | { full_name: string }
          | { full_name: string }[]
          | null
      )?.full_name ?? "Sem nome",
  })) satisfies EventResponsibilityMember[];
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
  const equipmentAssignmentIds = [
    ...new Set(mineAssignments.map((assignment) => assignment.id)),
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

  const teamMap = new Map<string, TeamGroup>();
  for (const link of (eventMinistries ?? []) as unknown as EventMinistryLink[]) {
    const ministry = firstRelated(link.ministries);
    if (!ministry) continue;
    teamMap.set(link.ministry_id, {
      ministryId: link.ministry_id,
      ministryName: ministry.name,
      moduleKey: ministry.module_key,
      rows: [],
    });
  }
  // Compatibility for assignments created before event_ministries existed.
  for (const assignment of teamAssignments) {
    const ministry = firstRelated(assignment.ministries);
    if (!ministry) continue;
    const current = teamMap.get(assignment.ministry_id);
    if (current) {
      current.rows.push(assignment);
    } else {
      teamMap.set(assignment.ministry_id, {
        ministryId: assignment.ministry_id,
        ministryName: ministry.name,
        moduleKey:
          assignment.ministry_id === louvor?.id
            ? "worship"
            : assignment.ministry_id === kids?.id
              ? "kids"
              : "generic",
        rows: [assignment],
      });
    }
  }
  const teams = [...teamMap.values()].sort((a, b) =>
    a.ministryName.localeCompare(b.ministryName, "pt-BR")
  );
  const linkedMinistryIds = new Set(teams.map((team) => team.ministryId));
  const addableMinistries = options
    .filter((option) => canManageAtEventCampus(option) && !linkedMinistryIds.has(option.id))
    .map((option) => ({ id: option.id, name: option.name }));

  const totalConfirmados = teamAssignments.filter((a) =>
    ["confirmado", "presente"].includes(a.status)
  ).length;
  const totalPendencias = teamAssignments.filter((a) =>
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
          <Badge variant="secondary" >
            {type?.name ?? "Evento"}
          </Badge>
          {dept?.name && (
            <Badge variant="outline" >
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
        <h1 className="page-title ">
          {event.title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Visão geral do culto: programação, repertório e todos os times que servem neste evento.
        </p>
      </header>

      <Card>
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

      {mineAssignments.length > 0 && (
        <section className="space-y-3" aria-labelledby="minha-participacao-title">
          <h2 id="minha-participacao-title" className="px-1 text-lg font-semibold tracking-tight">
            Minha participação
          </h2>
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
        </section>
      )}

      <section aria-label="Repertório">
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

      <section aria-label="Ordem do culto">
        {serviceItemsError ? (
          <LoadError oQue="a ordem do culto" />
        ) : (
          <ServiceOrderCard
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            eventId={id}
            startsAt={event.starts_at}
            items={(serviceItems ?? []) as ServiceItem[]}
            canManage={canManageEvent}
          />
        )}
      </section>

      {(eventResponsibilities.length > 0 || tenant.isCoord) && (
        <section className="space-y-4" aria-labelledby="event-responsibilities-title">
          <div className="px-1">
            <div className="flex items-center gap-2">
              <BriefcaseBusiness className="size-5" aria-hidden="true" />
              <h2
                id="event-responsibilities-title"
                className="text-lg font-semibold tracking-tight"
              >
                Responsabilidades do evento
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Funções ligadas diretamente ao culto, sem vínculo artificial com um time.
            </p>
          </div>
          <Card>
            <CardContent className="pt-5">
              {churchMembersError ? (
                <LoadError oQue="as pessoas disponíveis" />
              ) : (
                <EventResponsibilities
                  churchSlug={churchSlug}
                  churchId={tenant.church.id}
                  eventId={id}
                  responsibilities={eventResponsibilities.map((assignment) => ({
                    id: assignment.id,
                    user_id: assignment.user_id,
                    full_name:
                      firstRelated(assignment.profiles)?.full_name ?? "—",
                    role_name: assignment.role_name,
                    status: assignment.status,
                  }))}
                  members={responsibilityMembers}
                  canManage={tenant.isCoord}
                />
              )}
            </CardContent>
          </Card>
        </section>
      )}

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
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {addableMinistries.length > 0 && (
              <AddEventTeam
                churchSlug={churchSlug}
                churchId={tenant.church.id}
                eventId={id}
                options={addableMinistries}
              />
            )}
            <Badge variant="secondary" >
              {teams.length} {teams.length === 1 ? "ministério" : "ministérios"}
            </Badge>
            <Badge variant="secondary" >
              {teamAssignments.length} escalados
            </Badge>
            <Badge className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              {totalConfirmados} confirmados
            </Badge>
            {totalPendencias > 0 && (
              <Badge className="border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {totalPendencias} pendências
              </Badge>
            )}
          </div>
        </div>

        {assignmentsError || eventMinistriesError ? (
          <LoadError oQue="os times do culto" />
        ) : teams.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {teams.map((team) => {
              const visibleRows = team.rows.filter((row) => row.user_id !== tenant.userId);
              const confirmed = team.rows.filter((row) =>
                ["confirmado", "presente"].includes(row.status)
              ).length;
              const pending = team.rows.filter((row) =>
                ["convidado", "substituicao_solicitada", "falar_lider"].includes(row.status)
              ).length;
              const dedicatedHref =
                team.moduleKey === "worship"
                  ? `/${churchSlug}/louvor/escalas/${id}`
                  : team.moduleKey === "kids"
                    ? `/${churchSlug}/infantil/escalas/${id}`
                    : null;
              const canOpenGeneric = options.some(
                (option) => option.id === team.ministryId && option.canManage
              );

              return (
                <Card key={team.ministryId} >
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{team.ministryName}</CardTitle>
                        <CardDescription>
                          {team.rows.length} escalados · {confirmed} confirmados
                          {pending > 0 ? ` · ${pending} pendências` : ""}
                        </CardDescription>
                      </div>
                      {dedicatedHref ? (
                        <Link
                          href={dedicatedHref}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-accent"
                        >
                          Abrir escala
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      ) : canOpenGeneric ? (
                        <Link
                          href={`/${churchSlug}/escalas/${id}/times/${team.ministryId}`}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors hover:bg-accent"
                        >
                          Abrir escala
                          <ArrowUpRight className="size-3.5" />
                        </Link>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {visibleRows.map((row) => (
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
                    {visibleRows.length === 0 && (
                      <p className="py-2 text-sm text-muted-foreground">
                        {team.rows.length === 0 ? "Nenhuma pessoa escalada ainda." : "Sua participação está destacada acima."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum time escalado neste evento ainda.
            </CardContent>
          </Card>
        )}
      </section>

      {(event.description || event.script) && (
        <section className="space-y-3" aria-labelledby="informacoes-title">
          <h2 id="informacoes-title" className="px-1 text-lg font-semibold tracking-tight">
            Informações do culto
          </h2>
          {event.description && (
            <Card>
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
            <Card>
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
