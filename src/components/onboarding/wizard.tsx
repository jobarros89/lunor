"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeChurchOnboarding, completeMemberOnboarding } from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  mode: "owner" | "member";
  churchId: string;
  churchName: string;
  churchSlug: string;
  ministries: { id: string; name: string }[];
  skills: { slug: string; name: string }[];
};

const MODULES = [
  { id: "teams", name: "Escalas e equipe" },
  { id: "worship", name: "Louvor e repertório" },
  { id: "children", name: "Infantil" },
  { id: "equipment", name: "Equipamentos" },
] as const;

const DEPARTMENTS = [
  "Louvor",
  "Kids",
  "Conexão",
  "Mídia",
  "Recepção",
  "Lojinha",
  "The Table",
  "Logística",
  "Intercessão",
  "MC",
  "Pastor",
  "Membro",
] as const;

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={cn(
    "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    selected
      ? "border-[#6e5ce6] bg-[#6e5ce6] text-white"
      : "border-white/15 bg-[#0b0b0c] text-zinc-300 hover:border-[#6e5ce6]/70 hover:text-white"
  )}>{children}</button>;
}

function Progress({ step, total }: { step: number; total: number }) {
  return <div className="flex justify-center gap-1.5" aria-label={`Passo ${step + 1} de ${total}`}>
    {Array.from({ length: total }).map((_, i) => <span key={i} className={cn("h-1.5 rounded-full", i === step ? "w-6 bg-[#6e5ce6]" : "w-1.5 bg-white/15")} />)}
  </div>;
}

const cardClass = "rounded-3xl border-white/10 bg-[#111113] text-[#f4f3ef] shadow-none";
const inputClass = "h-12 rounded-full border-white/15 bg-[#0b0b0c] text-[#f4f3ef] placeholder:text-zinc-600 focus-visible:border-[#6e5ce6] focus-visible:ring-[#6e5ce6]/25";
const primaryButtonClass = "h-12 flex-1 rounded-full bg-[#6e5ce6] text-white hover:bg-[#5f4fd1]";
const secondaryButtonClass = "h-12 flex-1 rounded-full border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white";

export function OnboardingWizard(props: Props) {
  return props.mode === "owner" ? <OwnerWizard {...props} /> : <MemberWizard {...props} />;
}

function OwnerWizard({ churchId, churchName }: Props) {
  const [step, setStep] = useState(0);
  const [modules, setModules] = useState<string[]>(["teams", "worship"]);
  const [ministryName, setMinistryName] = useState("Louvor");
  const [pending, startTransition] = useTransition();
  const headingId = useId();
  const toggle = (id: string) => setModules((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  const finish = () => startTransition(async () => {
    const result = await completeChurchOnboarding({ churchId, modules, ministryName });
    if (result && !result.ok) toast.error(result.error);
  });

  return <div className="space-y-4">
    <Progress step={step} total={3} />
    <Card className={cardClass}>
      <CardHeader className="text-center">
        <CardTitle id={headingId}>{step === 0 ? "O que você quer organizar primeiro?" : step === 1 ? "Crie o primeiro ministério" : "Tudo pronto para começar"}</CardTitle>
        <CardDescription className="text-zinc-400">{step === 0 ? "Isso só personaliza a navegação. Você poderá usar os outros módulos depois." : step === 1 ? `Este será o primeiro time de ${churchName}.` : "Comece por uma destas ações e avance no seu ritmo."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === 0 && <div className="grid gap-3 sm:grid-cols-2">{MODULES.map((item) => <Chip key={item.id} selected={modules.includes(item.id)} onClick={() => toggle(item.id)}>{item.name}</Chip>)}</div>}
        {step === 1 && <div className="space-y-3">
          <Label htmlFor="ministryName">Nome do ministério</Label>
          <Input id="ministryName" value={ministryName} onChange={(e) => setMinistryName(e.target.value)} placeholder="Louvor, Mídia, Infantil…" className={inputClass} />
          <div className="flex flex-wrap gap-2">{["Louvor", "Mídia", "Infantil"].map((name) => <Chip key={name} selected={ministryName === name} onClick={() => setMinistryName(name)}>{name}</Chip>)}</div>
        </div>}
        {step === 2 && <ul className="space-y-3 text-sm">
          {["Convidar a equipe", "Criar o primeiro culto", "Montar a primeira escala", "Cadastrar a primeira música"].map((item) => <li key={item} className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0b0c] px-4 text-zinc-300"><span aria-hidden>○</span>{item}</li>)}
        </ul>}
        <div className="flex gap-3 pt-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} className={secondaryButtonClass}>Voltar</Button>}
          {step < 2 ? <Button disabled={step === 0 ? modules.length === 0 : ministryName.trim().length < 2} onClick={() => setStep(step + 1)} className={primaryButtonClass}>Continuar</Button>
            : <Button disabled={pending} onClick={finish} className={primaryButtonClass}>{pending ? "Preparando…" : "Ir para o LUNOR"}</Button>}
        </div>
      </CardContent>
    </Card>
  </div>;
}

function MemberWizard({ churchId, churchName, ministries }: Props) {
  const [step, setStep] = useState(0);
  const [ministryIds, setMinistryIds] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const toggle = (list: string[], value: string, setter: (value: string[]) => void) => setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const finish = () => startTransition(async () => {
    const selectedMinistryNames = ministries
      .filter((ministry) => ministryIds.includes(ministry.id))
      .map((ministry) => ministry.name);
    const result = await completeMemberOnboarding({
      churchId,
      ministryIds,
      phone,
      departments: [...new Set([...departments, ...selectedMinistryNames])],
    });
    if (result && !result.ok) toast.error(result.error);
  });

  return <div className="space-y-4">
    <Progress step={step} total={2} />
    <Card className={cardClass}>
      <CardHeader className="text-center">
        <CardTitle>{step === 0 ? `Bem-vindo à ${churchName}` : "Complete seu perfil"}</CardTitle>
        <CardDescription className="text-zinc-400">{step === 0 ? "Selecione todos os ministérios em que você serve." : "Informe apenas o essencial por enquanto."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === 0 && (ministries.length ? <div className="flex flex-wrap gap-2">{ministries.map((ministry) => <Chip key={ministry.id} selected={ministryIds.includes(ministry.id)} onClick={() => toggle(ministryIds, ministry.id, setMinistryIds)}>{ministry.name}</Chip>)}</div> : <p className="rounded-2xl border border-white/10 bg-[#0b0b0c] p-4 text-sm text-zinc-400">A igreja ainda não criou um ministério. Peça ao administrador para concluir a configuração inicial.</p>)}
        {step === 1 && <>
          <div className="space-y-2"><Label htmlFor="phone">Telefone <span className="text-zinc-500">(opcional)</span></Label><Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} /></div>
          <div className="space-y-2">
            <Label>Departamentos</Label>
            <div className="flex flex-wrap gap-2">{DEPARTMENTS.map((department) => <Chip key={department} selected={departments.includes(department)} onClick={() => toggle(departments, department, setDepartments)}>{department}</Chip>)}</div>
          </div>
        </>}
        <div className="flex gap-3 pt-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(0)} className={secondaryButtonClass}>Voltar</Button>}
          {step === 0 ? <Button disabled={ministryIds.length === 0} onClick={() => setStep(1)} className={primaryButtonClass}>Confirmar ministérios</Button>
            : <Button disabled={pending} onClick={finish} className={primaryButtonClass}>{pending ? "Salvando…" : "Ver minhas escalas"}</Button>}
        </div>
      </CardContent>
    </Card>
  </div>;
}

