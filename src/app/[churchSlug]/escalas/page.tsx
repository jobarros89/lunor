import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  ASSIGNMENT_STATUS_BADGE,
  ASSIGNMENT_STATUS_LABELS,
  formatEventDate,
  formatEventTime,
} from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/shell/load-error";
import { Card, CardContent } from "@/components/ui/card";
import { FutureEventLink } from "@/components/escalas/event-delete-control";
import { cn } from "@/lib/utils";

type RelatedName = { name: string } | { name: string }[] | null;
type MyAssignment = {
  event_id: string;
  ministry_id: string;
  role_name: string;
  status: string;
  arrival_time: string | null;
  release_time: string | null;
  assignment_ministry: RelatedName;
  assignment_department: RelatedName;
};
type ServiceWindow = {
  event_id: string;
  ministry_id: string;
  arrival_at: string | null;
  release_at: string | null;
};

function firstRelated(value: RelatedName) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function pairKey(eventId: string, ministryId: string) {
  return `${eventId}:${ministryId}`;
}

export default async function EscalasPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { churchSlug } = await params;
  const { filtro } = await searchParams;
  const tenant = await getTenant(churchSlug);
  const verMinhas = filtro ? filtro === "minhas" : !tenant.isLeader;
  const canDeleteEvents = tenant.role === "admin" && !tenant.isMaster;

  const supabase = await createClient();
  const now = new Date();
  const since = new Date(now);
  since.setHours(0, 0, 0, 0);

  const [
    { data: events, error: eventsError },
    { data: myAssignments },
    { data: serviceWindows, error: windowsError },
  ] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, location, campus_id, service_period, starts_at, event_types(name), departments(name), campuses(name)"
      )
      .eq("church_id", tenant.church.id)
      .gte("starts_at", since.toISOString())
      .order("starts_at")
      .limit(200),
    supabase
      .from("assignments")
      .select("event_id, ministry_id, role_name, status, arrival_time, release_time, assignment_ministry:ministries(name), assignment_department:departments(name)")
      .eq("church_id", tenant.church.id)
      .eq("user_id", tenant.userId),
    supabase
      .from("event_ministry_windows")
      .select("event_id, ministry_id, arrival_at, release_at, events!inner(starts_at)")
      .eq("church_id", tenant.church.id)
      .gte("events.starts_at", since.toISOString()),
  ]);
  if (eventsError) console.error("escalas:", eventsError);
  if (windowsError) console.error("escalas: janelas de serviço", windowsError);

  const myByEvent = new Map<string, MyAssignment[]>();
  for (const assignment of (myAssignments ?? []) as unknown as MyAssignment[]) {
    myByEvent.set(assignment.event_id, [
      ...(myByEvent.get(assignment.event_id) ?? []),
      assignment,
    ]);
  }
  const windowByPair = new Map<string, ServiceWindow>();
  for (const window of (serviceWindows ?? []) as unknown as ServiceWindow[]) {
    windowByPair.set(pairKey(window.event_id, window.ministry_id), window);
  }

  const todos = events ?? [];
  const meus = todos.filter((e) => myByEvent.has(e.id));
  const visiveis = verMinhas ? meus : todos;
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const groupedEvents = Object.entries(
    visiveis.reduce<Record<string, { label: string; events: typeof visiveis }>>((groups, event) => {
      const assignments = myByEvent.get(event.id) ?? [];
      const effectiveDates = assignments.map((assignment) => {
        const window = windowByPair.get(pairKey(event.id, assignment.ministry_id));
        return new Date(assignment.arrival_time ?? window?.arrival_at ?? event.starts_at);
      });
      const date = effectiveDates.length > 0
        ? new Date(Math.min(...effectiveDates.map((item) => item.getTime())))
        : new Date(event.starts_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const group = groups[monthKey] ?? {
        label: new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(date),
        events: [],
      };
      group.events.push(event);
      groups[monthKey] = group;
      return groups;
    }, {})
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title ">Escalas</h1>
          <p className="text-muted-foreground">Próximos eventos</p>
        </div>
        {tenant.isLeader && (
          <Button
            className="h-11 rounded-full px-5"
            nativeButton={false}
            render={<Link href={`/${churchSlug}/escalas/novo`} />}
          >
            <Plus className="size-4" />
            Novo
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Link
          href={`/${churchSlug}/escalas?filtro=minhas`}
          aria-current={verMinhas ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            verMinhas
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:border-foreground/40"
          )}
        >
          Minhas ({meus.length})
        </Link>
        <Link
          href={`/${churchSlug}/escalas?filtro=todas`}
          aria-current={!verMinhas ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
            !verMinhas
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background hover:border-foreground/40"
          )}
        >
          Todas ({todos.length})
        </Link>
      </div>

      <div className="space-y-3">
        {groupedEvents.map(([monthKey, group]) => {
          const startsWithinThirtyDays = group.events.some(
            (event) => new Date(event.starts_at).getTime() <= thirtyDaysFromNow.getTime()
          );
          return (
            <details key={monthKey} open={startsWithinThirtyDays} className="group overflow-hidden rounded-3xl border bg-card/40">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="block font-semibold capitalize">{group.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {group.events.length} {group.events.length === 1 ? "evento" : "eventos"}
                  </span>
                </span>
                <ChevronDown className="size-5 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="divide-y border-t">
                {group.events.map((e) => {
                  const type = e.event_types as unknown as { name: string } | null;
                  const dept = e.departments as unknown as { name: string } | null;
                  const campus = e.campuses as unknown as { name: string } | null;
                  const context = eventContextLabel({
                    campusName: campus?.name,
                    servicePeriod: e.service_period,
                    fallbackLocation: e.location,
                  });
                  const mine = myByEvent.get(e.id);
                  const serviceStarts = (mine ?? []).map((assignment) => {
                    const window = windowByPair.get(pairKey(e.id, assignment.ministry_id));
                    return assignment.arrival_time ?? window?.arrival_at ?? e.starts_at;
                  });
                  const serviceReleases = (mine ?? [])
                    .map((assignment) => {
                      const window = windowByPair.get(pairKey(e.id, assignment.ministry_id));
                      return assignment.release_time ?? window?.release_at ?? null;
                    })
                    .filter((value): value is string => Boolean(value));
                  const serviceStart = serviceStarts.length > 0
                    ? new Date(Math.min(...serviceStarts.map((value) => new Date(value).getTime()))).toISOString()
                    : e.starts_at;
                  const serviceRelease = serviceReleases.length > 0
                    ? new Date(Math.max(...serviceReleases.map((value) => new Date(value).getTime()))).toISOString()
                    : null;
                  const hasDifferentServiceTime = Boolean(mine) && serviceStart !== e.starts_at;
                  const canDelete =
                    canDeleteEvents && new Date(e.starts_at).getTime() > now.getTime();
                  return (
                    <FutureEventLink
                      key={e.id}
                      href={`/${churchSlug}/escalas/${e.id}`}
                      canDelete={canDelete}
                      context={{
                        churchSlug,
                        churchId: tenant.church.id,
                        eventId: e.id,
                        eventTitle: e.title,
                      }}
                    >
                      <div className="grid min-h-[78px] gap-3 px-4 py-3 transition-colors hover:bg-accent/40 sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          <span className="block">{formatEventDate(serviceStart)}</span>
                          <span className="mt-0.5 block text-foreground">
                            {formatEventTime(serviceStart)}{mine ? " chegada" : ""}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold tracking-tight">{e.title}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {[
                              hasDifferentServiceTime ? `Culto ${formatEventTime(e.starts_at)}` : null,
                              type?.name,
                              context,
                              dept?.name,
                              serviceRelease ? `Saída ${formatEventTime(serviceRelease)}` : null,
                            ].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                        {mine && (
                          <div className="flex flex-wrap items-center gap-1.5 sm:max-w-[24rem] sm:justify-end">
                            {mine.map((assignment, index) => {
                              const serviceArea =
                                firstRelated(assignment.assignment_department)?.name ??
                                firstRelated(assignment.assignment_ministry)?.name ??
                                "Equipe";
                              return (
                                <span key={`${assignment.event_id}-${assignment.role_name}-${index}`} className="inline-flex items-center gap-2">
                                  <Badge variant="secondary" className="rounded-full">
                                    {serviceArea} · {assignment.role_name}
                                  </Badge>
                                  <Badge
                                    className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[assignment.status] ?? ""}`}
                                  >
                                    {ASSIGNMENT_STATUS_LABELS[assignment.status] ?? assignment.status}
                                  </Badge>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </FutureEventLink>
                  );
                })}
              </div>
            </details>
          );
        })}
        {eventsError || windowsError ? (
          <LoadError oQue="as escalas" />
        ) : (
          visiveis.length === 0 && (
            <Card className="rounded-3xl">
              <CardContent className="space-y-3 py-10 text-center text-sm text-muted-foreground">
                {verMinhas ? (
                  <>
                    <p>Você não está escalado em nenhum evento futuro.</p>
                    {todos.length > 0 && (
                      <Link
                        href={`/${churchSlug}/escalas?filtro=todas`}
                        className="inline-block font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        Ver todas as escalas da igreja
                      </Link>
                    )}
                  </>
                ) : (
                  <p>
                    Nenhum evento futuro.
                    {tenant.isLeader && " Crie o primeiro no botão acima."}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
