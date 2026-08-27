"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createEvent } from "@/lib/actions/escalas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

type Option = { id: string; name: string };
type DepartmentOption = Option & { ministry_id: string | null };

export function EventForm({
  churchSlug,
  churchId,
  eventTypes,
  ministries,
  departments,
}: {
  churchSlug: string;
  churchId: string;
  eventTypes: Option[];
  ministries: Option[];
  departments: DepartmentOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [v, setV] = useState<{
    typeId: string | null;
    ministryId: string | null;
    departmentId: string | null;
    title: string;
    description: string;
    location: string;
    mapUrl: string;
    script: string;
    startsAt: string;
    endsAt: string;
  }>({
    typeId: eventTypes[0]?.id ?? null,
    ministryId: null,
    departmentId: null,
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
    startTransition(async () => {
      const result = await createEvent({ churchSlug, churchId, ...v });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  const inputCls = "h-11 rounded-xl";
  const selectCls = "h-11 w-full rounded-xl border bg-background px-3 text-sm";
  const ministryDepartments = v.ministryId
    ? departments.filter((d) => d.ministry_id === v.ministryId)
    : [];
  const showDepartment = ministryDepartments.length > 0;

  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-4 pt-6">
        <Field label="Título" required>
          <Input
            value={v.title}
            onChange={(e) => setV({ ...v, title: e.target.value })}
            placeholder="Ex.: Culto de Domingo"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select
              value={v.typeId ?? ""}
              onChange={(e) => setV({ ...v, typeId: e.target.value || null })}
              className={selectCls}
            >
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ministério">
            <select
              value={v.ministryId ?? ""}
              onChange={(e) =>
                setV({
                  ...v,
                  ministryId: e.target.value || null,
                  departmentId: null,
                })
              }
              className={selectCls}
            >
              <option value="">Toda a igreja</option>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          {showDepartment && (
            <Field label="Onde servir?">
              <select
                value={v.departmentId ?? ""}
                onChange={(e) =>
                  setV({ ...v, departmentId: e.target.value || null })
                }
                className={selectCls}
              >
                <option value="">Sem especificar</option>
                {ministryDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Início" required>
            <Input
              type="datetime-local"
              value={v.startsAt}
              onChange={(e) => setV({ ...v, startsAt: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Fim">
            <Input
              type="datetime-local"
              value={v.endsAt}
              onChange={(e) => setV({ ...v, endsAt: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Local">
          <Input
            value={v.location}
            onChange={(e) => setV({ ...v, location: e.target.value })}
            placeholder="Ex.: Templo principal"
            className={inputCls}
          />
        </Field>
        <Field label="Mapa (URL)">
          <Input
            value={v.mapUrl}
            onChange={(e) => setV({ ...v, mapUrl: e.target.value })}
            placeholder="Link do Google Maps"
            className={inputCls}
          />
        </Field>
        <Field label="Observações">
          <Input
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Roteiro">
          <textarea
            value={v.script}
            onChange={(e) => setV({ ...v, script: e.target.value })}
            rows={4}
            className="w-full rounded-xl border bg-background p-3 text-base md:text-sm"
            placeholder="Cronograma / roteiro do evento"
          />
        </Field>

        <Button
          type="button"
          disabled={pending}
          onClick={submit}
          className="h-12 w-full rounded-full text-base"
        >
          {pending ? "Criando…" : "Criar evento"}
        </Button>
      </CardContent>
    </Card>
  );
}
