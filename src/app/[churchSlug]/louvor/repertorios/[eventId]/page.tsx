import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { type SetlistItem, type Song } from "@/lib/louvor";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { createClient } from "@/lib/supabase/server";
import { SetlistCard } from "@/components/louvor/setlist-card";
import { AddToSetlist } from "@/components/louvor/add-to-setlist";
import { LoadError } from "@/components/shell/load-error";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LouvorRepertorioPage({
  params,
}: {
  params: Promise<{ churchSlug: string; eventId: string }>;
}) {
  const { churchSlug, eventId } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const [{ data: event, error: eventError }, { data: membership }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "id, title, starts_at, ends_at, location, setlist_status, setlist_published_at, youtube_playlist_url, youtube_playlist_error"
      )
      .eq("church_id", tenant.church.id)
      .eq("id", eventId)
      .maybeSingle(),
    supabase
      .from("ministry_members")
      .select("role")
      .eq("church_id", tenant.church.id)
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (eventError) console.error("louvor repertório: evento", eventError);
  if (!event) notFound();

  const canEdit = tenant.isCoord || ["gerente", "lider"].includes(membership?.role ?? "");

  const { data: setlist, error: setlistError } = await supabase
    .from("setlist_items")
    .select(
      "id, position, key_override, notes, songs(id, title, artist, default_key, bpm, lyrics, chord_chart, link, active)"
    )
    .eq("church_id", tenant.church.id)
    .eq("event_id", eventId)
    .order("position");
  const items = (setlist ?? []) as unknown as SetlistItem[];

  let library: (Song & { ultimaVez: string | null })[] = [];
  let libraryError = false;

  if (canEdit) {
    const [{ data: songs, error: songsError }, { data: history, error: historyError }] =
      await Promise.all([
        supabase
          .from("songs")
          .select("id, title, artist, default_key, bpm, lyrics, link, active")
          .eq("church_id", tenant.church.id)
          .eq("active", true)
          .order("title"),
        supabase
          .from("setlist_items")
          .select("song_id, events!inner(starts_at)")
          .eq("church_id", tenant.church.id)
          .lte("events.starts_at", new Date().toISOString()),
      ]);

    libraryError = !!songsError || !!historyError;
    if (songsError) console.error("louvor repertório: acervo", songsError);
    if (historyError) console.error("louvor repertório: histórico", historyError);

    const lastUsed = new Map<string, string>();
    for (const item of history ?? []) {
      const when = (item.events as unknown as { starts_at: string }).starts_at;
      const current = lastUsed.get(item.song_id);
      if (!current || when > current) lastUsed.set(item.song_id, when);
    }

    library = (songs ?? []).map((song) => ({
      ...song,
      ultimaVez: lastUsed.get(song.id) ?? null,
    }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/${churchSlug}/louvor?aba=repertorios`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Repertórios
        </Link>
        <Link
          href={`/${churchSlug}/escalas/${eventId}`}
          className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition hover:bg-accent"
        >
          Ver culto completo
        </Link>
      </div>

      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Repertório do Louvor
        </p>
        <h1 className="page-title mt-2">{event.title}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatEventDate(event.starts_at)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-4" />
            {formatEventTime(event.starts_at)}
            {event.ends_at ? ` – ${formatEventTime(event.ends_at)}` : ""}
          </span>
          {event.location && <span>· {event.location}</span>}
        </p>
      </header>

      {setlistError ? (
        <LoadError oQue="o repertório" />
      ) : (
        <SetlistCard
          churchSlug={churchSlug}
          churchId={tenant.church.id}
          eventId={eventId}
          itens={items}
          publicado={event.setlist_status === "publicado"}
          publicadoEm={event.setlist_published_at}
          youtubePlaylistUrl={event.youtube_playlist_url}
          youtubePlaylistError={event.youtube_playlist_error}
          podeEditar={canEdit}
        />
      )}

      {canEdit && libraryError && <LoadError oQue="o acervo de músicas" />}

      {canEdit && !libraryError && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Montar repertório</CardTitle>
            <CardDescription>
              Escolha músicas do acervo na ordem em que serão cantadas neste culto.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddToSetlist
              churchSlug={churchSlug}
              churchId={tenant.church.id}
              eventId={eventId}
              acervo={library}
              jaEscolhidas={items.map((item) => item.songs.id)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
