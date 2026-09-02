import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Megaphone } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { loadOperationalSummary } from "@/lib/operational-summary-server";
import { ASSIGNMENT_STATUS_BADGE, ASSIGNMENT_STATUS_LABELS, formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { resolveServiceWindow, timeLabel } from "@/lib/service-window";
import { Badge } from "@/components/ui/badge";
import { QuickConfirm } from "@/components/escalas/quick-confirm";
import { OperationalSummarySection } from "@/components/home/operational-summary";

type RelatedName = { name: string } | { name: string }[] | null;
type AssignmentEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  service_period: string | null;
  campuses: RelatedName;
};
type HomeAssignment = {
  id: string;
  ministry_id: string;
  role_name: string;
  status: string;
  arrival_time: string | null;
  release_time: string | null;
  items_to_bring: string | null;
  events: AssignmentEvent | AssignmentEvent[];
  ministries: RelatedName;
  departments: RelatedName;
};
type ServiceWindowRow = {
  event_id: string;
  ministry_id: string;
  arrival_at: string | null;
  release_at: string | null;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function uniqueNames(values: (string | null | undefined)[]) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function joinPtBr(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} e ${values.at(-1)}`;
}

function assignmentServiceLabel(assignment: HomeAssignment) {
  const department = firstRelated(assignment.departments)?.name?.trim();
  const role = assignment.role_name?.trim();
  if (department && role && department.toLocaleLowerCase("pt-BR") !== role.toLocaleLowerCase("pt-BR")) {
    return `${department} · ${role}`;
  }
  return role || department || "Equipe";
}

function homeEventContext(event: AssignmentEvent | null) {
  if (!event) return null;
  return eventContextLabel({
    campusName: firstRelated(event.campuses)?.name,
    servicePeriod: event.service_period,
    fallbackLocation: event.location,
  }) || null;
}

function pairKey(eventId: string, ministryId: string) {
  return `${eventId}:${ministryId}`;
}

export default async function HomePage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { active: activeMinistry } = await getActiveMinistry(churchSlug);
  const operationalSummaryPromise = activeMinistry?.canManage
    ? loadOperationalSummary({
        churchId: tenant.church.id,
        ministryId: activeMinistry.id,
        ministryName: activeMinistry.name,
      })
    : Promise.resolve(null);

  const nowIso = new Date().toISOString();
  const [
    { data: myEscalas },
    { data: nextChurchEvent },
    { data: serviceWindows },
    operationalSummary,
  ] = await Promise.all([
    supabase
      .from("assignments")
      .select("id, ministry_id, role_name, status, arrival_time, release_time, items_to_bring, ministries(name), departments(name), events!inner(id, title, starts_at, ends_at, location, service_period, campuses(name))")
      .eq("church_id", tenant.church.id)
      .eq("user_id", tenant.userId)
      .neq("status", "substituido")
      .gte("events.starts_at", nowIso)
      .order("starts_at", { ascending: true, referencedTable: "events" })
      .limit(8),
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location, service_period, campuses(name)")
      .eq("church_id", tenant.church.id)
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("event_ministry_windows")
      .select("event_id, ministry_id, arrival_at, release_at, events!inner(starts_at)")
      .eq("church_id", tenant.church.id)
      .gte("events.starts_at", nowIso),
    operationalSummaryPromise,
  ]);
  const { data: anuncios } = await supabase.rpc("anuncios_infantil", { p_church: tenant.church.id });
  const escalas = (myEscalas ?? []) as unknown as HomeAssignment[];
  const windowByPair = new Map<string, ServiceWindowRow>();
  for (const window of (serviceWindows ?? []) as unknown as ServiceWindowRow[]) {
    windowByPair.set(pairKey(window.event_id, window.ministry_id), window);
  }

  function serviceWindowFor(assignment: HomeAssignment) {
    const event = firstRelated(assignment.events);
    if (!event) return null;
    const teamWindow = windowByPair.get(pairKey(event.id, assignment.ministry_id));
    return resolveServiceWindow({
      eventStart: event.starts_at,
      eventEnd: event.ends_at,
      teamArrival: teamWindow?.arrival_at,
      teamRelease: teamWindow?.release_at,
      assignmentArrival: assignment.arrival_time,
      assignmentRelease: assignment.release_time,
    });
  }

  const nextAssignedEvent = firstRelated(escalas[0]?.events);
  const nextEvent =
    (nextChurchEvent as unknown as AssignmentEvent | null) ?? nextAssignedEvent;
  const nextEventAssignments = nextEvent
    ? escalas.filter((assignment) => firstRelated(assignment.events)?.id === nextEvent.id)
    : [];
  const heroAssignment = nextEventAssignments[0];
  const heroServiceWindow = heroAssignment ? serviceWindowFor(heroAssignment) : null;
  const nextMinistries = uniqueNames(nextEventAssignments.map((assignment) => firstRelated(assignment.ministries)?.name));
  const serviceSummary = joinPtBr(uniqueNames(nextEventAssignments.map(assignmentServiceLabel)));
  const nextContext = homeEventContext(nextEvent);
  const nextDate = nextEvent ? new Date(nextEvent.starts_at) : null;
  const day = nextDate ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(nextDate) : "—";
  const month = nextDate ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(nextDate).replace(".", "") : "sem data";
  const weekday = nextDate ? new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(nextDate) : "Próximo encontro";
  const arrival = timeLabel(heroServiceWindow?.arrivalAt);
  const release = timeLabel(heroServiceWindow?.releaseAt);
  const agendaAssignments = heroAssignment && nextEvent
    ? escalas.filter((assignment) => firstRelated(assignment.events)?.id !== nextEvent.id)
    : escalas;

  return (
    <div className="lunor-home min-w-0 space-y-12 overflow-x-clip pb-8">
      {(anuncios ?? []).length > 0 && (
        <section className="border-l-4 border-[#6e5ce6] bg-black px-5 py-4 text-white">
          {(anuncios as { code: string | null; kind: string }[]).map((a, i) => (
            <div key={`${a.code ?? "fim"}-${i}`} className="flex items-center gap-3">
              <Megaphone className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {a.kind === "fim_sessao" ? "O Kids terminou — responsáveis podem buscar as crianças." : <>Kids chama o código <span className="font-mono font-bold">{a.code}</span> — comparecer à recepção.</>}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="lunor-prism relative overflow-hidden rounded-[24px] border border-foreground/10 shadow-sm">
        <div className="relative z-10 px-6 pt-8 md:px-10 md:pt-10 lg:px-12 lg:pt-12">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{heroAssignment ? "Meu próximo serviço" : "Próximo culto"}</p>
            {heroAssignment && (
              <Badge className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[heroAssignment.status] ?? ""}`}>
                {ASSIGNMENT_STATUS_LABELS[heroAssignment.status] ?? heroAssignment.status}
              </Badge>
            )}
          </div>

          <div className="mt-7 max-w-4xl">
            <h1 className="font-editorial text-[clamp(3.25rem,6vw,5.9rem)] font-medium leading-[0.9] tracking-[-0.05em]">
              {nextEvent?.title ?? "Prepare com propósito."}
            </h1>

            <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-editorial text-5xl leading-none tracking-[-0.05em]">{day}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{month} · {weekday}</span>
              <span className="text-sm font-medium">{nextEvent ? `Culto ${formatEventTime(nextEvent.starts_at)}` : "Tudo começa aqui"}</span>
            </div>
          </div>

          {heroAssignment?.status === "convidado" && nextEvent && (
            <div className="mt-6 max-w-sm">
              <QuickConfirm churchSlug={churchSlug} churchId={tenant.church.id} eventId={nextEvent.id} assignmentId={heroAssignment.id} />
            </div>
          )}

          {!heroAssignment && !nextEvent && (
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">Prepare o coração. Prepare o time. Prepare o ambiente.</p>
          )}
        </div>

        <div className="relative z-10 mt-10 border-t border-foreground/10 bg-background/20 px-6 py-5 backdrop-blur-sm md:px-10 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-12">
          {heroAssignment ? (
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="font-medium">{serviceSummary}</span>
              {nextMinistries.length > 0 && <span><span className="text-muted-foreground">Equipe</span> <strong>{joinPtBr(nextMinistries)}</strong></span>}
              {arrival && <span><span className="text-muted-foreground">Chegada</span> <strong>{arrival}</strong></span>}
              {release && <span><span className="text-muted-foreground">Saída</span> <strong>{release}</strong></span>}
              {nextContext && <span><span className="text-muted-foreground">Local</span> <strong>{nextContext}</strong></span>}
              {heroAssignment.items_to_bring && <span><span className="text-muted-foreground">Levar</span> <strong>{heroAssignment.items_to_bring}</strong></span>}
            </div>
          ) : nextEvent ? (
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2 text-sm">
              <span className="font-medium">Próximo culto cadastrado</span>
              {nextContext && <span><span className="text-muted-foreground">Local</span> <strong>{nextContext}</strong></span>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seu próximo compromisso vai aparecer aqui.</p>
          )}

          <Link href={nextEvent ? `/${churchSlug}/escalas/${nextEvent.id}` : `/${churchSlug}/escalas`} className="mt-4 flex min-h-12 w-full items-center justify-between rounded-md bg-[#6e5ce6] px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:mt-0 lg:w-[240px] lg:shrink-0">
            {nextEvent ? (heroAssignment ? "Abrir meu preparo" : "Ver culto") : "Ver escalas"}
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      {operationalSummary && (
        <OperationalSummarySection churchSlug={churchSlug} summary={operationalSummary} />
      )}

      <section className="max-w-4xl">
        <div>
          <div className="flex items-end justify-between border-b border-foreground/25 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sua agenda</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">Onde você vai servir</h2>
            </div>
            <span className="text-xs text-muted-foreground">{agendaAssignments.length} próximas</span>
          </div>
          <div className="divide-y divide-foreground/15">
            {agendaAssignments.map((a, index) => {
              const ev = firstRelated(a.events);
              if (!ev) return null;
              const pendente = a.status === "convidado";
              const context = homeEventContext(ev);
              const window = serviceWindowFor(a);
              const effectiveArrival = timeLabel(window?.arrivalAt);
              const effectiveRelease = timeLabel(window?.releaseAt);
              return (
                <div key={a.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-5">
                  <span className="font-editorial text-3xl text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <Link href={`/${churchSlug}/escalas/${ev.id}`} className="min-w-0 hover:opacity-65">
                    <p className="truncate font-medium">{ev.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatEventDate(ev.starts_at)} · {effectiveArrival ? `chegada ${effectiveArrival}` : formatEventTime(ev.starts_at)} · culto {formatEventTime(ev.starts_at)}{effectiveRelease ? ` · saída ${effectiveRelease}` : ""}{context ? ` · ${context}` : ""} · {assignmentServiceLabel(a)}
                    </p>
                  </Link>
                  {pendente ? <QuickConfirm churchSlug={churchSlug} churchId={tenant.church.id} eventId={ev.id} assignmentId={a.id} /> : (
                    <Badge className={`shrink-0 rounded-none border-0 ${ASSIGNMENT_STATUS_BADGE[a.status] ?? ""}`}>{ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}</Badge>
                  )}
                </div>
              );
            })}
            {agendaAssignments.length === 0 && <p className="py-7 text-sm text-muted-foreground">{heroAssignment ? "Nenhuma outra escala agendada por enquanto." : "Nenhuma escala agendada por enquanto."}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
