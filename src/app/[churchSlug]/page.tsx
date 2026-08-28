import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Baby, BarChart3, BookOpen, ChevronRight, Megaphone, Music, Settings, ShieldCheck, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getActiveMinistry } from "@/lib/ministry";
import { checkPlatformAdmin } from "@/lib/platform";
import { createClient } from "@/lib/supabase/server";
import { InviteLink } from "@/components/invite-link";
import { ASSIGNMENT_STATUS_BADGE, ASSIGNMENT_STATUS_LABELS, formatEventDate, formatEventTime } from "@/lib/escalas";
import { Badge } from "@/components/ui/badge";
import { QuickConfirm } from "@/components/escalas/quick-confirm";

type AssignmentEvent = { id: string; title: string; starts_at: string; location: string | null };
type HomeAssignment = {
  id: string;
  role_name: string;
  status: string;
  arrival_time: string | null;
  items_to_bring: string | null;
  events: AssignmentEvent | AssignmentEvent[];
  ministries: { name: string } | { name: string }[] | null;
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function HomePage({ params }: { params: Promise<{ churchSlug: string }> }) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const isPlatformAdmin = await checkPlatformAdmin();
  const { options: meusSetores } = await getActiveMinistry(churchSlug);
  const temInfantil = meusSetores.some((m) => m.slug === "infantil" || /infantil/i.test(m.name));
  const temLouvor = meusSetores.some((m) => m.slug === "louvor" || /louvor/i.test(m.name));
  const supabase = await createClient();
  const { data: myEscalas } = await supabase
    .from("assignments")
    .select("id, role_name, status, arrival_time, items_to_bring, ministries(name), events!inner(id, title, starts_at, location)")
    .eq("church_id", tenant.church.id)
    .eq("user_id", tenant.userId)
    .neq("status", "substituido")
    .gte("events.starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true, referencedTable: "events" })
    .limit(3);
  const { data: anuncios } = await supabase.rpc("anuncios_infantil", { p_church: tenant.church.id });

  const escalas = (myEscalas ?? []) as unknown as HomeAssignment[];
  const nextAssignment = escalas[0];
  const nextEvent = firstRelated(nextAssignment?.events);
  const nextMinistry = firstRelated(nextAssignment?.ministries);
  const nextDate = nextEvent ? new Date(nextEvent.starts_at) : null;
  const day = nextDate ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(nextDate) : "—";
  const month = nextDate ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(nextDate).replace(".", "") : "sem data";
  const weekday = nextDate ? new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(nextDate) : "Próximo encontro";
  const arrival = nextAssignment?.arrival_time
    ? new Date(nextAssignment.arrival_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;
  const isAdmin = tenant.role === "admin";
  const canAdmin = tenant.isCoord;
  const showManage = canAdmin || tenant.isLeader || temInfantil;

  return (
    <div className="lunor-home min-w-0 space-y-12 overflow-x-clip pb-8">
      {(anuncios ?? []).length > 0 && (
        <section className="border-l-4 border-[#6e5ce6] bg-black px-5 py-4 text-white">
          {(anuncios as { code: string | null; kind: string }[]).map((a, i) => (
            <div key={`${a.code ?? "fim"}-${i}`} className="flex items-center gap-3">
              <Megaphone className="size-4 shrink-0" />
              <p className="text-sm font-medium">
                {a.kind === "fim_sessao" ? "A escolinha terminou — responsáveis podem buscar as crianças no Infantil." : <>Infantil chama o código <span className="font-mono font-bold">{a.code}</span> — comparecer à sala.</>}
              </p>
            </div>
          ))}
        </section>
      )}

      <section className="lunor-prism relative overflow-hidden rounded-[24px] border border-foreground/10 shadow-sm">
        <div className="relative z-10 px-6 pt-8 md:px-10 md:pt-10 lg:px-12 lg:pt-12">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{nextAssignment ? "Meu domingo" : "Próximo culto"}</p>
            {nextAssignment && (
              <Badge className={`rounded-full border-0 ${ASSIGNMENT_STATUS_BADGE[nextAssignment.status] ?? ""}`}>
                {ASSIGNMENT_STATUS_LABELS[nextAssignment.status] ?? nextAssignment.status}
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
              <span className="text-sm font-medium">{nextEvent ? formatEventTime(nextEvent.starts_at) : "Tudo começa aqui"}</span>
            </div>
          </div>

          {nextAssignment?.status === "convidado" && nextEvent && (
            <div className="mt-6 max-w-sm">
              <QuickConfirm churchSlug={churchSlug} churchId={tenant.church.id} eventId={nextEvent.id} assignmentId={nextAssignment.id} />
            </div>
          )}

          {!nextAssignment && (
            <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground">Prepare o coração. Prepare o time. Prepare o ambiente.</p>
          )}
        </div>

        <div className="relative z-10 mt-10 border-t border-foreground/10 bg-background/20 px-6 py-5 backdrop-blur-sm md:px-10 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:px-12">
          {nextAssignment ? (
            <div className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-2 text-sm">
              <span><span className="text-muted-foreground">Você serve em</span> <strong>{nextAssignment.role_name}</strong></span>
              {nextMinistry?.name && <span><span className="text-muted-foreground">Equipe</span> <strong>{nextMinistry.name}</strong></span>}
              {arrival && <span><span className="text-muted-foreground">Chegada</span> <strong>{arrival}</strong></span>}
              {nextEvent?.location && <span><span className="text-muted-foreground">Local</span> <strong>{nextEvent.location}</strong></span>}
              {nextAssignment.items_to_bring && <span><span className="text-muted-foreground">Levar</span> <strong>{nextAssignment.items_to_bring}</strong></span>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Seu próximo compromisso vai aparecer aqui.</p>
          )}

          <Link href={nextEvent ? `/${churchSlug}/escalas/${nextEvent.id}` : `/${churchSlug}/escalas`} className="mt-4 flex min-h-12 w-full items-center justify-between rounded-md bg-[#6e5ce6] px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:mt-0 lg:w-[240px] lg:shrink-0">
            {nextEvent ? "Abrir meu preparo" : "Ver escalas"}
            <ArrowRight className="size-5" />
          </Link>
        </div>
      </section>

      <section className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex items-end justify-between border-b border-foreground/25 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Sua agenda</p>
              <h2 className="mt-2 text-2xl font-medium tracking-tight">Onde você vai servir</h2>
            </div>
            <span className="text-xs text-muted-foreground">{escalas.length} próximas</span>
          </div>
          <div className="divide-y divide-foreground/15">
            {escalas.map((a, index) => {
              const ev = firstRelated(a.events);
              if (!ev) return null;
              const pendente = a.status === "convidado";
              return (
                <div key={a.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-5">
                  <span className="font-editorial text-3xl text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                  <Link href={`/${churchSlug}/escalas/${ev.id}`} className="min-w-0 hover:opacity-65">
                    <p className="truncate font-medium">{ev.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatEventDate(ev.starts_at)} · {formatEventTime(ev.starts_at)} · {a.role_name}{a.arrival_time ? ` · chegada ${new Date(a.arrival_time).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>
                  </Link>
                  {pendente ? <QuickConfirm churchSlug={churchSlug} churchId={tenant.church.id} eventId={ev.id} assignmentId={a.id} /> : (
                    <Badge className={`shrink-0 rounded-none border-0 ${ASSIGNMENT_STATUS_BADGE[a.status] ?? ""}`}>{ASSIGNMENT_STATUS_LABELS[a.status] ?? a.status}</Badge>
                  )}
                </div>
              );
            })}
            {escalas.length === 0 && <p className="py-7 text-sm text-muted-foreground">Nenhuma escala agendada por enquanto.</p>}
          </div>
        </div>

        <div>
          <div className="border-b border-foreground/25 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Atalhos</p>
            <h2 className="mt-2 text-2xl font-medium tracking-tight">Continue o preparo</h2>
          </div>
          <div className="divide-y divide-foreground/15">
            {temLouvor && <ActionRow href={`/${churchSlug}/louvor`} label="Repertório" description="Músicas, cifras e arranjos" icon={<Music className="size-4" />} />}
            {tenant.isLeader && <ActionRow href={`/${churchSlug}/pessoas`} label="Equipe" description="Pessoas, aptidões e ministérios" icon={<Users className="size-4" />} />}
            {tenant.isLeader && <ActionRow href={`/${churchSlug}/distribuicao`} label="Radar de carga" description="Cuide da frequência e do revezamento" icon={<BarChart3 className="size-4" />} />}
            {temInfantil && <ActionRow href={`/${churchSlug}/infantil`} label="Infantil" description="Check-in e retirada segura" icon={<Baby className="size-4" />} />}
          </div>
        </div>
      </section>

      {showManage && (
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Organização</p>
          <div className="mt-4 grid border-y border-foreground/20 sm:grid-cols-2 lg:grid-cols-3">
            {isAdmin && <NavRow href={`/${churchSlug}/guia`} icon={<BookOpen className="size-4" />} title="Guia de uso" description="Comece por aqui" />}
            {canAdmin && <NavRow href={`/${churchSlug}/admin`} icon={<Settings className="size-4" />} title="Administração" description="Ministérios e configurações" />}
            {isPlatformAdmin && <NavRow href="/painel" icon={<ShieldCheck className="size-4" />} title="Plataforma" description="Igrejas, equipes e logs" />}
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="flex min-w-0 flex-col justify-between gap-5 overflow-hidden border border-zinc-200 border-l-4 border-l-[#6e5ce6] bg-white px-6 py-6 text-zinc-950 dark:border-white/15 dark:border-l-[#6e5ce6] dark:bg-[#151518] dark:text-white sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">Convide sua equipe</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Envie um link. A pessoa cria a conta e entra na igreja automaticamente.</p>
          </div>
          <InviteLink inviteCode={tenant.church.invite_code} />
        </section>
      )}
    </div>
  );
}

function ActionRow({ href, label, description, icon }: { href: string; label: string; description: string; icon: ReactNode }) {
  return <Link href={href} className="group flex items-center gap-4 py-5 hover:opacity-65"><span className="flex size-9 items-center justify-center border border-foreground/25">{icon}</span><span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{description}</span></span><ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>;
}

function NavRow({ href, icon, title, description }: { href: string; icon: ReactNode; title: string; description: string }) {
  return <Link href={href} className="group flex items-center gap-4 border-foreground/15 px-1 py-5 sm:border-r sm:px-5"><span>{icon}</span><span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="block text-xs text-muted-foreground">{description}</span></span><ChevronRight className="size-4 transition-transform group-hover:translate-x-1" /></Link>;
}
