"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ChevronLeft, ChevronRight, Pencil, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  submitMyCalendarAvailability,
  type AvailabilityPeriod,
  type AvailabilityStatus,
} from "@/lib/actions/availability";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CalendarAvailabilityEntry = {
  date: string;
  period: AvailabilityPeriod;
  status: AvailabilityStatus;
  campusId: string | null;
};

export type AvailabilityCampus = {
  id: string;
  name: string;
};

const periodOptions: Array<{ value: AvailabilityPeriod; label: string }> = [
  { value: "all_day", label: "Dia inteiro" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
];

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function pad(value: number) {
  return String(value).padStart(2, "0");
}

function monthParts(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, monthIndex: month - 1 };
}

function dateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
}

function shiftMonth(monthKey: string, offset: number) {
  const { year, monthIndex } = monthParts(monthKey);
  const absolute = year * 12 + monthIndex + offset;
  const nextYear = Math.floor(absolute / 12);
  const nextMonth = ((absolute % 12) + 12) % 12;
  return `${nextYear}-${pad(nextMonth + 1)}`;
}

function statusLabel(status: AvailabilityStatus | null) {
  if (status === "available") return "Disponível";
  if (status === "unavailable") return "Não disponível";
  return "Sem resposta";
}

export function AvailabilityCalendar({
  churchSlug,
  churchId,
  ministryId,
  scopeLabel,
  initialMonth,
  entries,
  campuses,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string | null;
  scopeLabel: string;
  initialMonth: string;
  entries: CalendarAvailabilityEntry[];
  campuses: AvailabilityCampus[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [monthKey, setMonthKey] = useState(initialMonth.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<AvailabilityPeriod>("all_day");
  const [campusId, setCampusId] = useState<string | null>(null);
  const [editing, setEditing] = useState(() =>
    !entries.some((entry) =>
      entry.date.startsWith(initialMonth.slice(0, 7))
      && entry.period === "all_day"
      && entry.campusId === null
    )
  );

  const campusKey = campusId ?? "all";

  const initialEntryMap = useMemo(
    () =>
      new Map(
        entries.map((entry) => [
          `${entry.campusId ?? "all"}:${entry.date}:${entry.period}`,
          entry.status,
        ])
      ),
    [entries]
  );
  const [savedMap, setSavedMap] = useState(() => new Map(initialEntryMap));
  const [draftMap, setDraftMap] = useState(() => new Map(initialEntryMap));

  const { year, monthIndex } = monthParts(monthKey);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));

  const selectedStatus = selectedDate
    ? draftMap.get(`${campusKey}:${selectedDate}:${period}`) ?? null
    : null;

  const monthPrefix = `${monthKey}-`;
  const scopeEntries = (source: Map<string, AvailabilityStatus>) =>
    [...source.entries()]
      .filter(([key]) => {
        const [entryCampus, date, entryPeriod] = key.split(":");
        return entryCampus === campusKey && date.startsWith(monthPrefix) && entryPeriod === period;
      })
      .sort(([left], [right]) => left.localeCompare(right));

  const monthEntries = scopeEntries(draftMap);
  const monthDirty =
    JSON.stringify(monthEntries) !== JSON.stringify(scopeEntries(savedMap));
  const availableCount = monthEntries.filter(([, status]) => status === "available").length;
  const unavailableCount = monthEntries.filter(([, status]) => status === "unavailable").length;
  const submitted = !monthDirty && monthEntries.length > 0;

  function markDate(status: AvailabilityStatus) {
    if (!selectedDate) return;
    setDraftMap((current) => {
      const next = new Map(current);
      next.set(`${campusKey}:${selectedDate}:${period}`, status);
      return next;
    });
  }

  function clearDate() {
    if (!selectedDate) return;
    setDraftMap((current) => {
      const next = new Map(current);
      next.delete(`${campusKey}:${selectedDate}:${period}`);
      return next;
    });
  }

  function submitMonth() {
    startTransition(async () => {
      const result = await submitMyCalendarAvailability({
        churchSlug,
        churchId,
        ministryId,
        campusId,
        month: monthKey,
        period,
        entries: monthEntries.map(([key, status]) => ({
          date: key.split(":")[1],
          status,
        })),
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setSavedMap(new Map(draftMap));
      setSelectedDate(null);
      setEditing(false);
      toast.success("Disponibilidade do mês enviada");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {scopeLabel}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Meu calendário</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Marque sua disponibilidade dia a dia. As alterações só serão enviadas quando você confirmar o mês.
          </p>
        </div>
        {editing && <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs text-muted-foreground">
            Campus
            <select
              value={campusId ?? ""}
              onChange={(event) => setCampusId(event.target.value || null)}
              className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground"
            >
              <option value="">Todos os campus</option>
              {campuses.map((campus) => (
                <option key={campus.id} value={campus.id}>
                  {campus.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Período
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as AvailabilityPeriod)}
              className="h-10 rounded-xl border bg-background px-3 text-sm text-foreground"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>}
      </div>

      {submitted && !editing ? (
        <div className="flex flex-col gap-4 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-medium capitalize">Disponibilidade de {monthLabel} enviada</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {availableCount} {availableCount === 1 ? "dia disponível" : "dias disponíveis"}
                {" · "}
                {unavailableCount} {unavailableCount === 1 ? "dia indisponível" : "dias indisponíveis"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">A liderança já pode consultar o resultado.</p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setEditing(true)} className="h-10 rounded-full px-4">
            <Pencil className="size-3.5" /> Editar
          </Button>
        </div>
      ) : <>
      <Card className="rounded-3xl">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMonthKey((current) => shiftMonth(current, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <CardTitle className="capitalize text-base">{monthLabel}</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setMonthKey((current) => shiftMonth(current, 1))}
            aria-label="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
            {weekdayLabels.map((label) => (
              <span key={label} className="py-1">{label}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, index) => (
              <span key={`empty-${index}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, index) => {
              const day = index + 1;
              const key = dateKey(year, monthIndex, day);
              const status = draftMap.get(`${campusKey}:${key}:${period}`) ?? null;
              const selected = selectedDate === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDate(key)}
                  className={cn(
                    "relative flex aspect-square min-h-10 items-center justify-center rounded-xl border text-sm transition",
                    selected ? "border-foreground ring-1 ring-foreground" : "border-transparent hover:bg-muted",
                    status === "available" && "bg-emerald-500/15",
                    status === "unavailable" && "bg-rose-500/15"
                  )}
                  aria-label={`${day} de ${monthLabel}: ${statusLabel(status)}`}
                >
                  {day}
                  {status && (
                    <span
                      className={cn(
                        "absolute bottom-1 size-1.5 rounded-full",
                        status === "available" ? "bg-emerald-500" : "bg-rose-500"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {selectedDate ? (
            <div className="rounded-2xl border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    {selectedDate.split("-").reverse().join("/")} · {periodOptions.find((item) => item.value === period)?.label}
                  </p>
                  <p className="text-xs text-muted-foreground">Atual: {statusLabel(selectedStatus)}</p>
                </div>
                {selectedStatus && (
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={clearDate}>
                    <RotateCcw className="size-3.5" /> Limpar
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => markDate("available")}
                  className={cn(
                    "h-11 rounded-xl",
                    selectedStatus === "available" && "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600"
                  )}
                >
                  <Check className="size-4" /> Disponível
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => markDate("unavailable")}
                  className={cn(
                    "h-11 rounded-xl",
                    selectedStatus === "unavailable" && "border-rose-600 bg-rose-600 text-white hover:bg-rose-600"
                  )}
                >
                  <X className="size-4" /> Não disponível
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">Toque em uma data para informar sua disponibilidade.</p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-3xl border p-4">
        {submitted ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3" role="status">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-sm font-medium">Disponibilidade de {monthLabel} enviada</p>
                <p className="text-xs text-muted-foreground">
                  {availableCount} {availableCount === 1 ? "dia disponível" : "dias disponíveis"}
                  {" · "}
                  {unavailableCount} {unavailableCount === 1 ? "dia indisponível" : "dias indisponíveis"}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} className="h-10 rounded-full px-4">
              Concluir
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                {monthDirty ? "Alterações ainda não enviadas" : "Marque os dias do mês"}
              </p>
              <p className="text-xs text-muted-foreground">
                {monthDirty
                  ? `${availableCount} ${availableCount === 1 ? "dia disponível" : "dias disponíveis"} · ${unavailableCount} ${unavailableCount === 1 ? "dia indisponível" : "dias indisponíveis"}`
                  : "Depois, confirme para enviar à liderança."}
              </p>
            </div>
            <Button
              type="button"
              disabled={pending || !monthDirty}
              onClick={submitMonth}
              className="h-11 w-full rounded-full px-5 sm:w-auto"
            >
              <Send className="size-4" />
              {pending ? "Enviando…" : "Confirmar disponibilidade do mês"}
            </Button>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}
