"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeChurchOnboarding, completeMemberOnboarding } from "@/lib/actions/onboarding";
import { DIAS_SEMANA, PERIODOS } from "@/lib/briefing";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  mode: "owner" | "member";
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

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={cn(
    "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
    selected ? "border-foreground bg-foreground text-background" : "border-border bg-background text-muted-foreground hover:border-foreground/40"
  )}>{children}</button>;
}

function Progress({ step, total }: { step: number; total: number }) {
  return <div className="flex justify-center gap-1.5" aria-label={`Passo ${step + 1} de ${total}`}>
    {Array.from({ length: total }).map((_, i) => <span key={i} className={cn("h-1.5 rounded-full", i === step ? "w-6 bg-foreground" : "w-1.5 bg-border")} />)}
  </div>;
}

export function OnboardingWizard(props: Props) {
  return props.mode === "owner" ? <OwnerWizard {...props} /> : <MemberWizard {...props} />;
}

function OwnerWizard({ churchName }: Props) {
  const [step, setStep] = useState(0);
  const [modules, setModules] = useState<string[]>(["teams", "worship"]);
  const [ministryName, setMinistryName] = useState("Louvor");
  const [pending, startTransition] = useTransition();
  const headingId = useId();
  const toggle = (id: string) => setModules((value) => value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  const finish = () => startTransition(async () => {
    const result = await completeChurchOnboarding({ modules, ministryName });
    if (result && !result.ok) toast.error(result.error);
  });

  return <div className="space-y-4">
    <Progress step={step} total={3} />
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="text-center">
        <CardTitle id={headingId}>{step === 0 ? "O que você quer organizar primeiro?" : step === 1 ? "Crie o primeiro ministério" : "Tudo pronto para começar"}</CardTitle>
        <CardDescription>{step === 0 ? "Isso só personaliza a navegação. Você poderá usar os outros módulos depois." : step === 1 ? `Este será o primeiro time de ${churchName}.` : "Comece por uma destas ações e avance no seu ritmo."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === 0 && <div className="grid gap-3 sm:grid-cols-2">{MODULES.map((item) => <Chip key={item.id} selected={modules.includes(item.id)} onClick={() => toggle(item.id)}>{item.name}</Chip>)}</div>}
        {step === 1 && <div className="space-y-3">
          <Label htmlFor="ministryName">Nome do ministério</Label>
          <Input id="ministryName" value={ministryName} onChange={(e) => setMinistryName(e.target.value)} placeholder="Louvor, Mídia, Infantil…" className="h-12 rounded-full" />
          <div className="flex flex-wrap gap-2">{["Louvor", "Mídia", "Infantil"].map((name) => <Chip key={name} selected={ministryName === name} onClick={() => setMinistryName(name)}>{name}</Chip>)}</div>
        </div>}
        {step === 2 && <ul className="space-y-3 text-sm">
          {["Convidar a equipe", "Criar o primeiro culto", "Montar a primeira escala", "Cadastrar a primeira música"].map((item) => <li key={item} className="flex min-h-12 items-center gap-3 rounded-2xl border px-4"><span aria-hidden>○</span>{item}</li>)}
        </ul>}
        <div className="flex gap-3 pt-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)} className="h-12 flex-1 rounded-full">Voltar</Button>}
          {step < 2 ? <Button disabled={step === 0 ? modules.length === 0 : ministryName.trim().length < 2} onClick={() => setStep(step + 1)} className="h-12 flex-1 rounded-full">Continuar</Button>
            : <Button disabled={pending} onClick={finish} className="h-12 flex-1 rounded-full">{pending ? "Preparando…" : "Ir para o LUNOR"}</Button>}
        </div>
      </CardContent>
    </Card>
  </div>;
}

function MemberWizard({ churchName, ministries, skills }: Props) {
  const [step, setStep] = useState(0);
  const [ministryIds, setMinistryIds] = useState<string[]>(ministries[0] ? [ministries[0].id] : []);
  const [phone, setPhone] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const toggle = (list: string[], value: string, setter: (value: string[]) => void) => setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  const finish = () => startTransition(async () => {
    const result = await completeMemberOnboarding({ ministryIds, phone, days, periods, skills: selectedSkills });
    if (result && !result.ok) toast.error(result.error);
  });

  return <div className="space-y-4">
    <Progress step={step} total={2} />
    <Card className="rounded-3xl shadow-sm">
      <CardHeader className="text-center">
        <CardTitle>{step === 0 ? `Bem-vindo à ${churchName}` : "Complete seu perfil de serviço"}</CardTitle>
        <CardDescription>{step === 0 ? "Selecione todos os ministérios em que você serve." : "Só informações úteis para montar escalas melhores."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {step === 0 && (ministries.length ? <div className="flex flex-wrap gap-2">{ministries.map((ministry) => <Chip key={ministry.id} selected={ministryIds.includes(ministry.id)} onClick={() => toggle(ministryIds, ministry.id, setMinistryIds)}>{ministry.name}</Chip>)}</div> : <p className="rounded-2xl border p-4 text-sm text-muted-foreground">A igreja ainda não criou um ministério. Peça ao administrador para concluir a configuração inicial.</p>)}
        {step === 1 && <>
          <div className="space-y-2"><Label htmlFor="phone">Telefone <span className="text-muted-foreground">(opcional)</span></Label><Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 rounded-full" /></div>
          <div className="space-y-2"><Label>Funções ou instrumentos</Label><div className="flex flex-wrap gap-2">{skills.map((skill) => <Chip key={skill.slug} selected={selectedSkills.includes(skill.slug)} onClick={() => toggle(selectedSkills, skill.slug, setSelectedSkills)}>{skill.name}</Chip>)}</div></div>
          <div className="space-y-2"><Label>Dias disponíveis</Label><div className="flex flex-wrap gap-2">{DIAS_SEMANA.map((day) => <Chip key={day.key} selected={days.includes(day.key)} onClick={() => toggle(days, day.key, setDays)}>{day.label}</Chip>)}</div></div>
          <div className="space-y-2"><Label>Períodos</Label><div className="flex flex-wrap gap-2">{PERIODOS.map((period) => <Chip key={period.key} selected={periods.includes(period.key)} onClick={() => toggle(periods, period.key, setPeriods)}>{period.label}</Chip>)}</div></div>
        </>}
        <div className="flex gap-3 pt-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(0)} className="h-12 flex-1 rounded-full">Voltar</Button>}
          {step === 0 ? <Button disabled={ministryIds.length === 0} onClick={() => setStep(1)} className="h-12 flex-1 rounded-full">Confirmar ministérios</Button>
            : <Button disabled={pending} onClick={finish} className="h-12 flex-1 rounded-full">{pending ? "Salvando…" : "Ver minhas escalas"}</Button>}
        </div>
      </CardContent>
    </Card>
  </div>;
}
