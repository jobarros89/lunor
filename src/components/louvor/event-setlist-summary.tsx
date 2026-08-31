import Link from "next/link";
import { ArrowUpRight, Music } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type EventSetlistSummaryItem = {
  id: string;
  position: number;
  key_override: string | null;
  songs:
    | {
        id: string;
        title: string;
        artist: string | null;
        default_key: string | null;
        bpm: number | null;
      }
    | {
        id: string;
        title: string;
        artist: string | null;
        default_key: string | null;
        bpm: number | null;
      }[];
};

function firstRelated<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export function EventSetlistSummary({
  churchSlug,
  eventId,
  items,
  published,
  canOpenLouvor,
}: {
  churchSlug: string;
  eventId: string;
  items: EventSetlistSummaryItem[];
  published: boolean;
  canOpenLouvor: boolean;
}) {
  return (
    <Card className="rounded-3xl">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Music className="size-4" />
              Repertório
            </CardTitle>
            <CardDescription className="mt-1">
              Visão das músicas deste culto. A gestão do repertório acontece no módulo Louvor.
            </CardDescription>
          </div>
          <Badge
            className={`rounded-full border-0 ${
              published
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            }`}
          >
            {published ? "Publicado" : "Em preparação"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          <div className="divide-y rounded-2xl border">
            {items.map((item, index) => {
              const song = firstRelated(item.songs);
              if (!song) return null;
              const key = item.key_override ?? song.default_key;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-4 py-3"
                >
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{song.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {[song.artist, key ? `Tom ${key}` : null, song.bpm ? `${song.bpm} bpm` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {published
              ? "Nenhuma música publicada para este culto."
              : canOpenLouvor
                ? "Nenhuma música definida ainda."
                : "O repertório ainda está sendo preparado pelo Louvor."}
          </p>
        )}

        {canOpenLouvor && (
          <Link
            href={`/${churchSlug}/louvor/repertorios/${eventId}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors hover:bg-accent"
          >
            Abrir no Louvor
            <ArrowUpRight className="size-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
