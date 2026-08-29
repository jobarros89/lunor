"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionChildRow, type SessionChild } from "@/components/infantil/session-child";

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

export function ReceptionSearch({
  sessionChildren,
  churchSlug,
  churchId,
  ministryId,
  eventId,
  eventTitle,
  eventContext,
  podeLiberar,
}: {
  sessionChildren: SessionChild[];
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
  eventTitle: string;
  eventContext: string;
  podeLiberar: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => sessionChildren.filter((child) => matches(child, query)),
    [sessionChildren, query]
  );

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar criança, responsável ou telefone"
            autoComplete="off"
            inputMode="search"
            className="h-14 rounded-2xl pl-12 text-base"
            aria-label="Buscar criança, responsável ou telefone"
          />
        </div>
        <p className="mt-2 px-1 text-xs text-muted-foreground">
          {query.trim()
            ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`
            : "Digite o nome da criança, responsável ou telefone. Irmãos aparecem juntos quando compartilham o mesmo responsável."}
        </p>
      </div>

      {byClass.map(([className, items]) => {
        const presentes = items.filter((item) => item.checkin && !item.checkin.checkedOut).length;
        return (
          <Card key={className} className="rounded-3xl">
            <CardHeader>
              <CardTitle className="text-base">{className}</CardTitle>
              <CardDescription>
                {presentes} presentes · {items.length} {items.length === 1 ? "criança" : "crianças"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((child) => (
                <SessionChildRow
                  key={child.id}
                  child={child}
                  churchSlug={churchSlug}
                  churchId={churchId}
                  ministryId={ministryId}
                  eventId={eventId}
                  eventTitle={eventTitle}
                  eventContext={eventContext}
                  podeLiberar={podeLiberar}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {filtered.length === 0 && (
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
