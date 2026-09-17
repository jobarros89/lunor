import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, ListMusic, MapPin, Users } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { CultModeTeam, type CultModeAssignment } from "@/components/escalas/cult-mode-team";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ServiceItem = {
  id: string;
  type: "WORSHIP" | "SPEAKING" | "MEDIA" | "OTHER";
  title: string;
  notes: string | null;
  duration_minutes: number;
  position: number;
};

type AssignmentRow = {
  id: string;
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
  songs: { title: string; artist: string | null; default_key: string | null } | { title: string; artist: string | null; default_key: string | null }[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function scheduleItems(items: ServiceItem[], startsAt: string) {
  let elapsed = 0;
  return items.map((item) => {
    const at = new Date(new Date(startsAt).getTime() + elapsed * 60_000);
    elapsed += item.duration_minutes;
    return {
      ...item,
      scheduledAt: at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  });
}

const TYPE_LABELS: Record<ServiceItem["type"], string> = {
  WORSHIP: "Louvor",
  SPEAKING: "Fala",
  MEDIA: "Mídia",
  OTHER: "Outro",
};

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
  ] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, ends_at, location")
      .eq("id", id)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("assignments")
      .select("id, role_name, status, checked_in_at, profiles!assignments_user_id_fkey(full_name), ministries(name)")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .neq("status", "substituido")
      .order("created_at"),
    supabase
      .from("service_items")
      .select("id, type, title, notes, duration_minutes, position")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("position"),
    supabase
      .from("setlist_items")
      .select("id, position, key_override, songs!inner(title, artist, default_key)")
      .eq("church_id", tenant.church.id)
      .eq("event_id", id)
      .order("position"),
  ]);

  if (!event) notFound();

  const team: CultModeAssignment[] = ((assignments ?? []) as unknown as AssignmentRow[]).map((row) => ({
    id: row.id,
    name: firstRelated(row.profiles)?.full_name ?? "Sem nome",
    role: row.role_name,
    ministry: firstRelated(row.ministries)?.name ?? "Equipe",
    status: row.status,
    checkedInAt: row.checked_in_at,
  }));

  const present = team.filter((row) => row.status === "presente").length;
  const pending = team.filter((row) => !["presente", "ausente", "substituicao_solicitada"].includes(row.status)).length;
  const scheduled = scheduleItems((serviceItems ?? []) as ServiceItem[], event.starts_at);
  const songs = (setlist ?? []) as unknown as SetlistRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href={`/${churchSlug}/escalas/${id}`} className="flex size-10 shrink-0 items-center justify-center rounded-full border" aria-label="Voltar para o culto">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modo Culto</p>
            <h1 className="truncate text-lg font-semibold">{event.title}</h1>
          </div>
          <Badge variant="secondary" >{present}/{team.length} chegaram</Badge>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-start gap-3 py-5">
            <Clock3 className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="font-medium">{formatEventDate(event.starts_at)}</p>
              <p className="text-sm text-muted-foreground">{formatEventTime(event.starts_at)}{event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}</p>
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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5" />
          <h2 className="text-xl font-semibold">Equipe</h2>
        </div>
        <Card>
          <CardContent className="py-5">
            <CultModeTeam churchSlug={churchSlug} eventId={id} assignments={team} canManage={tenant.isLeader} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock3 className="size-5" />
          <h2 className="text-xl font-semibold">Ordem do culto</h2>
        </div>
        <Card>
          <CardContent className="py-3">
            {scheduled.length > 0 ? (
              <div className="divide-y">
                {scheduled.map((item) => (
                  <div key={item.id} className="grid grid-cols-[4rem_1fr_auto] gap-3 py-4">
                    <time className="font-semibold tabular-nums">{item.scheduledAt}</time>
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      {item.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.notes}</p>}
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" >{TYPE_LABELS[item.type]}</Badge>
                      <p className="mt-1 text-xs text-muted-foreground">{item.duration_minutes} min</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="py-4 text-sm text-muted-foreground">A ordem do culto ainda não foi definida.</p>}
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
                      <span className="font-editorial text-2xl text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{song.title}</p>
                        {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
                      </div>
                      {key && <Badge variant="outline" >Tom {key}</Badge>}
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhuma música adicionada ao repertório.</p>}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
