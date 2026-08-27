import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, HeartHandshake, RotateCcw, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 60;
const UPCOMING_DAYS = 45;

type EventRef = { id: string; title: string; starts_at: string };
type AssignmentRef = {
  user_id: string;
  status: string;
  events: EventRef | EventRef[];
};

type RadarPerson = {
  userId: string;
  name: string;
  last30: number;
  last60: number;
  upcoming: number;
  consecutiveWeeks: number;
  lastServedAt: string | null;
  nextEvent: EventRef | null;
  signal: "attention" | "balanced" | "reconnect";
};

function eventOf(value: EventRef | EventRef[]): EventRef | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  const day = value.getDay();
  const distance = day === 0 ? 6 : day - 1;
  value.setDate(value.getDate() - distance);
  value.setHours(0, 0, 0, 0);
  return value;
}

function weekKey(date: Date) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function countConsecutiveWeeks(dates: string[], now: Date) {
  if (dates.length === 0) return 0;
  const servedWeeks = new Set(dates.map((iso) => weekKey(new Date(iso))));
  let cursor = startOfWeek(now);
  let count = 0;

  // Se ainda não serviu na semana atual, a sequência pode continuar a partir da anterior.
  if (!servedWeeks.has(weekKey(cursor))) {
    cursor = new Date(cursor.getTime() - 7 * DAY_MS);
  }

  while (servedWeeks.has(weekKey(cursor))) {
    count += 1;
    cursor = new Date(cursor.getTime() - 7 * DAY_MS);
  }
  return count;
}

