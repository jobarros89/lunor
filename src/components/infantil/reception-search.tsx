"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionChildRow, type SessionChild } from "@/components/infantil/session-child";
import type { KidsPrintSettings } from "@/lib/kids-print-settings";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function matches(child: SessionChild, query: string) {
  const term = normalizeText(query.trim());
  const termDigits = digitsOnly(query);
  if (!term) return true;

  const text = normalizeText(
    [
      child.fullName,
      child.className ?? "",
      ...child.guardians.map((guardian) => guardian.name),
    ].join(" ")
  );
  if (text.includes(term)) return true;

  if (termDigits.length >= 3) {
    return child.guardians.some((guardian) =>
      digitsOnly(guardian.phone ?? "").includes(termDigits)
    );
  }

  return false;
}

function childStatus(child: SessionChild) {
  if (!child.checkin) return "Aguardando check-in";
  if (child.checkin.checkedOut) return "Retirado · pode entrar novamente";
  return `Presente · ${child.checkin.code}`;
}

export function ReceptionSearch({
  sessionChildren,
  churchName,
  churchSlug,
  churchId,
  ministryId,
  sessionId,
  eventId,
  eventTitle,
  eventContext,
  podeLiberar,
  printSettings,
}: {
  sessionChildren: SessionChild[];
  churchName: string;
  churchSlug: string;
  churchId: string;
  ministryId: string;
  sessionId?: string | null;
  eventId?: string | null;
  eventTitle: string;
  eventContext: string;
  podeLiberar: boolean;
  printSettings: KidsPrintSettings;
}) {
  const [query, setQuery] = useState("");
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const filtered = useMemo(
    () => sessionChildren.filter((child) => matches(child, query)),
    [sessionChildren, query]
  );

  const searching = query.trim().length > 0;

  const selectedChild = useMemo(() => {
    const explicit = filtered.find((child) => child.id === selectedChildId) ?? null;
    if (explicit) return explicit;
    if (searching && filtered.length === 1) return filtered[0];
    return null;
  }, [filtered, searching, selectedChildId]);

  const byClass = useMemo(() => {
    const groups = new Map<string, SessionChild[]>();
    for (const child of filtered) {
      const key = child.className ?? "Sem turma";
      groups.set(key, [...(groups.get(key) ?? []), child]);
    }
    return [...groups.entries()];
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10 rounded-3xl border bg-background/95 p-3 shadow-sm backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedChildId(null);
            }}
            placeholder="Buscar criança, responsável ou telefone"
            autoComplete="off"
            inputMode="search"
            className="h-14 rounded-2xl pl-12 text-base"
            aria-label="Buscar criança, responsável ou telefone"
          />
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {searching
            ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}${filtered.length > 1 ? " · toque para selecionar" : ""}`
            : "Digite o nome da criança, responsável ou telefone. Irmãos aparecem juntos quando compartilham o mesmo responsável."}
        </p>
      </div>

      {searching && filtered.length > 1 && (
        <Card className="rounded-3xl">
          <CardContent className="space-y-2 py-3">
            {filtered.map((child) => {
              const selected = child.id === selectedChildId;
              return (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  aria-pressed={selected}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
                    selected
                      ? "border-foreground/30 bg-accent"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{child.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[child.age, child.className, childStatus(child)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}

      {searching && selectedChild && (
        <div className="space-y-2">
          <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Criança encontrada
          </p>
          <SessionChildRow
            child={selectedChild}
            churchName={churchName}
            churchSlug={churchSlug}
            churchId={churchId}
            ministryId={ministryId}
            sessionId={sessionId}
            eventId={eventId}
            eventTitle={eventTitle}
            eventContext={eventContext}
            podeLiberar={podeLiberar}
            printSettings={printSettings}
          />
        </div>
      )}

      {!searching &&
        byClass.map(([className, items]) => {
          const presentes = items.filter(
            (item) => item.checkin && !item.checkin.checkedOut
          ).length;
          return (
            <Card key={className} className="rounded-3xl">
              <CardHeader>
                <CardTitle className="text-base">{className}</CardTitle>
                <CardDescription>
                  {presentes} presentes · {items.length}{" "}
                  {items.length === 1 ? "criança" : "crianças"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((child) => (
                  <SessionChildRow
                    key={child.id}
                    child={child}
                    churchName={churchName}
                    churchSlug={churchSlug}
                    churchId={churchId}
                    ministryId={ministryId}
                    sessionId={sessionId}
                    eventId={eventId}
                    eventTitle={eventTitle}
                    eventContext={eventContext}
                    podeLiberar={podeLiberar}
                    printSettings={printSettings}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })}

      {searching && filtered.length === 0 && (
        <Card className="rounded-3xl">
          <CardContent className="py-8 text-center">
            <p className="font-medium">Nenhum cadastro encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tente outro nome ou alguns números do telefone.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
