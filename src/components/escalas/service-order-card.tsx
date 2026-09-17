"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
  MonitorPlay,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  createServiceItem,
  moveServiceItem,
  removeServiceItem,
  updateServiceItem,
} from "@/lib/actions/service-items";
import {
  scheduleServiceOrder,
  serviceOrderClockToOffset,
  serviceOrderOffsetToClock,
} from "@/lib/service-order";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ServiceItem = {
  id: string;
  type: "WORSHIP" | "SPEAKING" | "MEDIA" | "OTHER";
  title: string;
  notes: string | null;
  duration_minutes: number;
  position: number;
  scheduled_offset_minutes: number | null;
  ministry_id: string | null;
  responsible_assignment_id: string | null;
};

export type ServiceOrderTeamOption = {
  id: string;
  name: string;
};

export type ServiceOrderResponsibleOption = {
  id: string;
  name: string;
  roleName: string;
  ministryId: string | null;
};

const TYPE_LABELS: Record<ServiceItem["type"], string> = {
  WORSHIP: "Louvor",
  SPEAKING: "Fala",
  MEDIA: "Mídia",
  OTHER: "Outro",
};

type ItemFormProps = {
  item?: ServiceItem;
  startsAt: string;
  teams: ServiceOrderTeamOption[];
  responsibles: ServiceOrderResponsibleOption[];
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    type: ServiceItem["type"];
    title: string;
    durationMinutes: number;
    scheduledOffsetMinutes: number | null;
    ministryId: string | null;
    responsibleAssignmentId: string | null;
    notes: string;
  }) => void;
};