function relativeLastService(iso: string | null, now: Date) {
  if (!iso) return "Sem serviço recente";
  const days = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / DAY_MS));
  if (days === 0) return "Serviu hoje";
  if (days === 1) return "Serviu ontem";
  if (days < 7) return `Serviu há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Serviu há 1 semana";
  return `Serviu há ${weeks} semanas`;
}

export default async function DistribuicaoPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const cid = tenant.church.id;
  const now = new Date();
  const historyFrom = new Date(now.getTime() - HISTORY_DAYS * DAY_MS).toISOString();
  const last30From = new Date(now.getTime() - 30 * DAY_MS).getTime();
  const upcomingTo = new Date(now.getTime() + UPCOMING_DAYS * DAY_MS).toISOString();

  const [{ data: roster }, { data: assignments }] = await Promise.all([
    supabase
      .from("church_members")
      .select("user_id, profiles!inner(full_name)")
      .eq("church_id", cid)
      .eq("status", "active"),
    supabase
      .from("assignments")
      .select("user_id, status, events!inner(id, title, starts_at)")
      .eq("church_id", cid)
      .gte("events.starts_at", historyFrom)
      .lte("events.starts_at", upcomingTo),
  ]);

  const byUser = new Map<string, AssignmentRef[]>();
  for (const assignment of (assignments ?? []) as unknown as AssignmentRef[]) {
    byUser.set(assignment.user_id, [...(byUser.get(assignment.user_id) ?? []), assignment]);
  }

  const people: RadarPerson[] = (roster ?? []).map((member) => {
    const personAssignments = byUser.get(member.user_id) ?? [];
    const past = personAssignments
      .map((assignment) => ({ assignment, event: eventOf(assignment.events) }))
      .filter(({ assignment, event }) =>
        !!event &&
        new Date(event.starts_at) <= now &&
        !["ausente", "substituicao_solicitada", "substituido"].includes(assignment.status)
      ) as { assignment: AssignmentRef; event: EventRef }[];

    const future = personAssignments
      .map((assignment) => ({ assignment, event: eventOf(assignment.events) }))
      .filter(({ assignment, event }) =>
        !!event &&
        new Date(event.starts_at) > now &&
        !["ausente", "substituicao_solicitada", "substituido"].includes(assignment.status)
      )
      .sort((a, b) => new Date(a.event!.starts_at).getTime() - new Date(b.event!.starts_at).getTime()) as { assignment: AssignmentRef; event: EventRef }[];

    const pastDates = past.map(({ event }) => event.starts_at);
    const last30 = past.filter(({ event }) => new Date(event.starts_at).getTime() >= last30From).length;
    const last60 = past.length;
    const consecutiveWeeks = countConsecutiveWeeks(pastDates, now);
    const lastServedAt = pastDates.sort((a, b) => b.localeCompare(a))[0] ?? null;
    const daysSinceLast = lastServedAt
      ? Math.floor((now.getTime() - new Date(lastServedAt).getTime()) / DAY_MS)
      : Number.POSITIVE_INFINITY;

    let signal: RadarPerson["signal"] = "balanced";
    if (last30 >= 4 || consecutiveWeeks >= 4) signal = "attention";
    else if (daysSinceLast >= 42 && future.length === 0) signal = "reconnect";

    return {
      userId: member.user_id,
      name: (member.profiles as unknown as { full_name: string }).full_name?.trim() || "Sem nome",
      last30,
      last60,
      upcoming: future.length,
      consecutiveWeeks,
      lastServedAt,
      nextEvent: future[0]?.event ?? null,
      signal,
    };
  });

  const attention = people
    .filter((person) => person.signal === "attention")
    .sort((a, b) => b.last30 - a.last30 || b.consecutiveWeeks - a.consecutiveWeeks);
  const reconnect = people
    .filter((person) => person.signal === "reconnect")
    .sort((a, b) => (a.lastServedAt ?? "").localeCompare(b.lastServedAt ?? ""));
  const balanced = people.filter((person) => person.signal === "balanced").length;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cuidado com a equipe</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Radar de carga</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Sinais para ajudar a revezar melhor, perceber quem está servindo demais e lembrar de quem pode estar ficando de fora. O radar não avalia pessoas — ele apoia conversas de cuidado.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<AlertTriangle className="size-5" />} value={attention.length} label="pedem atenção" description="Carga alta nas últimas semanas" />
        <SummaryCard icon={<HeartHandshake className="size-5" />} value={balanced} label="em ritmo equilibrado" description="Sem sinais relevantes agora" />
        <SummaryCard icon={<RotateCcw className="size-5" />} value={reconnect.length} label="para reconectar" description="Sem servir há 6+ semanas" />
      </section>

      {attention.length > 0 && (
        <Card className="rounded-3xl border-amber-500/25">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base">Pode estar servindo demais</CardTitle>
            </div>
            <CardDescription>Considere revezar ou conversar antes de montar as próximas escalas.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {attention.map((person) => <PersonRow key={person.userId} person={person} churchSlug={churchSlug} now={now} />)}
          </CardContent>
        </Card>
      )}

      {reconnect.length > 0 && (
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-5" />
              <CardTitle className="text-base">Talvez seja hora de reconectar</CardTitle>
            </div>
            <CardDescription>Pessoas ativas que não serviram nas últimas seis semanas e também não têm escala futura nesta janela.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {reconnect.map((person) => <PersonRow key={person.userId} person={person} churchSlug={churchSlug} now={now} />)}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Visão de toda a equipe</CardTitle>
          <CardDescription>Últimos 30/60 dias, sequência de semanas e próximas escalas.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {[...people]
            .sort((a, b) => b.last30 - a.last30 || a.name.localeCompare(b.name, "pt-BR"))
            .map((person) => <PersonRow key={person.userId} person={person} churchSlug={churchSlug} now={now} compact />)}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon, value, label, description }: { icon: React.ReactNode; value: number; label: string; description: string }) {
  return (
    <Card className="rounded-3xl">
      <CardContent className="flex items-start gap-4 py-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">{icon}</span>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function PersonRow({ person, churchSlug, now, compact = false }: { person: RadarPerson; churchSlug: string; now: Date; compact?: boolean }) {
  const initials = person.name.split(" ").filter(Boolean).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  const signalLabel = person.signal === "attention" ? "Atenção" : person.signal === "reconnect" ? "Reconectar" : "Equilibrado";
  const signalClass = person.signal === "attention"
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
    : person.signal === "reconnect"
      ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{person.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {relativeLastService(person.lastServedAt, now)}
            {person.nextEvent ? ` · Próxima: ${new Date(person.nextEvent.starts_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : " · Sem próxima escala"}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-12 sm:justify-end sm:pl-0">
        <span className="text-xs text-muted-foreground"><strong className="text-foreground">{person.last30}</strong> / 30d</span>
        {!compact && <span className="text-xs text-muted-foreground"><strong className="text-foreground">{person.last60}</strong> / 60d</span>}
        {person.consecutiveWeeks >= 2 && <span className="text-xs text-muted-foreground">{person.consecutiveWeeks} semanas seguidas</span>}
        <Badge className={`rounded-full border-0 ${signalClass}`}>{signalLabel}</Badge>
        <Link href={`/${churchSlug}/pessoas/${person.userId}`} className="flex size-9 items-center justify-center rounded-full hover:bg-muted" aria-label={`Abrir ${person.name}`}>
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}
