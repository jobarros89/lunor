import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Music, Pencil } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { rotuloUltimaVez, type Song } from "@/lib/louvor";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SongArchiveButton } from "@/components/louvor/song-archive-button";
import { SongDeleteButton } from "@/components/louvor/song-delete-button";
import { ChordImporter } from "@/components/louvor/chord-importer";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function referenceHref(link: string): string | null {
  try {
    const candidate = /^https?:\/\//i.test(link) ? link : `https://${link}`;
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default async function MusicaDetalhePage({
  params,
}: {
  params: Promise<{ churchSlug: string; songId: string }>;
}) {
  const { churchSlug, songId } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const [
    { data: song },
    { data: historico },
    { data: papel },
    { data: arrangements },
  ] = await Promise.all([
    supabase
      .from("songs")
      .select("id, title, artist, default_key, bpm, lyrics, chord_chart, link, youtube_video_id, spotify_track_id, active")
      .eq("id", songId)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("setlist_items")
      .select("events!inner(starts_at)")
      .eq("church_id", tenant.church.id)
      .eq("song_id", songId)
      .lte("events.starts_at", new Date().toISOString()),
    supabase
      .from("ministry_members")
      .select("role")
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("song_arrangements")
      .select("id, name")
      .eq("song_id", songId)
      .eq("active", true)
      .order("name"),
  ]);

  if (!song) notFound();

  const musica = song as Song;
  const ultimaVez = (historico ?? []).reduce<string | null>((maisRecente, item) => {
    const quando = (item.events as unknown as { starts_at: string }).starts_at;
    return !maisRecente || quando > maisRecente ? quando : maisRecente;
  }, null);
  const referencia = musica.link ? referenceHref(musica.link) : null;
  const podeEditar =
    tenant.isCoord || ["gerente", "lider"].includes(papel?.role ?? "");

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        className="-ml-3 rounded-full"
        render={<Link href={`/${churchSlug}/louvor`} />}
      >
        <ArrowLeft className="size-4" />
        Voltar ao acervo
      </Button>

      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Música</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {musica.title}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {musica.artist || "Artista não informado"}
            </p>
          </div>
          <Badge variant={musica.active ? "default" : "secondary"}>
            {musica.active ? "Ativa" : "Arquivada"}
          </Badge>
        </div>
      </header>

      {podeEditar && (
        <div className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            className="rounded-full"
            render={<Link href={`/${churchSlug}/louvor/${songId}/editar`} />}
          >
            <Pencil className="size-4" />
            Editar música
          </Button>
          <SongArchiveButton
            churchSlug={churchSlug}
            songId={songId}
            active={musica.active}
          />
          <SongDeleteButton
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            songId={songId}
            songTitle={musica.title}
          />
          <ChordImporter
            churchSlug={churchSlug}
            songId={songId}
            arrangements={arrangements ?? []}
          />
        </div>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="size-4" />
            Detalhes
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tom padrão
            </p>
            <p className="mt-1 font-medium">{musica.default_key || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              BPM
            </p>
            <p className="mt-1 font-medium">{musica.bpm ?? "—"}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Última vez
            </p>
            <p className="mt-1 font-medium">{rotuloUltimaVez(ultimaVez)}</p>
            {ultimaVez && (
              <p className="text-xs text-muted-foreground">
                {new Date(ultimaVez).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {musica.link && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Referência</CardTitle>
          </CardHeader>
          <CardContent>
            {referencia ? (
              <a
                href={referencia}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 break-all text-sm font-medium underline underline-offset-4"
              >
                {musica.link}
                <ExternalLink className="size-4 shrink-0" />
              </a>
            ) : (
              <p className="break-all text-sm text-muted-foreground">
                {musica.link}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Letra</CardTitle>
        </CardHeader>
        <CardContent>
          {musica.lyrics ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {musica.lyrics}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma letra cadastrada.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Cifra</CardTitle>
        </CardHeader>
        <CardContent>
          {musica.chord_chart ? (
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
              {musica.chord_chart}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma cifra cadastrada.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
