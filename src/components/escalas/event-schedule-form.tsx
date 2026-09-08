"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateEventSchedule } from "@/lib/actions/event-update-schedule";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function toDateTimeLocal(iso: string | null) {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export function EventScheduleForm({
  churchSlug,
  churchId,
  eventId,
  eventTitle,
  initialStartsAt,
  initialEndsAt,
}: {
  churchSlug: string;
  churchId: string;
  eventId: string;
  eventTitle: string;
  initialStartsAt: string;
  initialEndsAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [startsAt, setStartsAt] = useState(toDateTimeLocal(initialStartsAt));
  const [endsAt, setEndsAt] = useState(toDateTimeLocal(initialEndsAt));

  function submit() {
    if (!startsAt) return toast.error("Escolha a data e hora de início");
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      return toast.error("O horário de término precisa ser posterior ao horário de início");
    }

    startTransition(async () => {
      const result = await updateEventSchedule({
        churchSlug,
        churchId,
        eventId,
        startsAt,
        endsAt,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Data e horário atualizados");
      router.push(`/${churchSlug}/escalas/${eventId}`);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-5 pt-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Culto</p>
          <p className="mt-1 font-medium">{eventTitle}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início" required>
            <Input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
          <Field label="Fim">
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              className="h-11 rounded-xl"
            />
          </Field>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          A alteração atualiza este mesmo culto e mantém repertório, escalas e times já vinculados.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link
            href={`/${churchSlug}/escalas/${eventId}`}
            className={buttonVariants({ variant: "outline", className: "h-11 rounded-full px-5" })}
          >
            Cancelar
          </Link>
          <Button
            type="button"
            disabled={pending}
            onClick={submit}
            className="h-11 rounded-full px-5"
          >
            {pending ? "Salvando…" : "Salvar data e horário"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
