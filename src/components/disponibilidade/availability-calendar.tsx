"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import {
  clearMyCalendarAvailability,
  clearMyRecurringAvailability,
  setMyCalendarAvailability,
  setMyRecurringAvailability,
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
};

export type RecurringAvailabilityEntry = {
  weekday: number;
  period: AvailabilityPeriod;
  status: AvailabilityStatus;
};

const periodOptions: Array<{ value: AvailabilityPeriod; label: string }> = [
  { value: "all_day", label: "Dia inteiro" },
  { value: "morning", label: "Manhã" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noite" },
];

const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const weekdayLongLabels = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

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
  recurring,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string | null;
  scopeLabel: string;
  initialMonth: string;
  entries: CalendarAvailabilityEntry[];
  recurring: RecurringAvailabilityEntry[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [monthKey, setMonthKey] = useState(initialMonth.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<AvailabilityPeriod>("all_day");

  const entryMap = useMemo(
    () => new Map(entries.map((entry) => [`${entry.date}:${entry.period}`, entry.status])),
    [entries]
  );
  const recurringMap = useMemo(
    () => new Map(recurring.map((entry) => [`${entry.weekday}:${entry.period}`, entry.status])),
    [recurring]
  );

  const { year, monthIndex } = monthParts(monthKey);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));

  const selectedStatus = selectedDate
    ? entryMap.get(`${selectedDate}:${period}`) ?? null
    : null;

  function saveDate(status: AvailabilityStatus) {
    if (!selectedDate) return;
    startTransition(async () => {
      const result = await setMyCalendarAvailability({
        churchSlug,
        churchId,
        ministryId,
        date: selectedDate,
        period,
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Disponibilidade salva");
      router.refresh();
    });
  }

  function clearDate() {
    if (!selectedDate) return;
    startTransition(async () => {
      const result = await clearMyCalendarAvailability({
        churchSlug,
        churchId,
        ministryId,
        date: selectedDate,
        period,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function saveRecurring(weekday: number, status: AvailabilityStatus) {
    startTransition(async () => {
      const result = await setMyRecurringAvailability({
        churchSlug,
        churchId,
        ministryId,
        weekday,
        period,
        status,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Padrão semanal salvo");
      router.refresh();
    });
  }

  function clearRecurring(weekday: number) {
    startTransition(async () => {
      const result = await clearMyRecurringAvailability({
        churchSlug,
        churchId,
        ministryId,
        weekday,
        period,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
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
            Marque quando pode ou não pode servir, mesmo que o culto ainda não tenha sido criado.
          </p>
        </div>
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
      </div>

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
              const status = entryMap.get(`${key}:${period}`) ?? null;
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
                  onClick={() => saveDate("available")}
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
                  onClick={() => saveDate("unavailable")}
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

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="text-base">Padrão semanal</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use como base recorrente. Uma marcação específica no calendário pode substituir este padrão.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {weekdayLongLabels.map((label, weekday) => {
            const status = recurringMap.get(`${weekday}:${period}`) ?? null;
            return (
              <div key={label} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3">
                <div className="min-w-[110px]">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel(status)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => saveRecurring(weekday, "available")}
                    className={cn(status === "available" && "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600")}
                    aria-label={`${label}: disponível`}
                  >
                    <Check className="size-3.5" />
                    <span className="hidden sm:inline">Disponível</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => saveRecurring(weekday, "unavailable")}
                    className={cn(status === "unavailable" && "border-rose-600 bg-rose-600 text-white hover:bg-rose-600")}
                    aria-label={`${label}: não disponível`}
                  >
                    <X className="size-3.5" />
                    <span className="hidden sm:inline">Não disponível</span>
                  </Button>
                  {status && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => clearRecurring(weekday)}
                      aria-label={`${label}: limpar padrão`}
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