function ItemForm({
  item,
  startsAt,
  teams,
  responsibles,
  pending,
  onCancel,
  onSubmit,
}: ItemFormProps) {
  function submit(form: FormData) {
    const scheduledTime = String(form.get("scheduledTime") ?? "");
    const ministryId = String(form.get("ministryId") ?? "");
    const responsibleAssignmentId = String(form.get("responsibleAssignmentId") ?? "");

    onSubmit({
      type: String(form.get("type")) as ServiceItem["type"],
      title: String(form.get("title") ?? ""),
      durationMinutes: Number(form.get("durationMinutes")),
      scheduledOffsetMinutes: scheduledTime
        ? serviceOrderClockToOffset(startsAt, scheduledTime)
        : null,
      ministryId: ministryId || null,
      responsibleAssignmentId: responsibleAssignmentId || null,
      notes: String(form.get("notes") ?? ""),
    });
  }

  return (
    <form action={submit} className="space-y-4 rounded-2xl border p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Título" required>
          <Input
            name="title"
            defaultValue={item?.title ?? ""}
            maxLength={160}
            required
            placeholder="Ex.: Boas-vindas"
          />
        </Field>
        <Field label="Tipo" required>
          <Select
            name="type"
            defaultValue={item?.type ?? "OTHER"}
            className="w-full text-base md:text-sm"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Horário">
          <Input
            name="scheduledTime"
            type="time"
            defaultValue={
              item?.scheduled_offset_minutes !== null &&
              item?.scheduled_offset_minutes !== undefined
                ? serviceOrderOffsetToClock(startsAt, item.scheduled_offset_minutes)
                : ""
            }
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Vazio = calculado automaticamente pela ordem e duração.
          </p>
        </Field>
        <Field label="Duração em minutos" required>
          <Input
            name="durationMinutes"
            type="number"
            defaultValue={item?.duration_minutes ?? 0}
            min={0}
            max={1440}
            step={1}
            required
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Time">
          <Select
            name="ministryId"
            defaultValue={item?.ministry_id ?? ""}
            className="w-full text-base md:text-sm"
          >
            <option value="">Sem time específico</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsável">
          <Select
            name="responsibleAssignmentId"
            defaultValue={item?.responsible_assignment_id ?? ""}
            className="w-full text-base md:text-sm"
          >
            <option value="">Sem responsável específico</option>
            {responsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.roleName} — {responsible.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Observação">
        <Textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={3}
          className="w-full p-3 text-base md:text-sm"
          placeholder="Informações opcionais para a equipe"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : item ? "Salvar alterações" : "Adicionar item"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function ServiceOrderCard({
  churchSlug,
  churchId,
  eventId,
  startsAt,
  items,
  teams,
  responsibles,
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  startsAt: string;
  items: ServiceItem[];
  teams: ServiceOrderTeamOption[];
  responsibles: ServiceOrderResponsibleOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess?: () => void
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? "Não foi possível concluir a ação");
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  const scheduledItems = scheduleServiceOrder(items, startsAt);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const responsiblesById = new Map(
    responsibles.map((responsible) => [responsible.id, responsible])
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="size-4" />
          Ordem do Culto
        </CardTitle>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/${churchSlug}/escalas/${eventId}/modo-culto`}
            className={buttonVariants({ variant: "secondary", className: "h-10 rounded-full" })}
          >
            <MonitorPlay className="size-4" />
            Modo Culto
          </Link>
          {canManage && !adding && (
            <Button
              variant="outline"
              className="h-10"
              disabled={pending}
              onClick={() => {
                setEditingId(null);
                setAdding(true);
              }}
            >
              <Plus className="size-4" />
              Adicionar item
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            Nenhum item definido na ordem do culto.
          </p>
        )}

        {scheduledItems.map(({ scheduledAt, ...item }, index) => {
          const team = item.ministry_id ? teamsById.get(item.ministry_id) : null;
          const responsible = item.responsible_assignment_id
            ? responsiblesById.get(item.responsible_assignment_id)
            : null;

          if (editingId === item.id) {
            return (
              <ItemForm
                key={item.id}
                item={item}
                startsAt={startsAt}
                teams={teams}
                responsibles={responsibles}
                pending={pending}
                onCancel={() => setEditingId(null)}
                onSubmit={(values) =>
                  run(
                    () =>
                      updateServiceItem({
                        churchSlug,
                        churchId,
                        eventId,
                        itemId: item.id,
                        ...values,
                      }),
                    () => setEditingId(null)
                  )
                }
              />
            );
          }

          return (
            <div key={item.id} className="rounded-2xl border px-4 py-3">
              <div className="flex items-start gap-3">
                <time className="mt-0.5 shrink-0 text-base font-semibold tabular-nums">
                  {scheduledAt}
                </time>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.title}</p>
                    <Badge variant="secondary">{TYPE_LABELS[item.type]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.duration_minutes} min
                    {team ? ` · ${team.name}` : ""}
                  </p>
                  {responsible && (
                    <p className="mt-1 text-sm font-medium">
                      {responsible.roleName} · {responsible.name}
                    </p>
                  )}
                  {item.notes && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
                {canManage && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === 0}
                      onClick={() =>
                        run(() =>
                          moveServiceItem({
                            churchSlug,
                            churchId,
                            eventId,
                            itemId: item.id,
                            direction: "up",
                          })
                        )
                      }
                      aria-label={`Subir ${item.title}`}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === items.length - 1}
                      onClick={() =>
                        run(() =>
                          moveServiceItem({
                            churchSlug,
                            churchId,
                            eventId,
                            itemId: item.id,
                            direction: "down",
                          })
                        )
                      }
                      aria-label={`Descer ${item.title}`}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => {
                        setAdding(false);
                        setEditingId(item.id);
                      }}
                      aria-label={`Editar ${item.title}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          removeServiceItem({
                            churchSlug,
                            churchId,
                            eventId,
                            itemId: item.id,
                          })
                        )
                      }
                      aria-label={`Remover ${item.title}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {adding && (
          <ItemForm
            startsAt={startsAt}
            teams={teams}
            responsibles={responsibles}
            pending={pending}
            onCancel={() => setAdding(false)}
            onSubmit={(values) =>
              run(
                () =>
                  createServiceItem({
                    churchSlug,
                    churchId,
                    eventId,
                    ...values,
                  }),
                () => setAdding(false)
              )
            }
          />
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
