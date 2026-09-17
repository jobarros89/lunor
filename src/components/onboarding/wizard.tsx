"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  completeChurchOnboarding,
  completeMemberOnboarding,
} from "@/lib/actions/onboarding";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

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

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-brand bg-brand text-brand-foreground"
          : "border-white/15 bg-[#0b0b0c] text-zinc-300 hover:border-brand/70 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  const labels = ["Módulos", "Primeiro time", "Próximos passos"];
  return (
    <div>
      <ol className="grid grid-cols-3 gap-2" aria-label="Progresso do cadastro">
        {labels.map((label, index) => (
          <li
            key={label}
            aria-current={index === step ? "step" : undefined}
            className={cn(
              "flex flex-col items-center gap-2 text-center text-xs",
              index === step ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                index <= step
                  ? "border-brand bg-brand text-brand-foreground"
                  : "border-border",
              )}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>
      <p role="status" className="sr-only">
        Passo {step + 1} de {total}: {labels[step]}
      </p>
    </div>
  );
}

const cardClass =
  "rounded-2xl border-white/10 bg-[#111113] text-[#f4f3ef] shadow-none";
const inputClass =
  "h-11 rounded-lg border-white/15 bg-[#0b0b0c] text-[#f4f3ef] placeholder:text-zinc-400 focus-visible:border-brand focus-visible:ring-brand/25";
const primaryButtonClass =
  "h-11 flex-1 rounded-lg bg-brand text-brand-foreground hover:bg-brand-strong";
const secondaryButtonClass =
  "h-11 flex-1 rounded-lg border-white/15 bg-transparent text-zinc-200 hover:bg-white/5 hover:text-white";

export function OnboardingWizard(props: Props) {
  return props.mode === "owner" ? (
    <OwnerWizard {...props} />
  ) : (
    <MemberWizard {...props} />
  );
}

function OwnerWizard({ churchId, churchName }: Props) {
  const [step, setStep] = useState(0);
  const [modules, setModules] = useState<string[]>(["teams", "worship"]);
  const [ministryName, setMinistryName] = useState("Louvor");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (step !== previousStep.current) headingRef.current?.focus();
    previousStep.current = step;
  }, [step]);
  const toggle = (id: string) =>
    setModules((value) =>
      value.includes(id) ? value.filter((item) => item !== id) : [...value, id],
    );

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeChurchOnboarding({
        churchId,
        modules,
        ministryName,
      });
      if (result && !result.ok) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <Progress step={step} total={3} />
      <Card className={cardClass}>
        <CardHeader className="text-center">
          <h1
            id={headingId}
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold tracking-tight outline-none"
          >
            {step === 0
              ? "O que você quer organizar primeiro?"
              : step === 1
                ? "Crie o primeiro ministério"
                : "Tudo pronto para começar"}
          </h1>
          <CardDescription className="text-zinc-400">
            {step === 0
              ? "Isso só personaliza a navegação. Você poderá usar os outros módulos depois."
              : step === 1
                ? `Este será o primeiro time de ${churchName}.`
                : "Comece por uma destas ações e avance no seu ritmo."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5" aria-busy={pending}>
          {error && <Alert variant="error">{error}</Alert>}
          {step === 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {MODULES.map((item) => (
                <Chip
                  key={item.id}
                  selected={modules.includes(item.id)}
                  onClick={() => toggle(item.id)}
                >
                  {item.name}
                </Chip>
              ))}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-3">
              <Label htmlFor="ministryName">Nome do ministério</Label>
              <Input
                id="ministryName"
                value={ministryName}
                onChange={(e) => setMinistryName(e.target.value)}
                placeholder="Louvor, Mídia, Infantil…"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-2">
                {["Louvor", "Mídia", "Infantil"].map((name) => (
                  <Chip
                    key={name}
                    selected={ministryName === name}
                    onClick={() => setMinistryName(name)}
                  >
                    {name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <ul className="space-y-3 text-sm">
              {[
                "Convidar a equipe",
                "Criar o primeiro culto",
                "Montar a primeira escala",
                "Cadastrar a primeira música",
              ].map((item) => (
                <li
                  key={item}
                  className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0b0c] px-4 text-zinc-300"
                >
                  <span aria-hidden>○</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-3 pt-2">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className={secondaryButtonClass}
              >
                Voltar
              </Button>
            )}
            {step < 2 ? (
              <Button
                disabled={
                  step === 0
                    ? modules.length === 0
                    : ministryName.trim().length < 2
                }
                onClick={() => setStep(step + 1)}
                className={primaryButtonClass}
              >
                Continuar
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={finish}
                className={primaryButtonClass}
              >
                {pending ? "Preparando…" : "Ir para o LUNOR"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberWizard({ churchId, churchName, ministries }: Props) {
  const [ministryIds, setMinistryIds] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleMinistry = (id: string) => {
    setMinistryIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeMemberOnboarding({
        churchId,
        ministryIds,
        phone,
      });
      if (result && !result.ok) {
        setError(result.error);
        toast.error(result.error);
      }
    });
  };

  return (
    <Card className={cardClass}>
      <CardHeader className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Complete seu cadastro
        </h1>
        <CardDescription className="text-zinc-400">
          Informe o essencial e todos os times em que você serve na {churchName}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5" aria-busy={pending}>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="space-y-2">
          <Label htmlFor="phone">
            Telefone <span className="text-zinc-500">(opcional)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(21) 99999-9999"
            className={inputClass}
          />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium" id="member-ministry-label">
              Onde você serve?
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Você pode selecionar mais de um ministério.
            </p>
          </div>
          {ministries.length ? (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="member-ministry-label"
            >
              {ministries.map((ministry) => (
                <Chip
                  key={ministry.id}
                  selected={ministryIds.includes(ministry.id)}
                  onClick={() => toggleMinistry(ministry.id)}
                >
                  {ministry.name}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-[#0b0b0c] p-4 text-sm text-zinc-400">
              A igreja ainda não criou um ministério. Peça ao administrador para
              concluir a configuração inicial.
            </p>
          )}
        </div>

        <Button
          disabled={pending || ministryIds.length === 0}
          onClick={finish}
          className={`${primaryButtonClass} w-full`}
        >
          {pending ? "Salvando…" : "Entrar no LUNOR"}
        </Button>
      </CardContent>
    </Card>
  );
}
