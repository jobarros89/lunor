"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChild } from "@/lib/actions/infantil";

export function ChildForm({
  churchSlug,
  churchId,
  ministryId,
  eventId,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
  eventId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [consent, setConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);

  const campo = "h-12 rounded-2xl";

  function onSubmit(fd: FormData) {
    startTransition(async () => {
      const r = await createChild({
        churchSlug,
        churchId,
        ministryId,
        eventId,
        fullName: String(fd.get("fullName") ?? ""),
        birthDate: String(fd.get("birthDate") ?? ""),
        allergies: String(fd.get("allergies") ?? ""),
        healthNotes: String(fd.get("healthNotes") ?? ""),
        specialNeeds: String(fd.get("specialNeeds") ?? ""),
        emergencyName: String(fd.get("emergencyName") ?? ""),
        emergencyPhone: String(fd.get("emergencyPhone") ?? ""),
        guardianName: String(fd.get("guardianName") ?? ""),
        guardianPhone: String(fd.get("guardianPhone") ?? ""),
        guardianRelationship: String(fd.get("guardianRelationship") ?? ""),
        photoConsent,
        consent,
      });
      if (r.ok) {
        toast.success("Criança cadastrada");
        router.push(`/${churchSlug}/infantil`);
      } else {
        toast.error(r.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">A criança</h2>
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" required className={campo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">Data de nascimento</Label>
          <Input id="birthDate" name="birthDate" type="date" required className={campo} />
          <p className="text-xs text-muted-foreground">Define a turma sugerida.</p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Cuidado e emergência
        </h2>
        <div className="space-y-2">
          <Label htmlFor="allergies">Alergias / restrições alimentares</Label>
          <Input
            id="allergies"
            name="allergies"
            placeholder="Ex.: amendoim, leite"
            className={campo}
          />
          <p className="text-xs text-muted-foreground">
            Aparece em destaque na sessão, para o voluntário ver antes do lanche.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="healthNotes">Condição de saúde / medicação</Label>
          <Input id="healthNotes" name="healthNotes" className={campo} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialNeeds">Necessidades especiais</Label>
          <Input id="specialNeeds" name="specialNeeds" className={campo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="emergencyName">Contato de emergência</Label>
            <Input id="emergencyName" name="emergencyName" className={campo} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergencyPhone">Telefone</Label>
            <Input id="emergencyPhone" name="emergencyPhone" className={campo} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Responsável (autorizado a retirar)
        </h2>
        <div className="space-y-2">
          <Label htmlFor="guardianName">Nome</Label>
          <Input id="guardianName" name="guardianName" required className={campo} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="guardianRelationship">Parentesco</Label>
            <Input
              id="guardianRelationship"
              name="guardianRelationship"
              placeholder="mãe, pai, avó…"
              className={campo}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianPhone">Telefone</Label>
            <Input id="guardianPhone" name="guardianPhone" className={campo} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Outros responsáveis podem ser adicionados depois, na ficha da criança.
        </p>
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-sm font-medium">Consentimentos</h2>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded"
          />
          <span>
            O responsável autoriza o cadastro dos dados da criança para fins de
            cuidado e segurança no ministério infantil.{" "}
            <strong>Obrigatório.</strong>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={photoConsent}
            onChange={(e) => setPhotoConsent(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 rounded"
          />
          <span>
            Autoriza o uso de imagem (fotos/vídeos) da criança.{" "}
            <span className="text-muted-foreground">
              Opcional — sem isso, a igreja não deve publicar fotos dela.
            </span>
          </span>
        </label>
      </section>

      <Button
        type="submit"
        disabled={pending || !consent}
        className="h-12 w-full rounded-full text-base"
      >
        {pending ? "Salvando…" : "Cadastrar criança"}
      </Button>
    </form>
  );
}

