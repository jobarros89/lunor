import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin, TriangleAlert, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadError } from "@/components/shell/load-error";
import { AssignmentManager, type AssignmentRow } from "@/components/escalas/assignment-manager";
import { MyAssignmentCard } from "@/components/escalas/my-assignment-card";
import { ASSIGNMENT_STATUS_BADGE, ASSIGNMENT_STATUS_LABELS } from "@/lib/escalas";

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function MinistryEventSchedule({
  churchSlug,
  ministryId,
  ministryName,
  eventId,
  backHref,
  backLabel,
  actionHref,
  actionLabel,
}: {
  churchSlug: string;
  ministryId: string;
  ministryName: string;
  eventId: string;
  backHref: string;
  backLabel: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("ministry_members")
    .select("role")
    .eq("church_id", tenant.church.id)
    .eq("ministry_id", ministryId)
    .eq("user_id", tenant.userId)
    .eq("active", true)
    .maybeSingle();

  if (!tenant.isCoord && !membership) redirect(`/${churchSlug}`);
  const canManage = tenant.isCoord || membership?.role === "gerente" || membership?.role === "lider";

  const [
    { data: event, error: eventError },
    { data: assignments, error: assignmentsError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location, service_period, campuses(name), event_types(name)")
      .eq("church_id", tenant.church.id)
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("id, user_id, role_name, status, arrival_time, items_to_bring, profiles!assignments_user_id_fkey(full_name), leader:profiles!assignments_leader_id_fkey(full_name)")
      .eq("church_id", tenant.church.id)
      .eq("event_id", eventId)
      .eq("ministry_id", ministryId)
      .order("created_at"),
  ]);

  if (eventError) console.error(`${ministryName}: evento da escala`, eventError);
  if (!event) notFound();

  const assignmentIds = (assignments ?? []).map((item) => item.id);
  const { data: equipmentLinks } = assignmentIds.length
    ? await supabase
        .from("assignment_equipments")
        .select("assignment_id, equipments!inner(id, name)")
        .eq("church_id", tenant.church.id)
        .in("assignment_id", assignmentIds)
    : { data: [] as { assignment_id: string; equipments: unknown }[] };

  const equipByAssignment = new Map<string, { id: string; name: string }[]>();
  for (const link of equipmentLinks ?? []) {
    const equipment = link.equipments as unknown as { id: string; name: string };
    equipByAssignment.set(link.assignment_id, [
      ...(equipByAssignment.get(link.assignment_id) ?? []),
      equipment,
    ]);
  }

  const rows: AssignmentRow[] = (assignments ?? []).map((assignment) => ({
    id: assignment.id,
    user_id: assignment.user_id,
    full_name:
      (assignment.profiles as unknown as { full_name: string } | null)?.full_name ?? "—",
    role_name: assignment.role_name,
    status: assignment.status,
    equipments: equipByAssignment.get(assignment.id) ?? [],
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

  if (canManage) {
    const eventDate = new Date(event.starts_at);
    const monthStart = new Date(eventDate.getFullYear(), eventDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 1).toISOString();
    const eventDay = event.starts_at.slice(0, 10);

    const [
      { data: ministryMembers },
      { data: availableEquipments },
      { data: monthLoads },
      { data: unavailable },
      { data: skills },
      { data: interests },
    ] = await Promise.all([
      supabase
        .from("ministry_members")
        .select("user_id, profiles!inner(full_name)")
        .eq("church_id", tenant.church.id)
        .eq("ministry_id", ministryId)
        .eq("active", true),
      supabase
        .from("equipments")
        .select("id, name")
        .eq("church_id", tenant.church.id)
        .or(`ministry_id.eq.${ministryId},ministry_id.is.null`)
        .in("status", ["disponivel", "em_uso"])
        .order("name"),
      supabase
        .from("assignments")
        .select("user_id, events!inner(starts_at)")
        .eq("church_id", tenant.church.id)
        .eq("ministry_id", ministryId)
        .gte("events.starts_at", monthStart)
        .lt("events.starts_at", monthEnd),
      supabase
        .from("unavailability")
        .select("user_id")
        .eq("church_id", tenant.church.id)
        .lte("start_date", eventDay)
        .gte("end_date", eventDay),
      supabase
        .from("member_skills")
        .select("user_id, skills!inner(name)")
        .eq("church_id", tenant.church.id)
        .not("approved_by", "is", null),
      supabase
        .from("member_interests")
        .select("user_id, skills!inner(name)")
        .eq("church_id", tenant.church.id),
    ]);

    const loadByUser = new Map<string, number>();
    for (const item of monthLoads ?? []) {
      loadByUser.set(item.user_id, (loadByUser.get(item.user_id) ?? 0) + 1);
    }
    const unavailableUsers = new Set((unavailable ?? []).map((item) => item.user_id));
    const skillsByUser = new Map<string, string[]>();
    for (const item of skills ?? []) {
      const name = (item.skills as unknown as { name: string }).name;
      skillsByUser.set(item.user_id, [...(skillsByUser.get(item.user_id) ?? []), name]);
    }
    const interestsByUser = new Map<string, string[]>();
    for (const item of interests ?? []) {
      const name = (item.skills as unknown as { name: string }).name;
      interestsByUser.set(item.user_id, [...(interestsByUser.get(item.user_id) ?? []), name]);
    }

    members = (ministryMembers ?? []).map((item) => ({
      user_id: item.user_id,
      full_name: (item.profiles as unknown as { full_name: string }).full_name,
      cargaMes: loadByUser.get(item.user_id) ?? 0,
      indisponivel: unavailableUsers.has(item.user_id),
      aptidoes: skillsByUser.get(item.user_id) ?? [],
      interesses: interestsByUser.get(item.user_id) ?? [],
    }));
    equipments = availableEquipments ?? [];
  }

  const mine = (assignments ?? []).filter((assignment) => assignment.user_id === tenant.userId);
  const confirmed = rows.filter((item) => item.status === "confirmado" || item.status === "presente").length;
  const waiting = rows.filter((item) => item.status === "convidado").length;
  const attention = rows.filter((item) => ["substituicao_solicitada", "falar_lider", "ausente"].includes(item.status)).length;
  const campus = firstRelated(event.campuses as { name: string } | { name: string }[] | null);
  const type = firstRelated(event.event_types as { name: string } | { name: string }[] | null);
  const context = eventContextLabel({
    campusName: campus?.name,
    servicePeriod: event.service_period,
    fallbackLocation: event.location,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">
          <ArrowLeft className="size-4" />
          {backLabel}
        </Link>
        <div className="flex flex-wrap gap-2">
          {actionHref && actionLabel && (
            <Link href={actionHref} className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition hover:bg-accent">
              {actionLabel}
            </Link>
          )}
          <Link href={`/${churchSlug}/escalas/${eventId}`} className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition hover:bg-accent">
            Ver culto completo
          </Link>
        </div>
      </div>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">{ministryName}</Badge>
          {type?.name && <Badge variant="outline" className="rounded-full">{type.name}</Badge>}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{event.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Escala e equipe de {ministryName}</p>
        </div>
      </header>

      <Card className="rounded-3xl">
        <CardContent className="grid gap-4 py-5 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Data</p>
              <p className="mt-0.5 font-medium">{formatEventDate(event.starts_at)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Horário</p>
              <p className="mt-0.5 font-medium">{formatEventTime(event.starts_at)}{event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contexto</p>
              <p className="mt-0.5 truncate font-medium">{context || "Não informado"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={`Métricas da escala de ${ministryName}`}>
        <SmallMetric icon={Users} value={rows.length} label="Escalados" />
        <SmallMetric icon={CheckCircle2} value={confirmed} label="Confirmados" />
        <SmallMetric icon={Clock3} value={waiting} label="Aguardando" />
        <SmallMetric icon={TriangleAlert} value={attention} label="Atenção" />
      </section>

      {mine.map((assignment) => (
        <MyAssignmentCard
          key={assignment.id}
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          eventId={eventId}
          assignmentId={assignment.id}
          roleName={assignment.role_name}
          status={assignment.status}
          arrivalTime={assignment.arrival_time}
          itemsToBring={assignment.items_to_bring}
          equipments={(equipByAssignment.get(assignment.id) ?? []).map((item) => item.name)}
          leaderName={(assignment.leader as unknown as { full_name: string } | null)?.full_name ?? null}
        />
      ))}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Equipe de {ministryName} ({rows.length})</CardTitle>
          <CardDescription>Funções, confirmações e distribuição da equipe neste evento</CardDescription>
        </CardHeader>
        <CardContent>
          {assignmentsError ? (
            <LoadError oQue={`a equipe de ${ministryName}`} />
          ) : canManage ? (
            <AssignmentManager
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              ministryId={ministryId}
              eventId={eventId}
              assignments={rows}
              members={members}
              equipments={equipments}
            />
          ) : (
            <div className="space-y-2">
              {rows.map((assignment) => (
                <div key={assignment.id} className="flex items-start justify-between gap-3 rounded-2xl border px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{assignment.full_name}</p>
                    <p className="truncate text-sm text-muted-foreground">{assignment.role_name}</p>
                  </div>
                  <Badge className={`shrink-0 rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[assignment.status] ?? ""}`}>
                    {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
                  </Badge>
                </div>
              ))}
              {rows.length === 0 && <p className="text-sm text-muted-foreground">Ninguém escalado ainda.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SmallMetric({
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
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
