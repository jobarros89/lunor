import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import type { Song } from "@/lib/louvor";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import { SongForm } from "@/components/louvor/song-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function EditarMusicaPage({
  params,
}: {
  params: Promise<{ churchSlug: string; songId: string }>;
}) {
  const { churchSlug, songId } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const [{ data: song }, { data: papel }] = await Promise.all([
    supabase
      .from("songs")
      .select("id, title, artist, default_key, bpm, time_signature, lyrics, chord_chart, link, youtube_video_id, spotify_track_id, active")
      .eq("id", songId)
      .eq("church_id", tenant.church.id)
      .maybeSingle(),
    supabase
      .from("ministry_members")
      .select("role")
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!song) notFound();

  const podeEditar = tenant.isCoord || Boolean(papel);
  if (!podeEditar) redirect(`/${churchSlug}/louvor/${songId}`);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        nativeButton={false}
        className="-ml-3 rounded-full"
        render={<Link href={`/${churchSlug}/louvor/${songId}`} />}
      >
        <ArrowLeft className="size-4" />
        Voltar para a música
      </Button>

      <div>
        <h1 className="page-title ">
          Editar música
        </h1>
        <p className="text-muted-foreground">{song.title}</p>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="pt-6">
          <SongForm
            mode="edit"
            churchSlug={churchSlug}
            churchId={tenant.church.id}
            song={song as Song}
          />
        </CardContent>
      </Card>
    </div>
  );
}
