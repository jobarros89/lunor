"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import {
  createDepartment,
  deleteDepartment,
} from "@/lib/actions/departamentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Ministry = { id: string; name: string };
type Department = { id: string; name: string; ministry_id: string | null };

export function DepartmentsManager({
  churchSlug,
  churchId,
  departments,
  ministries,
}: {
  churchSlug: string;
  churchId: string;
  departments: Department[];
  ministries: Ministry[];
}) {
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function add(formData: FormData) {
    startTransition(async () => {
      const result = await createDepartment({
        churchSlug,
        churchId,
        ministryId: formData.get("ministryId"),
        name: formData.get("name"),
      });
      if (result && !result.ok) toast.error(result.error);
      else {
        toast.success("Opção adicionada");
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  }

  function remove(departmentId: string) {
    startTransition(async () => {
      const result = await deleteDepartment({ churchSlug, departmentId });
      if (result && !result.ok) toast.error(result.error);
    });
  }

  const ministryNameById = new Map(ministries.map((m) => [m.id, m.name]));

  return (
    <div className="space-y-4">
      {ministries.length > 0 ? (
        <form action={add} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            name="ministryId"
            required
            defaultValue=""
            className="h-11 rounded-xl border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Selecione o ministério
            </option>
            {ministries.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <Input
            ref={inputRef}
            name="name"
            placeholder="Ex.: Vocal, Banda, Berçário…"
            required
            className="h-11 rounded-xl"
          />
          <Button type="submit" disabled={pending} className="h-11 rounded-full px-5">
            Adicionar
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum ministério disponível para configurar.
        </p>
      )}

      <div className="space-y-2">
        {departments.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
          >
            <div>
              <p className="font-medium">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {d.ministry_id
                  ? ministryNameById.get(d.ministry_id) ?? "Ministério"
                  : "Opção antiga sem ministério"}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              disabled={pending}
              className="size-9 rounded-full text-muted-foreground"
              aria-label={`Remover ${d.name}`}
              onClick={() => remove(d.id)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
        {departments.length === 0 && ministries.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma opção criada. Esse campo é opcional e só aparece na escala quando o ministério tiver opções cadastradas em “Onde servir?”.
          </p>
        )}
      </div>
    </div>
  );
}
