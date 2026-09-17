"use client";

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
      className="flex min-w-0 max-w-[7rem] items-center gap-1.5 rounded-full border bg-background px-2 py-1.5 text-sm data-[pending=true]:opacity-60 sm:max-w-none sm:px-3"
      data-pending={pending}
      title="Setor ativo"
    >
      <Layers className="size-4 shrink-0 text-muted-foreground" />
      <select
        value={activeId}
        disabled={pending}
        onChange={(e) =>
          startTransition(() => setActiveMinistry(e.target.value, churchSlug))
        }
        className="lunor-control w-full min-w-0 max-w-[4.75rem] cursor-pointer truncate bg-transparent font-medium outline-none sm:max-w-[9rem]"
        aria-label="Trocar de setor"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
