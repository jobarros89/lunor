"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, ShieldCheck, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addChildGuardian,
  removeChildGuardian,
  setPrimaryChildGuardian,
  updateChildGuardian,
} from "@/lib/actions/kids-guardians";

type GuardianLink = {
  id: string;
  fullName: string;
  phone: string | null;
  relationship: string | null;
  canPickup: boolean;
  isPrimary: boolean;
  hasAccount: boolean;
};

type GuardianOption = {
  id: string;
  fullName: string;
  phone: string | null;
  hasAccount: boolean;
};

type Props = {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  childId: string;
  guardians: GuardianLink[];
  availableGuardians: GuardianOption[];
};

export function ChildGuardianManager({
  churchSlug,
  churchId,
  ministryId,
  childId,
  guardians,
  availableGuardians,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(
    availableGuardians.length > 0 ? "existing" : "new"
  );
  const [existingId, setExistingId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [newCanPickup, setNewCanPickup] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRelationship, setEditRelationship] = useState("");
  const [editCanPickup, setEditCanPickup] = useState(true);

  const linkedIds = useMemo(() => new Set(guardians.map((guardian) => guardian.id)), [guardians]);
  const options = availableGuardians.filter((guardian) => !linkedIds.has(guardian.id));

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    after?: () => void
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível concluir");
        return;
      }
      toast.success(success);
      after?.();
      router.refresh();
    });
  }

  function resetAdd() {
    setAdding(false);
    setExistingId("");
    setNewName("");
    setNewEmail("");
    setNewPhone("");
    setNewRelationship("");
    setNewCanPickup(true);
  }

  function addGuardian() {
    if (mode === "existing" && !existingId) {
      toast.error("Escolha um responsável");
      return;
    }
    if (mode === "new" && newName.trim().length < 2) {
      toast.error("Informe o nome do responsável");
      return;
    }
    if (mode === "new" && !/^\S+@\S+\.\S+$/.test(newEmail.trim())) {
      toast.error("Informe um e-mail válido para o responsável");
      return;
    }
    if (newRelationship.trim().length < 2) {
      toast.error("Informe o parentesco ou vínculo");
      return;
    }

    run(
      () =>
        addChildGuardian({
          churchSlug,
          churchId,
          ministryId,
          childId,
          guardianId: mode === "existing" ? existingId : null,
          fullName: mode === "new" ? newName : "",
          email: mode === "new" ? newEmail : "",
          phone: mode === "new" ? newPhone : "",
          relationship: newRelationship,
          canPickup: newCanPickup,
        }),
      "Responsável vinculado",
      resetAdd
    );
  }

  function startEdit(guardian: GuardianLink) {
    setEditingId(guardian.id);
    setEditRelationship(guardian.relationship ?? "");
    setEditCanPickup(guardian.canPickup);
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base">Responsáveis e retirada</CardTitle>
          <CardDescription className="mt-1">
            {guardians.length} responsável(is) vinculado(s). A criança mantém um único cadastro.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant={adding ? "outline" : "default"}
          className="rounded-full"
          disabled={pending}
          onClick={() => (adding ? resetAdd() : setAdding(true))}
        >
          {adding ? <X className="size-4" /> : <Plus className="size-4" />}
          {adding ? "Cancelar" : "Adicionar responsável"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {adding && (
          <div className="space-y-4 rounded-2xl border border-dashed p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={mode === "existing" ? "secondary" : "ghost"}
                disabled={pending || options.length === 0}
                onClick={() => setMode("existing")}
              >
                Já cadastrado
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "new" ? "secondary" : "ghost"}
                disabled={pending}
                onClick={() => setMode("new")}
              >
                Novo responsável
              </Button>
            </div>

            {mode === "existing" ? (
              options.length > 0 ? (
                <select
                  value={existingId}
                  onChange={(event) => setExistingId(event.target.value)}
                  disabled={pending}
                  className="h-11 w-full rounded-xl border bg-background px-3 text-base md:text-sm"
                  aria-label="Responsável já cadastrado"
                >
                  <option value="">Escolha uma pessoa…</option>
                  {options.map((guardian) => (
                    <option key={guardian.id} value={guardian.id}>
                      {guardian.fullName}{guardian.phone ? ` · ${guardian.phone}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Todos os responsáveis já cadastrados estão vinculados. Cadastre uma nova pessoa.
                </p>
              )
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Nome do responsável"
                  className="h-11 rounded-xl"
                  disabled={pending}
                />
                <Input
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="E-mail do responsável"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-11 rounded-xl"
                  disabled={pending}
                />
                <Input
                  value={newPhone}
                  onChange={(event) => setNewPhone(event.target.value)}
                  placeholder="Telefone"
                  inputMode="tel"
                  className="h-11 rounded-xl sm:col-span-2"
                  disabled={pending}
                />
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <Input
                value={newRelationship}
                onChange={(event) => setNewRelationship(event.target.value)}
                placeholder="Parentesco ou vínculo (ex.: Avô)"
                className="h-11 rounded-xl"
                disabled={pending}
              />
              <label className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={newCanPickup}
                  onChange={(event) => setNewCanPickup(event.target.checked)}
                  disabled={pending}
                  className="size-4"
                />
                Pode retirar
              </label>
            </div>

            <div className="flex justify-end">
              <Button type="button" className="rounded-full" disabled={pending} onClick={addGuardian}>
                <ShieldCheck className="size-4" />
                {pending ? "Salvando…" : "Vincular responsável"}
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {guardians.map((guardian) => {
            const editing = editingId === guardian.id;
            return (
              <div key={guardian.id} className="rounded-2xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{guardian.fullName}</p>
                      {guardian.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium">
                          <Star className="size-3" /> Principal
                        </span>
                      )}
                      {guardian.hasAccount && (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs">Conta LUNOR</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {guardian.relationship || "Parentesco não informado"}
                      {guardian.phone ? ` · ${guardian.phone}` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span
                        className={`rounded-full px-2 py-1 font-medium ${
                          guardian.canPickup
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {guardian.canPickup ? "Autorizado a retirar" : "Sem autorização de retirada"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!guardian.isPrimary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              setPrimaryChildGuardian({
                                churchSlug,
                                churchId,
                                ministryId,
                                childId,
                                guardianId: guardian.id,
                              }),
                            `${guardian.fullName} agora é o responsável principal`
                          )
                        }
                      >
                        <Star className="size-3.5" /> Principal
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => (editing ? setEditingId(null) : startEdit(guardian))}
                    >
                      <Pencil className="size-3.5" /> Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Remover o vínculo de ${guardian.fullName} com esta criança?`)) return;
                        run(
                          () =>
                            removeChildGuardian({
                              churchSlug,
                              churchId,
                              ministryId,
                              childId,
                              guardianId: guardian.id,
                            }),
                          "Vínculo removido"
                        );
                      }}
                    >
                      <Trash2 className="size-3.5" /> Remover
                    </Button>
                  </div>
                </div>

                {editing && (
                  <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <Input
                      value={editRelationship}
                      onChange={(event) => setEditRelationship(event.target.value)}
                      placeholder="Parentesco ou vínculo"
                      className="h-10 rounded-xl"
                      disabled={pending}
                    />
                    <label className="flex min-h-10 items-center gap-2 rounded-xl border px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={editCanPickup}
                        onChange={(event) => setEditCanPickup(event.target.checked)}
                        disabled={pending}
                        className="size-4"
                      />
                      Pode retirar
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              updateChildGuardian({
                                churchSlug,
                                churchId,
                                ministryId,
                                childId,
                                guardianId: guardian.id,
                                relationship: editRelationship,
                                canPickup: editCanPickup,
                              }),
                            "Responsável atualizado",
                            () => setEditingId(null)
                          )
                        }
                      >
                        <Check className="size-3.5" /> Salvar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
          <strong className="text-foreground">Segurança na retirada:</strong> somente pessoas marcadas como
          “Pode retirar” são liberadas normalmente. Qualquer exceção continua exigindo liderança e justificativa,
          e a retirada registra quem buscou a criança.
        </div>
      </CardContent>
    </Card>
  );
}
