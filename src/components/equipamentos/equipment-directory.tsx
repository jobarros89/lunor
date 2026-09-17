"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { FilterBar } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";

export type EquipmentListItem = {
  id: string;
  name: string;
  details: string;
  owner: string;
  status: string;
  statusLabel: string;
  statusClassName: string;
  photoUrl: string | null;
  valueLabel: string | null;
};

export function EquipmentDirectory({
  churchSlug,
  items,
}: {
  churchSlug: string;
  items: EquipmentListItem[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  const term = normalize(query.trim());
  const filtered = items.filter(
    (item) =>
      (!status || item.status === status) &&
      normalize(`${item.name} ${item.details}`).includes(term),
  );
  const statuses = [
    ...new Map(items.map((item) => [item.status, item.statusLabel])).entries(),
  ];
  return (
    <div className="space-y-4">
      <FilterBar result={`${filtered.length} de ${items.length} equipamentos`}>
        <SearchInput
          label="Buscar equipamento, marca ou modelo"
          placeholder="Buscar equipamento, marca ou modelo…"
          value={query}
          onValueChange={setQuery}
        />
        <Select
          aria-label="Filtrar por situação"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="sm:w-52"
        >
          <option value="">Todas as situações</option>
          {statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </FilterBar>
      {filtered.length > 0 && (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={`/${churchSlug}/equipamentos/${item.id}`}
                className="grid grid-cols-[3rem_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-muted/60 focus-visible:-outline-offset-2 sm:grid-cols-[3rem_minmax(0,1fr)_auto_1rem]"
              >
                <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-muted">
                  {item.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed storage URL already resolved on the server
                    <img
                      src={item.photoUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <Wrench
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="break-words font-medium">{item.name}</p>
                  <p className="mt-0.5 break-words text-sm text-muted-foreground">
                    {item.details || "Marca e modelo não informados"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.owner}
                  </p>
                </div>
                <ChevronRight
                  className="col-start-3 row-start-1 size-4 text-muted-foreground sm:col-start-4"
                  aria-hidden="true"
                />
                <div className="col-span-2 col-start-2 flex flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:justify-end">
                  <Badge className={item.statusClassName}>
                    {item.statusLabel}
                  </Badge>
                  {item.valueLabel && (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {item.valueLabel}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {filtered.length === 0 && (
        <EmptyState
          icon={<Wrench className="size-5" />}
          title="Nenhum equipamento encontrado"
          description="Tente outro nome ou remova os filtros para ver todos os equipamentos."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      )}
    </div>
  );
}
