import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, HeartHandshake, RotateCcw, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { loadDistributionOverview } from "@/lib/distribution-server";
import { relativeLastService, type DistributionPerson } from "@/lib/distribution";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DistribuicaoPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  if (!tenant.isLeader) redirect(`/${churchSlug}`);

  // Visão da igreja inteira — quem responde pela igreja toda enxerga todos os
  // setores aqui. O painel por setor (na Home) usa a mesma lib, escopado ao
  // time que a pessoa lidera.
  const overview = await loadDistributionOverview({ churchId: tenant.church.id });

  const { attention, reconnect, balancedCount: balanced, people } = overview;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cuidado com a equipe</p>
        <h1 className="page-title mt-2">Radar de carga</h1>
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
            {attention.map((person) => <PersonRow key={person.userId} person={person} churchSlug={churchSlug} />)}
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
            {reconnect.map((person) => <PersonRow key={person.userId} person={person} churchSlug={churchSlug} />)}
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
            .map((person) => <PersonRow key={person.userId} person={person} churchSlug={churchSlug} compact />)}
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

function PersonRow({ person, churchSlug, compact = false }: { person: DistributionPerson; churchSlug: string; compact?: boolean }) {
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
            {relativeLastService(person.daysSinceLast)}
            {person.nextEvent ? ` · Próxima: ${new Date(person.nextEvent.startsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}` : " · Sem próxima escala"}
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
