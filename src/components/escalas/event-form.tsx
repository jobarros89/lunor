"use client";

import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEventWithContext } from "@/lib/actions/event-create";
import { inferServicePeriod } from "@/lib/event-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

type Option = { id: string; name: string };

type RedirectContext = "louvor" | "kids";

export function EventForm({
  churchSlug,
  churchId,
  eventTypes,
  ministries,
  campuses,
  initialMinistryId = null,
  fixedMinistryName,
  redirectContext,
}: {
  churchSlug: string;
  churchId: string;
  eventTypes: Option[];
  ministries: Option[];
  campuses: Option[];
  initialMinistryId?: string | null;
  fixedMinistryName?: string;
  redirectContext?: RedirectContext;
}) {
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<{
    typeId: string | null;
    ministryId: string | null;
    campusId: string | null;
    servicePeriod: "manha" | "tarde" | "noite" | null;
    title: string;
    description: string;
    location: string;
    mapUrl: string;
    script: string;
    startsAt: string;
    endsAt: string;
  }>({
    typeId: eventTypes[0]?.id ?? null,
    ministryId: initialMinistryId,
    campusId: campuses[0]?.id ?? null,
    servicePeriod: null,
    title: "",
    description: "",
    location: "",
    mapUrl: "",
    script: "",
    startsAt: "",
    endsAt: "",
  });

  function submit() {
    if (v.title.length < 2) return toast.error("Dê um título ao evento");
    if (!v.startsAt) return toast.error("Escolha a data e hora de início");
    if (v.endsAt && new Date(v.endsAt) <= new Date(v.startsAt)) {
      return toast.error("O horário de término precisa ser posterior ao horário de início");
    }
    startTransition(async () => {
      const result = await createEventWithContext({
        churchSlug,
        churchId,
        redirectContext: redirectContext ?? null,
        ...v,
      });
      if (result && !result.ok) toast.error(result.error);
    });
  }


  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <Field label="Título" required>
          <Input
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            placeholder="Ex.: Culto de Domingo"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <Select
              value={v.typeId ?? ""}
              onChange={(e) => setV({ ...v, typeId: e.target.value || null })}
            >
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ministério">
            {fixedMinistryName ? (
              <div className="flex h-11 items-center rounded-xl border bg-muted/40 px-3 text-sm font-medium">
                {fixedMinistryName}
              </div>
            ) : (
              <Select
                value={v.ministryId ?? ""}
                onChange={(e) => setV({ ...v, ministryId: e.target.value || null })}
              >
                <option value="">Toda a igreja</option>
                {ministries.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Campus">
            <Select
              value={v.campusId ?? ""}
              onChange={(e) => setV({ ...v, campusId: e.target.value || null })}
            >
              <option value="">Sem campus definido</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Período do culto">
            <Select
              value={v.servicePeriod ?? ""}
              onChange={(e) =>
                setV({
                  ...v,
                  servicePeriod:
                    (e.target.value as "manha" | "tarde" | "noite") || null,
                })
              }
            >
              <option value="">Não definido</option>
              <option value="manha">Manhã</option>
              <option value="tarde">Tarde</option>
              <option value="noite">Noite</option>
            </Select>
          </Field>
          <Field label="Início" required>
            <Input
              type="datetime-local"
              value={v.startsAt}
              onChange={(e) => {
                const startsAt = e.target.value;
                setV({
                  ...v,
                  startsAt,
                  servicePeriod: v.servicePeriod ?? inferServicePeriod(startsAt),
                });
              }}
            />
          </Field>
          <Field label="Fim">
            <Input
              type="datetime-local"
              value={v.endsAt}
              onChange={(e) => setV({ ...v, endsAt: e.target.value })}
            />
          </Field>
        </div>

        <Field label="Local complementar">
          <Input
            value={v.location}
            onChange={(e) => setV({ ...v, location: e.target.value })}
            placeholder="Ex.: Auditório 2 (opcional)"
          />
        </Field>
        <Field label="Mapa (URL)">
          <Input
            value={v.mapUrl}
            onChange={(e) => setV({ ...v, mapUrl: e.target.value })}
            placeholder="Link do Google Maps"
          />
        </Field>
        <Field label="Observações">
          <Input
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
          />
        </Field>
        <Field label="Roteiro">
          <Textarea
            value={v.script}
            onChange={(e) => setV({ ...v, script: e.target.value })}
            rows={4}
            className="w-full p-3 text-base md:text-sm"
            placeholder="Cronograma / roteiro do evento"
          />
        </Field>

        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="h-12 w-full text-base"
        >
          {pending ? "Criando…" : redirectContext ? "Criar escala" : "Criar evento"}
        </Button>
      </CardContent>
    </Card>
  );
}
