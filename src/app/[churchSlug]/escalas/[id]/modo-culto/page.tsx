import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ListMusic,
  MapPin,
  Users,
} from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { scheduleServiceOrder } from "@/lib/service-order";
import { CultModeTeam, type CultModeAssignment } from "@/components/escalas/cult-mode-team";
import { CultReadiness, type CultReadinessRow } from "@/components/escalas/cult-readiness";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceItem = {
  id: string;
  type: "WORSHIP" | "SPEAKING" | "MEDIA" | "OTHER";
  title: string;
  notes: string | null;
  duration_minutes: number;
  position: number;
  scheduled_offset_minutes: number | null;
  ministry_id: string | null;
  responsible_assignment_id: string | null;
  ministries: { name: string } | { name: string }[] | null;
};

type AssignmentRow = {
  id: string;
  ministry_id: string | null;
  role_name: string;
  status: string;
  checked_in_at: string | null;
  profiles: { full_name: string } | { full_name: string }[] | null;
  ministries: { name: string } | { name: string }[] | null;
};

type SetlistRow = {
  id: string;
  position: number;
  key_override: string | null;
  songs:
    | { title: string; artist: string | null; default_key: string | null }
    | { title: string; artist: string | null; default_key: string | null }[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

const TYPE_LABELS: Record<ServiceItem["type"], string> = {
  WORSHIP: "Louvor",
  SPEAKING: "Fala",
  MEDIA: "Mídia",
  OTHER: "Outro",
};

function ServiceItemPeople({
  teamName,
  responsible,
}: {
  teamName: string | null;
  responsible: AssignmentRow | null;
}) {
  const responsibleName = firstRelated(responsible?.profiles)?.full_name ?? null;

  if (!teamName && !responsibleName) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {teamName && (
        <span className="text-muted-foreground">
          Time <strong className="font-medium text-foreground">{teamName}</strong>
        </span>
      )}
      {responsibleName && responsible && (
        <span className="text-muted-foreground">
          {responsible.role_name}{" "}
          <strong className="font-medium text-foreground">{responsibleName}</strong>
        </span>
      )}
    </div>
  );
}

export default async function ModoCultoPage({
  params,
}: {
  params: Promise<{ churchSlug: string; id: string }>;
}) {
  const { churchSlug, id } = await params;
  const tenant = await getTenant(churchSlug);
  const supabase = await createClient();

  const [
    { data: event },
    { data: assignments },
    { data: serviceItems },
    { data: setlist },
    { data: readinessChecks },
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location")
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select(
        "id, ministry_id, role_name, status, checked_in_at, profiles!assignments_user_id_fkey(full_name), ministries(name)"
      )
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .neq("status", "substituido")
      .order("created_at"),
    supabase
      .from("service_items")
      .select(
        "id, type, title, notes, duration_minutes, position, scheduled_offset_minutes, ministry_id, responsible_assignment_id, ministries(name)"
      )
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("position"),
    supabase
      .from("setlist_items")
      .select("id, position, key_override, songs!inner(title, artist, default_key)")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("position"),
    supabase
      .from("event_cult_checks")
      .select("check_key, completed")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id),
  ]);

  if (!event) notFound();

  const assignmentRows = (assignments ?? []) as unknown as AssignmentRow[];
  const assignmentById = new Map(assignmentRows.map((row) => [row.id, row]));
  const team: CultModeAssignment[] = assignmentRows.map((row) => ({
    id: row.id,
    name: firstRelated(row.profiles)?.full_name ?? "Sem nome",
    role: row.role_name,
    ministry: firstRelated(row.ministries)?.name ?? "Equipe",
    status: row.status,
    checkedInAt: row.checked_in_at,
  }));

  const present = team.filter((row) => row.status === "presente").length;
  const pending = team.filter(
    (row) => !["presente", "ausente", "substituicao_solicitada"].includes(row.status)
  ).length;
  const scheduled = scheduleServiceOrder(
    (serviceItems ?? []) as unknown as ServiceItem[],
    event.starts_at
  );
  const songs = (setlist ?? []) as unknown as SetlistRow[];

  const now = new Date();
  const currentIndex = scheduled.findIndex(
    (item) =>
      item.duration_minutes > 0 &&
      now.getTime() >= item.scheduledDate.getTime() &&
      now.getTime() < item.endDate.getTime()
  );
  const current = currentIndex >= 0 ? scheduled[currentIndex] : null;
  const next = current
    ? scheduled[currentIndex + 1] ?? null
    : scheduled.find((item) => item.scheduledDate.getTime() > now.getTime()) ?? null;
  const serviceStarted = now.getTime() >= new Date(event.starts_at).getTime();
  const serviceFinished =
    scheduled.length > 0 &&
    !current &&
    !next &&
    now.getTime() >= scheduled[scheduled.length - 1].endDate.getTime();

  function contextFor(item: (typeof scheduled)[number]) {
    const responsible = item.responsible_assignment_id
      ? assignmentById.get(item.responsible_assignment_id) ?? null
      : null;
    const teamName =
      firstRelated(item.ministries)?.name ?? firstRelated(responsible?.ministries)?.name ?? null;
    return { responsible, teamName };
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link
            href={`/${churchSlug}/escalas/${id}`}
            className="flex size-10 shrink-0 items-center justify-center rounded-full border"
            aria-label="Voltar para o culto"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Modo Culto
            </p>
            <h1 className="truncate text-lg font-semibold">{event.title}</h1>
          </div>
          <Badge variant="secondary">
            {present}/{team.length} chegaram
          </Badge>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Agora e próximo">
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Agora
              </p>
              {current && (
                <time className="font-semibold tabular-nums">{current.scheduledAt}</time>
              )}
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            {current ? (
              (() => {
                const { teamName, responsible } = contextFor(current);
                return (
                  <>
                    <h2 className="text-2xl font-semibold tracking-tight">{current.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {current.duration_minutes} min · {TYPE_LABELS[current.type]}
                    </p>
                    <ServiceItemPeople teamName={teamName} responsible={responsible} />
                    {current.notes && (
                      <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
                        {current.notes}
                      </p>
                    )}
                  </>
                );
              })()
            ) : (
              <>
                <h2 className="text-xl font-semibold">
                  {serviceFinished
                    ? "Ordem concluída"
                    : serviceStarted
                      ? "Aguardando o próximo item"
                      : "Aguardando o início"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {serviceFinished
                    ? "Não há mais itens programados."
                    : "O próximo item aparece ao lado com o responsável e o time."}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Próximo
              </p>
              {next && <time className="font-semibold tabular-nums">{next.scheduledAt}</time>}
            </div>
          </CardHeader>
          <CardContent className="pb-6">
            {next ? (
              (() => {
                const { teamName, responsible } = contextFor(next);
                return (
                  <>
                    <h2 className="text-xl font-semibold tracking-tight">{next.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {next.duration_minutes} min · {TYPE_LABELS[next.type]}
                    </p>
                    <ServiceItemPeople teamName={teamName} responsible={responsible} />
                    {next.notes && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {next.notes}
                      </p>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum próximo item programado.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 py-5">
            <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="font-medium">{formatEventDate(event.starts_at)}</p>
              <p className="text-sm text-muted-foreground">
                {formatEventTime(event.starts_at)}
                {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 py-5">
            <MapPin className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Local</p>
              <p className="font-medium">{event.location || "Não informado"}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 py-5">
            <CheckCircle2 className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Equipe</p>
              <p className="font-medium">{present} chegaram</p>
              <p className="text-sm text-muted-foreground">{pending} ainda em aberto</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <CultReadiness
        churchSlug={churchSlug}
        churchId={tenant.church.id}
        eventId={id}
        rows={(readinessChecks ?? []) as CultReadinessRow[]}
        canManage={tenant.isLeader}
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5" />
          <h2 className="text-xl font-semibold">Ordem do culto</h2>
        </div>
        <Card>
          <CardContent className="py-3">
            {scheduled.length > 0 ? (
              <div className="divide-y">
                {scheduled.map((item) => {
                  const { teamName, responsible } = contextFor(item);
                  const active = current?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-[4rem_1fr_auto] gap-3 py-4 ${
                        active ? "rounded-xl bg-primary/5 px-3" : ""
                      }`}
                    >
                      <time className="font-semibold tabular-nums">{item.scheduledAt}</time>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.title}</p>
                          {active && <Badge>Agora</Badge>}
                        </div>
                        <ServiceItemPeople teamName={teamName} responsible={responsible} />
                        {item.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{TYPE_LABELS[item.type]}</Badge>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.duration_minutes} min
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">
                A ordem do culto ainda não foi definida.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5" />
          <h2 className="text-xl font-semibold">Equipe</h2>
        </div>
        <Card>
          <CardContent className="py-5">
            <CultModeTeam
              churchSlug={churchSlug}
              eventId={id}
              assignments={team}
              canManage={tenant.isLeader}
            />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ListMusic className="size-5" />
          <h2 className="text-xl font-semibold">Repertório</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Músicas do culto</CardTitle>
          </CardHeader>
          <CardContent>
            {songs.length > 0 ? (
              <div className="divide-y">
                {songs.map((row, index) => {
                  const song = firstRelated(row.songs);
                  if (!song) return null;
                  const key = row.key_override || song.default_key;
                  return (
                    <div key={row.id} className="flex items-center gap-4 py-4">
                      <span className="font-editorial text-2xl text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{song.title}</p>
                        {song.artist && (
                          <p className="truncate text-sm text-muted-foreground">
                            {song.artist}
                          </p>
                        )}
                      </div>
                      {key && <Badge variant="outline">Tom {key}</Badge>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma música adicionada ao repertório.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
