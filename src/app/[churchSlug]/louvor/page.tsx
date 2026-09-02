import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Layers3, Music, Plus, Video } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { type Song } from "@/lib/louvor";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SongForm } from "@/components/louvor/song-form";
import { Button } from "@/components/ui/button";
import { YouTubeSongImporter } from "@/components/louvor/youtube-song-importer";
import { SongLibrary } from "@/components/louvor/song-library";

const youtubeStatusMessage: Record<string, { text: string; success?: boolean }> = {
  connected: { text: "Conta do YouTube conectada com sucesso.", success: true },
  "not-configured": { text: "A conexão com o YouTube ainda não foi configurada no servidor." },
  "connection-error": { text: "Não foi possível conectar a conta do YouTube. Tente novamente." },
  "authorization-denied": { text: "A autorização do YouTube foi cancelada." },
  "session-expired": { text: "Sua sessão expirou. Entre novamente antes de conectar o YouTube." },
  "state-expired": { text: "A tentativa de conexão expirou. Inicie novamente." },
};

type WorshipTab = "acervo" | "repertorios" | "arranjos";
type SetlistEvent = {
  id: string;
  title: string;
  starts_at: string;
  setlist_status: string;
  youtube_playlist_url: string | null;
  setlist_items: { id: string }[];
};
type ArrangementRow = {
  id: string;
  name: string;
  updated_at: string;
  songs: { id: string; title: string; artist: string | null } | { id: string; title: string; artist: string | null }[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function LouvorPage({
  params,
  searchParams,
}: {
  params: Promise<{ churchSlug: string }>;
  searchParams: Promise<{ youtube?: string; aba?: string; novo?: string }>;
}) {
  const [{ churchSlug }, query] = await Promise.all([params, searchParams]);
  const tab: WorshipTab = ["acervo", "repertorios", "arranjos"].includes(query.aba ?? "")
    ? (query.aba as WorshipTab)
    : "acervo";
  const showNew = query.novo === "1";
  const youtubeMessage = query.youtube ? youtubeStatusMessage[query.youtube] : undefined;

  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);
  if (query.aba === "disponibilidade") {
    redirect(`/${churchSlug}/louvor/disponibilidade`);
  }

  const supabase = await createClient();
  const now = new Date();
  const futureLimit = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString();
  const pastLimit = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: songs },
    { data: historico },
    { data: papel },
    { data: youtubeIntegration },
    { data: repertoireEvents },
    { data: arrangements },
  ] = await Promise.all([
    supabase
      .from("songs")
      .select("id, title, artist, default_key, bpm, time_signature, lyrics, link, active")
      .eq("church_id", tenant.church.id)
      .eq("active", true)
      .order("title"),
    supabase
      .from("setlist_items")
      .select("song_id, events!inner(starts_at)")
      .eq("church_id", tenant.church.id)
      .lte("events.starts_at", now.toISOString()),
    supabase
      .from("ministry_members")
      .select("role")
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("church_music_integrations")
      .select("account_label, updated_at")
      .eq("church_id", tenant.church.id)
      .eq("provider", "YOUTUBE")
      .maybeSingle(),
    supabase
      .from("events")
      .select("id, title, starts_at, setlist_status, youtube_playlist_url, setlist_items(id)")
      .eq("church_id", tenant.church.id)
      .gte("starts_at", pastLimit)
      .lte("starts_at", futureLimit)
      .order("starts_at", { ascending: false })
      .limit(30),
    supabase
      .from("song_arrangements")
      .select("id, name, updated_at, songs!inner(id, title, artist)")
      .eq("church_id", tenant.church.id)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);

  const podeEditar = tenant.isCoord || ["gerente", "lider"].includes(papel?.role ?? "");
  const ultima = new Map<string, string>();
  for (const item of historico ?? []) {
    const when = (item.events as unknown as { starts_at: string }).starts_at;
    const current = ultima.get(item.song_id);
    if (!current || when > current) ultima.set(item.song_id, when);
  }

  const acervo = (songs ?? []) as Song[];
  const lastUsed = Object.fromEntries(acervo.map((song) => [song.id, ultima.get(song.id) ?? null]));
  const repertorios = ((repertoireEvents ?? []) as unknown as SetlistEvent[])
    .filter((event) => event.setlist_items.length > 0 || new Date(event.starts_at) >= now)
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
  const arranjos = (arrangements ?? []) as unknown as ArrangementRow[];
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Ministério de música</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Louvor</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Música, repertórios, arranjos e operação do time em um só módulo.
          </p>
        </div>
        {podeEditar && (
          <Link
            href={`/${churchSlug}/louvor?aba=${tab}&novo=1`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:bg-primary/80"
          >
            <Plus className="size-4" />
            Nova música
          </Link>
        )}
      </header>

      <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Conteúdo do Louvor">
        <TabLink churchSlug={churchSlug} tab="acervo" active={tab === "acervo"} icon={<Music className="size-4" />} label="Acervo" />
        <TabLink churchSlug={churchSlug} tab="repertorios" active={tab === "repertorios"} icon={<CalendarDays className="size-4" />} label="Repertórios" />
        <TabLink churchSlug={churchSlug} tab="arranjos" active={tab === "arranjos"} icon={<Layers3 className="size-4" />} label="Arranjos" />
      </nav>

      {showNew && podeEditar && (
        <Card className="rounded-3xl border-foreground/20">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Adicionar música</CardTitle>
              <CardDescription>Pesquise no YouTube e cadastre em poucos passos.</CardDescription>
            </div>
            <Link href={`/${churchSlug}/louvor?aba=${tab}`} className="text-sm text-muted-foreground underline underline-offset-4">Fechar</Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium"><Video className="size-4" /> Conta oficial no YouTube</p>
                <p className="truncate text-xs text-muted-foreground">
                  {youtubeIntegration?.account_label ? `Conectada: ${youtubeIntegration.account_label}` : "Conecte a conta que será dona das playlists não listadas."}
                </p>
              </div>
              <Button
                nativeButton={false}
                variant="ghost"
                className="h-9 shrink-0 rounded-full px-3"
                render={<a href={`/api/integrations/youtube/connect?churchId=${tenant.church.id}&returnTo=${encodeURIComponent(`/${churchSlug}/louvor?aba=${tab}&novo=1`)}`} />}
              >
                {youtubeIntegration ? "Reconectar" : "Conectar YouTube"}
              </Button>
            </div>
            {youtubeMessage && (
              <p role="status" className={youtubeMessage.success ? "text-sm text-emerald-600 dark:text-emerald-400" : "text-sm text-destructive"}>
                {youtubeMessage.text}
              </p>
            )}
            <YouTubeSongImporter churchSlug={churchSlug} churchId={tenant.church.id} />
            <SongForm churchSlug={churchSlug} churchId={tenant.church.id} />
          </CardContent>
        </Card>
      )}

      {tab === "acervo" && (
        <section>
          <SongLibrary churchSlug={churchSlug} songs={acervo} lastUsed={lastUsed} />
          {acervo.length === 0 && !podeEditar && (
            <p className="text-sm text-muted-foreground">O líder do louvor ainda não cadastrou músicas.</p>
          )}
        </section>
      )}

      {tab === "repertorios" && (
        <section className="space-y-3">
          <div className="flex items-end justify-between border-b pb-3">
            <div>
              <h2 className="text-xl font-semibold">Repertórios</h2>
              <p className="mt-1 text-sm text-muted-foreground">Cultos recentes e próximos com a sequência musical.</p>
            </div>
            <span className="text-xs text-muted-foreground">{repertorios.length} cultos</span>
          </div>
          <div className="divide-y">
            {repertorios.map((event) => {
              const future = new Date(event.starts_at) >= now;
              return (
                <Link key={event.id} href={`/${churchSlug}/louvor/repertorios/${event.id}`} className="grid gap-2 py-4 transition hover:opacity-70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{event.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(event.starts_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })} · {new Date(event.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
                    <span>{event.setlist_items.length} {event.setlist_items.length === 1 ? "música" : "músicas"}</span>
                    <span className="rounded-full bg-muted px-2.5 py-1">{event.setlist_status === "publicado" ? "Publicado" : future ? "Em preparo" : "Rascunho"}</span>
                    {event.youtube_playlist_url && <span className="rounded-full bg-muted px-2.5 py-1">Playlist pronta</span>}
                  </div>
                </Link>
              );
            })}
            {repertorios.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum repertório encontrado neste período.</p>}
          </div>
        </section>
      )}

      {tab === "arranjos" && (
        <section className="space-y-3">
          <div className="flex items-end justify-between border-b pb-3">
            <div>
              <h2 className="text-xl font-semibold">Arranjos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Versões que a igreja usa para executar cada música.</p>
            </div>
            <span className="text-xs text-muted-foreground">{arranjos.length} arranjos</span>
          </div>
          <div className="divide-y">
            {arranjos.map((arrangement) => {
              const song = firstRelated(arrangement.songs);
              if (!song) return null;
              return (
                <Link key={arrangement.id} href={`/${churchSlug}/louvor/${song.id}`} className="grid gap-2 py-4 transition hover:opacity-70 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{song.title}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{arrangement.name}{song.artist ? ` · ${song.artist}` : ""}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">Atualizado {new Date(arrangement.updated_at).toLocaleDateString("pt-BR")}</span>
                </Link>
              );
            })}
            {arranjos.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum arranjo ativo ainda.</p>}
          </div>
        </section>
      )}

    </div>
  );
}

function TabLink({ churchSlug, tab, active, icon, label }: { churchSlug: string; tab: WorshipTab; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={`/${churchSlug}/louvor?aba=${tab}`}
      aria-current={active ? "page" : undefined}
      className={`flex h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-medium transition ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {icon}
      {label}
    </Link>
  );
}
