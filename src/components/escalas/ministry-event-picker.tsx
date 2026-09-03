import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Plus } from "lucide-react";
import { formatEventDate, formatEventTime } from "@/lib/escalas";
import { eventContextLabel } from "@/lib/event-context";
import { Card, CardContent } from "@/components/ui/card";

type RelatedName = { name: string } | { name: string }[] | null;

export type MinistryEventPickerRow = {
  id: string;
  title: string;
  starts_at: string;
  location: string | null;
  service_period: string | null;
  campuses: RelatedName;
};

function firstRelated(value: RelatedName) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

export function MinistryEventPicker({
  churchSlug,
  ministryName,
  events,
  detailBaseHref,
}: {
  churchSlug: string;
  ministryName: string;
  events: MinistryEventPickerRow[];
  detailBaseHref: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        A escala de {ministryName} usa o mesmo culto da igreja. Escolha o culto e depois defina o horário de chegada e saída da equipe.
      </div>

      <div className="divide-y rounded-3xl border">
        {events.map((event) => {
          const campus = firstRelated(event.campuses);
          const context = eventContextLabel({
            campusName: campus?.name,
            servicePeriod: event.service_period,
            fallbackLocation: event.location,
          });
          return (
            <Link
              key={event.id}
              href={`${detailBaseHref}/${event.id}`}
              className="grid gap-3 px-4 py-4 transition hover:bg-accent/40 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{event.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatEventDate(event.starts_at)}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" />Culto {formatEventTime(event.starts_at)}</span>
                  {context && <span>· {context}</span>}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 text-sm font-medium">
                Usar este culto <ArrowRight className="size-4" />
              </span>
            </Link>
          );
        })}
      </div>

      {events.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="space-y-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum culto futuro cadastrado.</p>
            <Link
              href={`/${churchSlug}/escalas/novo`}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background"
            >
              <Plus className="size-4" /> Criar culto
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
