"use client";

import { Checkbox } from "@/components/ui/checkbox";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSection } from "@/components/ui/form-section";
import { createChild } from "@/lib/actions/infantil";

export function ChildForm({
  churchSlug,
  churchId,
  ministryId,
}: {
  churchSlug: string;
  churchId: string;
  ministryId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [consent, setConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);

  function onSubmit(fd: FormData) {
    startTransition(async () => {
      const r = await createChild({
        churchSlug,
        churchId,
        ministryId,
        fullName: String(fd.get("fullName") ?? ""),
        birthDate: String(fd.get("birthDate") ?? ""),
        allergies: String(fd.get("allergies") ?? ""),
        healthNotes: String(fd.get("healthNotes") ?? ""),
        specialNeeds: String(fd.get("specialNeeds") ?? ""),
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
    <form action={onSubmit} aria-busy={pending} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Preencha os dados obrigatórios da criança e do responsável. Informações
        de cuidado ajudam a equipe na recepção.
      </p>
      <FormSection title="A criança">
        <div className="space-y-2">
          <Label htmlFor="fullName">
            Nome completo{" "}
            <span className="text-muted-foreground">(obrigatório)</span>
          </Label>
          <Input id="fullName" name="fullName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthDate">
            Data de nascimento{" "}
            <span className="text-muted-foreground">(obrigatório)</span>
          </Label>
          <Input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            aria-describedby="birthDate-help"
          />
          <p id="birthDate-help" className="text-xs text-muted-foreground">
            Define a turma sugerida.
          </p>
        </div>
      </FormSection>

      <FormSection title="Cuidado e emergência">
        <div className="space-y-2">
          <Label htmlFor="allergies">Alergias / restrições alimentares</Label>
          <Input
            id="allergies"
            name="allergies"
            placeholder="Ex.: amendoim, leite"
          />
          <p className="text-xs text-muted-foreground">
            Aparece em destaque na sessão, para o voluntário ver antes do
            lanche.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="healthNotes">Condição de saúde / medicação</Label>
          <Input id="healthNotes" name="healthNotes" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="specialNeeds">Necessidades especiais</Label>
          <Input id="specialNeeds" name="specialNeeds" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="emergencyPhone">Telefone de emergência</Label>
          <Input
            id="emergencyPhone"
            name="emergencyPhone"
            type="tel"
            autoComplete="tel"
          />
        </div>
      </FormSection>

      <FormSection title="Responsável autorizado a retirar">
        <div className="space-y-2">
          <Label htmlFor="guardianName">
            Nome <span className="text-muted-foreground">(obrigatório)</span>
          </Label>
          <Input id="guardianName" name="guardianName" required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="guardianRelationship">Parentesco</Label>
            <Input
              id="guardianRelationship"
              name="guardianRelationship"
              placeholder="mãe, pai, avó…"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="guardianPhone">Telefone</Label>
            <Input
              id="guardianPhone"
              name="guardianPhone"
              type="tel"
              autoComplete="tel"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Outros responsáveis podem ser adicionados depois, na ficha da criança.
        </p>
      </FormSection>

      <FormSection title="Consentimentos">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
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
          <Checkbox
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
      </FormSection>

      <Button
        type="submit"
        disabled={pending || !consent}
        className="h-12 w-full text-base"
      >
        {pending ? "Salvando…" : "Cadastrar criança"}
      </Button>
    </form>
  );
}
