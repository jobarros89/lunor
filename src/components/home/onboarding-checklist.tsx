"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, Check } from "lucide-react";
import { dismissOnboardingChecklist } from "@/lib/actions/onboarding";
import type { OnboardingChecklist } from "@/lib/onboarding-checklist";
import { cn } from "@/lib/utils";

export function OnboardingChecklistCard({
  churchId,
  checklist,
}: {
  churchId: string;
  checklist: OnboardingChecklist;
}) {
  const [pending, startTransition] = useTransition();
  const done = checklist.steps.filter((step) => step.done).length;
  const total = checklist.steps.length;
  const nextStep = checklist.steps.find((step) => !step.done);

  const dismiss = () => startTransition(async () => {
    const result = await dismissOnboardingChecklist({ churchId });
    if (result && !result.ok) toast.error(result.error);
  });

  return (
    <section className="space-y-4" aria-labelledby="onboarding-checklist-title">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/20 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Primeiros passos · {done}/{total}
          </p>
          <h2 id="onboarding-checklist-title" className="mt-2 text-2xl font-medium tracking-tight">
            Vamos deixar o LUNOR pronto para servir
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          disabled={pending}
          className="min-h-11 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          Dispensar
        </button>
      </div>

      <div className="divide-y divide-foreground/15 rounded-3xl border px-4 md:px-5">
        {checklist.steps.map((step) => (
          <div key={step.id} className="flex items-center gap-4 py-4">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full",
                step.done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
              )}
              aria-hidden
            >
              {step.done ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", step.done && "text-muted-foreground line-through")}>
                {step.label}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
            </div>
            {!step.done && (
              <Link
                href={step.href}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium hover:bg-accent"
              >
                {step.id === nextStep?.id ? "Começar" : "Abrir"}
                <ArrowRight className="size-3.5" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
