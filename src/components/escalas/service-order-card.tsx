"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock3,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export type ServiceItem = {
  id: string;
  type: "WORSHIP" | "SPEAKING" | "MEDIA" | "OTHER";
  title: string;
  notes: string | null;
  duration_minutes: number;
  position: number;
};

const TYPE_LABELS: Record<ServiceItem["type"], string> = {
  WORSHIP: "Louvor",
  SPEAKING: "Fala",
  MEDIA: "Mídia",
  OTHER: "Outro",
};

function scheduleItems(items: ServiceItem[], startsAt: string) {
  let elapsedMinutes = 0;
  return items.map((item) => {
    const scheduledAt = new Date(
      new Date(startsAt).getTime() + elapsedMinutes * 60_000
    ).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    elapsedMinutes += item.duration_minutes;
    return { item, scheduledAt };
  });
}

type ItemFormProps = {
  item?: ServiceItem;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: {
    type: ServiceItem["type"];
    title: string;
    durationMinutes: number;
    notes: string;
  }) => void;
};

function ItemForm({ item, pending, onCancel, onSubmit }: ItemFormProps) {
  function submit(form: FormData) {
    onSubmit({
      type: String(form.get("type")) as ServiceItem["type"],
      title: String(form.get("title") ?? ""),
      durationMinutes: Number(form.get("durationMinutes")),
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
            className="h-11 rounded-xl"
            placeholder="Ex.: Boas-vindas"
          />
        </Field>
        <Field label="Tipo" required>
          <select
            name="type"
            defaultValue={item?.type ?? "OTHER"}
            className="h-11 w-full rounded-xl border bg-background px-3 text-base md:text-sm"
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Duração em minutos" required>
        <Input
          name="durationMinutes"
          type="number"
          defaultValue={item?.duration_minutes ?? 0}
          min={0}
          max={1440}
          step={1}
          required
          className="h-11 rounded-xl"
        />
      </Field>

      <Field label="Notas">
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={3}
          className="w-full rounded-xl border bg-background p-3 text-base md:text-sm"
          placeholder="Informações opcionais para a equipe"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending} className="h-11 rounded-full">
          {pending ? "Salvando…" : item ? "Salvar alterações" : "Adicionar item"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          className="h-11 rounded-full"
          onClick={onCancel}
        >
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
  canManage,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  startsAt: string;
  items: ServiceItem[];
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

  const scheduledItems = scheduleItems(items, startsAt);

  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock3 className="size-4" />
          Ordem do Culto
        </CardTitle>
        {canManage && !adding && (
          <Button
            variant="outline"
            className="h-10 rounded-full"
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
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">
            Nenhum item definido na ordem do culto.
          </p>
        )}

        {scheduledItems.map(({ item, scheduledAt }, index) => {
          if (editingId === item.id) {
            return (
              <ItemForm
                key={item.id}
                item={item}
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
                    <Badge variant="secondary" className="rounded-full">
                      {TYPE_LABELS[item.type]}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.duration_minutes} min
                  </p>
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
