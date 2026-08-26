import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Music } from "lucide-react";
import { getTenant } from "@/lib/tenant";
import { rotuloUltimaVez, type Song } from "@/lib/louvor";
import { getLouvorMinistry } from "@/lib/louvor-server";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SongForm } from "@/components/louvor/song-form";
import { YouTubeSongImporter } from "@/components/louvor/youtube-song-importer";

export default async function LouvorPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  const tenant = await getTenant(churchSlug);
  const louvor = await getLouvorMinistry(tenant.church.id);
  if (!louvor) redirect(`/${churchSlug}`);

  const supabase = await createClient();
  const [{ data: songs }, { data: historico }, { data: papel }] = await Promise.all([
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
    supabase
      .from("ministry_members")
      .select("role")
      .eq("ministry_id", louvor.id)
      .eq("user_id", tenant.userId)
      .eq("active", true)
      .maybeSingle(),
  ]);

  const podeEditar =
    tenant.isCoord || ["gerente", "lider"].includes(papel?.role ?? "");

  const ultima = new Map<string, string>();
  for (const h of historico ?? []) {
    const quando = (h.events as unknown as { starts_at: string }).starts_at;
    const atual = ultima.get(h.song_id);
    if (!atual || quando > atual) ultima.set(h.song_id, quando);
  }
  const acervo = (songs ?? []) as Song[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Louvor</h1>
        <p className="text-muted-foreground">
          O acervo de músicas da igreja. A sequência de cada culto se monta na
          página do evento.
        </p>
      </div>

      {podeEditar && (
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-base">Nova música</CardTitle>
            <CardDescription>
              Cadastre uma vez — a letra corrigida aqui vale para todos os cultos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <YouTubeSongImporter
              churchSlug={churchSlug}
              churchId={tenant.church.id}
            />
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              ou cadastre manualmente
              <span className="h-px flex-1 bg-border" />
            </div>
            <SongForm churchSlug={churchSlug} churchId={tenant.church.id} />
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="size-4" />
            Acervo · {acervo.length}{" "}
            {acervo.length === 1 ? "música" : "músicas"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {acervo.map((s) => (
            <Link
              key={s.id}
              href={`/${churchSlug}/louvor/${s.id}`}
              className="flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.artist}
                  {s.artist ? " · " : ""}
                  {s.default_key && `tom ${s.default_key}`}
                  {s.bpm ? ` · ${s.bpm} bpm` : ""}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {rotuloUltimaVez(ultima.get(s.id) ?? null)}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          ))}
          {acervo.length === 0 && (
            <p className="text-sm text-muted-foreground">
              O acervo está vazio.{" "}
              {podeEditar
                ? "Cadastre a primeira música acima."
                : "O líder do louvor ainda não cadastrou músicas."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
