import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Megaphone } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { createClient } from "@/lib/supabase/server";
import { loadOperationalSummary } from "@/lib/operational-summary-server";
import type { OperationalSummary } from "@/lib/operational-summary";
import { loadOnboardingChecklist } from "@/lib/onboarding-checklist-server";
import { loadDistributionOverview } from "@/lib/distribution-server";
import type { DistributionOverview } from "@/lib/distribution";
import { ASSIGNMENT_STATUS_BADGE, ASSIGNMENT_STATUS_LABELS, formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { resolveServiceWindow, timeLabel } from "@/lib/service-window";
import { Badge } from "@/components/ui/badge";
import { QuickConfirm } from "@/components/escalas/quick-confirm";
import { OperationalSummarySection } from "@/components/home/operational-summary";
import { OnboardingChecklistCard } from "@/components/home/onboarding-checklist";
import { CultModeBanner } from "@/components/home/cult-mode-banner";
import { AssistantHomeInput } from "@/components/home/assistant-home-input";
import { DistributionPanel } from "@/components/home/distribution-panel";
import { NextServiceCard } from "@/components/home/next-service-card";
import { SectionHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

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

function assignmentStartMs(assignment: HomeAssignment) {
  const event = firstRelated(assignment.events);
  if (!event) return Number.POSITIVE_INFINITY;
  const value = new Date(event.starts_at).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

async function DeferredOperationalSummary({ churchSlug, summaryPromise }: { churchSlug: string; summaryPromise: Promise<OperationalSummary | null> }) {
  const summary = await summaryPromise;
  if (!summary) return null;
  return <OperationalSummarySection churchSlug={churchSlug} summary={summary} />;
}

function OperationalSummaryFallback() {
  return (
    <section className="space-y-4" aria-label="Carregando resumo operacional">
      <div className="border-b border-foreground/20 pb-3"><div className="h-3 w-44 rounded bg-muted" /><div className="mt-3 h-7 w-72 max-w-full rounded bg-muted" /></div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-[84px] rounded-2xl border bg-card/40" />)}</div>
    </section>
  );
}

async function DeferredDistributionPanel({ churchSlug, ministryName, overviewPromise }: { churchSlug: string; ministryName: string; overviewPromise: Promise<DistributionOverview | null> }) {
  const overview = await overviewPromise;
  if (!overview) return null;
  return <DistributionPanel churchSlug={churchSlug} ministryName={ministryName} overview={overview} />;
}

function DistributionPanelFallback() {
  return (
    <section className="rounded-3xl border bg-card" aria-label="Carregando distribuição do time">
      <div className="border-b px-5 py-4"><div className="h-5 w-48 rounded bg-muted" /><div className="mt-2 h-3 w-32 rounded bg-muted" /></div>
      <div className="grid grid-cols-2 divide-x divide-y border-b md:grid-cols-4 md:divide-y-0">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="px-5 py-4"><div className="h-8 w-12 rounded bg-muted" /><div className="mt-2 h-3 w-24 rounded bg-muted" /></div>)}</div>
      <div className="h-40" />
    </section>
  );
}

export default async function HomePage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (tenant.guardianOnly) redirect(`/${churchSlug}/infantil`);

  const supabase = await createClient();
  const { active: activeMinistry } = await getActiveMinistry(churchSlug);
  const operationalSummaryPromise: Promise<OperationalSummary | null> = activeMinistry?.canManage ? loadOperationalSummary({ churchId: tenant.church.id, ministryId: activeMinistry.id, ministryName: activeMinistry.name }) : Promise.resolve(null);
  const distributionPromise: Promise<DistributionOverview | null> = activeMinistry?.canManage ? loadDistributionOverview({ churchId: tenant.church.id, ministryId: activeMinistry.id }) : Promise.resolve(null);

  let onboardingChecklist: Awaited<ReturnType<typeof loadOnboardingChecklist>> | null = null;
  if (tenant.isCoord) {
    const { data: churchSettings } = await supabase.from("churches").select("settings").eq("id", tenant.church.id).single();
    const settings = churchSettings?.settings && typeof churchSettings.settings === "object" && !Array.isArray(churchSettings.settings) ? churchSettings.settings as Record<string, unknown> : {};
    if (settings.onboarding_checklist_dismissed !== true) {
      const initialModules = Array.isArray(settings.initial_modules) ? settings.initial_modules.filter((item): item is string => typeof item === "string") : [];
      const checklist = await loadOnboardingChecklist({ churchId: tenant.church.id, churchSlug, initialModules });
      if (!checklist.allDone) onboardingChecklist = checklist;
    }
  }

  const nowIso = new Date().toISOString();
  // eslint-disable-next-line react-hooks/purity -- server component, Date.now() é seguro aqui
  const nowMs = Date.now();
  const [{ data: myEscalas }, { data: nextChurchEvent }, { data: serviceWindows }, { data: anuncios }] = await Promise.all([
    supabase.from("assignments").select("id, ministry_id, role_name, status, arrival_time, release_time, items_to_bring, ministries(name), departments(name), events!inner(id, title, starts_at, ends_at, location, service_period, campuses(name))").eq("church_id", tenant.church.id).eq("user_id", tenant.userId).neq("status", "substituido").gte("events.starts_at", nowIso).limit(20),
    supabase.from("events").select("id, title, starts_at, ends_at, location, service_period, campuses(name)").eq("church_id", tenant.church.id).gte("starts_at", nowIso).order("starts_at").limit(1).maybeSingle(),
    supabase.from("event_ministry_windows").select("event_id, ministry_id, arrival_at, release_at, events!inner(starts_at)").eq("church_id", tenant.church.id).gte("events.starts_at", nowIso),
    supabase.rpc("anuncios_infantil", { p_church: tenant.church.id }),
  ]);
  // PostgREST não garante a ordem da tabela raiz quando o ORDER BY aponta para uma relação embutida.
  // Ordenamos explicitamente pelo início do evento para que a Home funcione igual para qualquer usuário/ministério.
  const escalas = ((myEscalas ?? []) as unknown as HomeAssignment[]).sort((a, b) => assignmentStartMs(a) - assignmentStartMs(b));
  const windowByPair = new Map<string, ServiceWindowRow>();
  for (const window of (serviceWindows ?? []) as unknown as ServiceWindowRow[]) windowByPair.set(pairKey(window.event_id, window.ministry_id), window);

  function serviceWindowFor(assignment: HomeAssignment) {
    const event = firstRelated(assignment.events);
    if (!event) return null;
    const teamWindow = windowByPair.get(pairKey(event.id, assignment.ministry_id));
    return resolveServiceWindow({ eventStart: event.starts_at, eventEnd: event.ends_at, teamArrival: teamWindow?.arrival_at, teamRelease: teamWindow?.release_at, assignmentArrival: assignment.arrival_time, assignmentRelease: assignment.release_time });
  }

  const nextConfirmedAssignment = escalas.find((assignment) => assignment.status === "confirmado");
  const nextAssignedEvent = firstRelated(nextConfirmedAssignment?.events);
  const nextEvent = nextAssignedEvent ?? (nextChurchEvent as unknown as AssignmentEvent | null);
  const nextEventAssignments = nextEvent ? escalas.filter((assignment) => firstRelated(assignment.events)?.id === nextEvent.id) : [];
  const confirmedEventAssignments = nextEventAssignments.filter((assignment) => assignment.status === "confirmado");
  const heroAssignment = confirmedEventAssignments[0];
  const heroServiceWindow = heroAssignment ? serviceWindowFor(heroAssignment) : null;
  const nextMinistries = uniqueNames(confirmedEventAssignments.map((assignment) => firstRelated(assignment.ministries)?.name));
  const serviceSummary = joinPtBr(uniqueNames(confirmedEventAssignments.map(assignmentServiceLabel)));
  const nextContext = homeEventContext(nextEvent);
  const nextDate = nextEvent ? new Date(nextEvent.starts_at) : null;
  const day = nextDate ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(nextDate) : "—";
  const month = nextDate ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(nextDate).replace(".", "") : "sem data";
  const weekday = nextDate ? new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(nextDate) : "Próximo encontro";
  const arrival = timeLabel(heroServiceWindow?.arrivalAt);
  const release = timeLabel(heroServiceWindow?.releaseAt);
  const confirmedHeroIds = new Set(confirmedEventAssignments.map((assignment) => assignment.id));
  const agendaAssignments = heroAssignment ? escalas.filter((assignment) => !confirmedHeroIds.has(assignment.id)) : escalas;

  const CULT_MODE_WINDOW_MS = 3 * 60 * 60 * 1000;
  const imminentEvent = (() => {
    const candidate = (nextChurchEvent as unknown as AssignmentEvent | null) ?? nextEvent;
    if (!candidate) return null;
    const startMs = new Date(candidate.starts_at).getTime();
    const endMs = candidate.ends_at ? new Date(candidate.ends_at).getTime() : startMs + 2 * 60 * 60 * 1000;
    const startsWithinWindow = startMs - nowMs <= CULT_MODE_WINDOW_MS && startMs - nowMs > 0;
    const alreadyStartedNotEnded = startMs <= nowMs && nowMs < endMs;
    return (startsWithinWindow || alreadyStartedNotEnded) ? candidate : null;
  })();

  return (
    <div className="lunor-home min-w-0 space-y-8 overflow-x-clip pb-8">
      {(anuncios ?? []).length > 0 && <section className="border-l-4 border-brand bg-black px-5 py-4 text-white">{(anuncios as { code: string | null; kind: string }[]).map((a, i) => <div key={`${a.code ?? "fim"}-${i}`} className="flex items-center gap-3"><Megaphone className="size-4 shrink-0" /><p className="text-sm font-medium">{a.kind === "fim_sessao" ? "O Kids terminou — responsáveis podem buscar as crianças." : <>Kids chama o código <span className="font-mono font-bold">{a.code}</span> — comparecer à recepção.</>}</p></div>)}</section>}

      {tenant.isLeader && imminentEvent && <CultModeBanner churchSlug={churchSlug} eventId={imminentEvent.id} eventTitle={imminentEvent.title} startsAt={imminentEvent.starts_at} nowMs={nowMs} />}

      <NextServiceCard
        eyebrow={heroAssignment ? "Meu próximo serviço" : "Próximo culto"}
        title={nextEvent?.title ?? "Prepare com propósito."}
        day={day}
        month={month}
        dateLabel={weekday}
        timeLabel={nextEvent ? `Culto ${formatEventTime(nextEvent.starts_at)}` : "Tudo começa aqui"}
        status={heroAssignment && <Badge className={`border-0 ${ASSIGNMENT_STATUS_BADGE[heroAssignment.status] ?? ""}`}>{ASSIGNMENT_STATUS_LABELS[heroAssignment.status] ?? heroAssignment.status}</Badge>}
        href={nextEvent ? `/${churchSlug}/escalas/${nextEvent.id}` : `/${churchSlug}/escalas`}
        actionLabel={nextEvent ? (heroAssignment ? "Abrir meu preparo" : "Ver culto") : "Ver escalas"}
      >
        {heroAssignment ? <div className="flex flex-wrap gap-x-5 gap-y-2"><span className="font-medium">{serviceSummary}</span>{nextMinistries.length > 0 && <span><span className="text-muted-foreground">Equipe</span> <strong>{joinPtBr(nextMinistries)}</strong></span>}{arrival && <span><span className="text-muted-foreground">Chegada</span> <strong>{arrival}</strong></span>}{release && <span><span className="text-muted-foreground">Saída</span> <strong>{release}</strong></span>}{nextContext && <span><span className="text-muted-foreground">Local</span> <strong>{nextContext}</strong></span>}{heroAssignment.items_to_bring && <span><span className="text-muted-foreground">Levar</span> <strong>{heroAssignment.items_to_bring}</strong></span>}</div> : nextEvent ? <div className="space-y-1"><p className="font-medium">{nextAssignedEvent ? "Você não está escalado(a) para este culto." : "Você ainda não foi escalado(a) para nenhum serviço."}</p><div className="flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">{nextAssignedEvent && <span>Próximo serviço: <strong className="text-foreground">{nextAssignedEvent.title} · {formatEventDate(nextAssignedEvent.starts_at)}</strong></span>}{nextContext && <span>Local <strong className="text-foreground">{nextContext}</strong></span>}</div></div> : <p className="text-muted-foreground">Seu próximo compromisso vai aparecer aqui.</p>}
        {heroAssignment?.status === "convidado" && nextEvent && <div className="mt-4"><QuickConfirm churchSlug={churchSlug} churchId={tenant.church.id} eventId={nextEvent.id} assignmentId={heroAssignment.id} /></div>}
      </NextServiceCard>

      <section className="space-y-4" aria-labelledby="home-agenda-title"><SectionHeader id="home-agenda-title" title="Sua agenda" description="Confira os próximos serviços e responda aos convites." actions={<Link href={`/${churchSlug}/escalas`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand">Ver todas as escalas<ArrowRight className="size-4" aria-hidden="true" /></Link>} /><div className="divide-y rounded-xl border bg-card px-4 sm:px-5">
        {agendaAssignments.map((a, index) => { const ev = firstRelated(a.events); if (!ev) return null; const pendente = a.status === "convidado"; const context = homeEventContext(ev); const window = serviceWindowFor(a); const effectiveArrival = timeLabel(window?.arrivalAt); const effectiveRelease = timeLabel(window?.releaseAt); return <div key={a.id} className="home-agenda-row grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"><span className="font-editorial text-3xl text-muted-foreground">{String(index + 1).padStart(2, "0")}</span><Link href={`/${churchSlug}/escalas/${ev.id}`} className="min-w-0 hover:text-brand"><p className="break-words font-medium">{ev.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatEventDate(ev.starts_at)} · {effectiveArrival ? `chegada ${effectiveArrival}` : formatEventTime(ev.starts_at)} · culto {formatEventTime(ev.starts_at)}{effectiveRelease ? ` · saída ${effectiveRelease}` : ""}{context ? ` · ${context}` : ""} · {assignmentServiceLabel(a)}</p></Link>{pendente ? <QuickConfirm churchSlug={churchSlug} churchId={tenant.church.id} eventId={ev.id} assignmentId={a.id} /> : <Badge className={`shrink-0 rounded-none border-0 ${ASSIGNMENT_STATUS_BADGE[a.status] ?? ""}`}>{ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}</Badge>}</div>; })}
        {agendaAssignments.length === 0 && <EmptyState className="my-4 border-0 py-6" title={heroAssignment ? "Sua agenda está em dia" : "Aguardando seu próximo convite"} description={heroAssignment ? "Nenhuma outra escala agendada por enquanto." : "Seus convites para servir aparecerão aqui. Você também pode consultar os cultos e escalas."} />}
      </div></section>

      {activeMinistry?.canManage && <AssistantHomeInput churchSlug={churchSlug} ministryId={activeMinistry.id} ministryName={activeMinistry.name} />}
      {onboardingChecklist && <OnboardingChecklistCard churchId={tenant.church.id} checklist={onboardingChecklist} />}
      {activeMinistry?.canManage && <Suspense fallback={<OperationalSummaryFallback />}><DeferredOperationalSummary churchSlug={churchSlug} summaryPromise={operationalSummaryPromise} /></Suspense>}
      {activeMinistry?.canManage && <Suspense fallback={<DistributionPanelFallback />}><DeferredDistributionPanel churchSlug={churchSlug} ministryName={activeMinistry.name} overviewPromise={distributionPromise} /></Suspense>}


    </div>
  );
}
