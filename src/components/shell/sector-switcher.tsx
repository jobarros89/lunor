"use client";

import { Select } from "@/components/ui/select";

import { useTransition } from "react";
import { Layers } from "lucide-react";
import { setActiveMinistry } from "@/lib/actions/ministry";

type Option = { id: string; name: string };

/** Seletor de setor (ministério) no topo do app. Só aparece com 2+ setores. */
export function SectorSwitcher({
  churchSlug,
  activeId,
  options,
}: {
  churchSlug: string;
  activeId: string;
  options: Option[];
}) {
  const [pending, startTransition] = useTransition();
  if (options.length <= 1) return null;

  return (
    <label
      className="relative block min-w-0 max-w-36 text-sm data-[pending=true]:opacity-60 sm:max-w-56"
      data-pending={pending}
      title="Setor ativo"
    >
      <Layers
        className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Select
        value={activeId}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => setActiveMinistry(e.target.value, churchSlug))
        }
        className="w-full cursor-pointer truncate pl-9 font-medium"
        aria-label="Trocar de setor"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
