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
  role_name: string;
  status: string;
  assignment_ministry: RelatedName;
  assignment_department: RelatedName;
};

function firstRelated(value: RelatedName) {
  return Array.isArray(value) ? value[0] ?? null : value;
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

  const [{ data: events, error: eventsError }, { data: myAssignments }] =
    await Promise.all([
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
        .select("event_id, role_name, status, assignment_ministry:ministries(name), assignment_department:departments(name)")
        .eq("church_id", tenant.church.id)
        .eq("user_id", tenant.userId),
    ]);
  if (eventsError) console.error("escalas:", eventsError);

  const myByEvent = new Map<string, MyAssignment[]>();
  for (const assignment of (myAssignments ?? []) as unknown as MyAssignment[]) {
    myByEvent.set(assignment.event_id, [
      ...(myByEvent.get(assignment.event_id) ?? []),
      assignment,
    ]);
  }

  const todos = events ?? [];
  const meus = todos.filter((e) => myByEvent.has(e.id));
  const visiveis = verMinhas ? meus : todos;
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const groupedEvents = Object.entries(
    visiveis.reduce<Record<string, { label: string; events: typeof visiveis }>>((groups, event) => {
      const date = new Date(event.starts_at);
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
          <h1 className="text-2xl font-semibold tracking-tight">Escalas</h1>
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
                  <span className="block">{formatEventDate(e.starts_at)}</span>
                  <span className="mt-0.5 block text-foreground">{formatEventTime(e.starts_at)}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-tight">{e.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[type?.name, context, dept?.name].filter(Boolean).join(" · ") || "—"}
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
        {eventsError ? (
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
