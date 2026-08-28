"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MapPin, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCampus, setCampusActive } from "@/lib/actions/campuses";

type Campus = {
  id: string;
  name: string;
  active: boolean;
};

export function CampusesManager({
  churchSlug,
  churchId,
  campuses,
}: {
  churchSlug: string;
  churchId: string;
  campuses: Campus[];
}) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function add() {
    const trimmed = name.trim();
    if (trimmed.length < 2) return toast.error("Informe o nome do campus");
    startTransition(async () => {
      const result = await createCampus({ churchSlug, churchId, name: trimmed });
      if (!result.ok) return toast.error(result.error);
      setName("");
      toast.success("Campus criado");
    });
  }

  function toggle(campus: Campus) {
    startTransition(async () => {
      const result = await setCampusActive({
        churchSlug,
        churchId,
        campusId: campus.id,
        active: !campus.active,
      });
      if (!result.ok) return toast.error(result.error);
      toast.success(campus.active ? "Campus desativado" : "Campus reativado");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          disabled={pending}
          placeholder="Ex.: Botafogo"
          className="h-11 rounded-xl"
        />
        <Button
          type="button"
          onClick={add}
          disabled={pending || name.trim().length < 2}
          className="h-11 rounded-full px-5"
        >
          <MapPin className="size-4" />
          Adicionar campus
        </Button>
      </div>

      <div className="space-y-2">
        {campuses.map((campus) => (
          <div
            key={campus.id}
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{campus.name}</p>
              <p className="text-xs text-muted-foreground">
                {campus.active ? "Ativo" : "Inativo"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => toggle(campus)}
              className="rounded-full"
            >
              <Power className="size-4" />
              {campus.active ? "Desativar" : "Reativar"}
            </Button>
          </div>
        ))}
        {campuses.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum campus cadastrado. Adicione o primeiro acima.
          </p>
        )}
      </div>
    </div>
  );
}
