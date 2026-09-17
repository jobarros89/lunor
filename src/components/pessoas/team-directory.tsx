"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";

export type DirectoryMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  profession: string | null;
  skillCount: number;
  churchRole: string | null;
  roles: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function TeamDirectory({
  churchSlug,
  members,
}: {
  churchSlug: string;
  members: DirectoryMember[];
}) {
  const [query, setQuery] = useState("");
  const term = normalize(query.trim());
  const filtered = members.filter((member) =>
    normalize(`${member.name} ${member.profession ?? ""}`).includes(term),
  );
  return (
    <div className="space-y-4">
      <FilterBar result={`${filtered.length} de ${members.length} pessoas`}>
        <SearchInput
          label="Buscar pessoa ou profissão"
          placeholder="Buscar pessoa ou profissão…"
          value={query}
          onValueChange={setQuery}
        />
      </FilterBar>
      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {filtered.map((member) => (
            <li key={member.id}>
              <Link
                href={`/${churchSlug}/pessoas/${member.id}`}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-muted/60 focus-visible:-outline-offset-2 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_1rem]"
              >
                <Avatar className="size-10">
                  <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback>
                    {member.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="break-words font-medium">{member.name}</p>
                  <p className="mt-0.5 break-words text-sm text-muted-foreground">
                    {member.profession || "Profissão não informada"}
                    {member.skillCount > 0 &&
                      ` · ${member.skillCount} aptidões`}
                  </p>
                </div>
                <ChevronRight
                  className="col-start-3 row-start-1 size-4 text-muted-foreground sm:col-start-4"
                  aria-hidden="true"
                />
                <div className="col-span-2 col-start-2 flex flex-wrap gap-1.5 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:max-w-xs sm:justify-end">
                  {member.churchRole && (
                    <Badge variant="outline">{member.churchRole}</Badge>
                  )}
                  {member.roles.map((role) => (
                    <Badge key={role} variant="secondary">
                      {role}
                    </Badge>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {filtered.length === 0 && (
        <EmptyState
          icon={<Users className="size-5" />}
          title={
            query ? "Nenhuma pessoa encontrada" : "Sua equipe aparecerá aqui"
          }
          description={
            query
              ? "Tente parte do nome ou outra profissão."
              : "As pessoas que concluírem o cadastro na igreja aparecerão nesta lista."
          }
          action={
            query ? (
              <Button variant="outline" onClick={() => setQuery("")}>
                Ver toda a equipe
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
