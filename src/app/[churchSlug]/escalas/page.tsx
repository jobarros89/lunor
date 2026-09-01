import Link from "next/link";
import { CalendarCheck2, Plus } from "lucide-react";
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
        .limit(50),
      supabase
        .from("assignments")
        .select("event_id, role_name, status")
        .eq("church_id", tenant.church.id)
        .eq("user_id", tenant.userId),
    ]);
  if (eventsError) console.error("escalas:", eventsError);

  const myByEvent = new Map((myAssignments ?? []).map((a) => [a.event_id, a]));

  const todos = events ?? [];
  const meus = todos.filter((e) => myByEvent.has(e.id));
  const visiveis = verMinhas ? meus : todos;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Escalas</h1>
          <p className="text-muted-foreground">Próximos eventos</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-11 rounded-full px-4"
            nativeButton={false}
            render={<Link href={`/${churchSlug}/disponibilidade`} />}
          >
            <CalendarCheck2 className="size-4" />
            Disponibilidade
          </Button>
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
        {visiveis.map((e) => {
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
              <Card className="rounded-3xl transition-colors hover:bg-accent/40">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {formatEventDate(e.starts_at)} · {formatEventTime(e.starts_at)}
                      </p>
                      <p className="mt-0.5 truncate text-lg font-semibold tracking-tight">
                        {e.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[type?.name, context].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    {dept?.name && (
                      <Badge variant="secondary" className="shrink-0 rounded-full">
                        {dept.name}
                      </Badge>
                    )}
                  </div>
                  {mine && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="rounded-full">
                        Você: {mine.role_name}
                      </Badge>
                      <Badge
                        className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[mine.status]}`}
                      >
                        {ASSIGNMENT_STATUS_LABELS[mine.status]}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FutureEventLink>
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
