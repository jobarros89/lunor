export type OnboardingStep = {
  id: "convidar" | "culto" | "escala" | "musica";
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export type OnboardingChecklist = {
  steps: OnboardingStep[];
  allDone: boolean;
};

export type OnboardingCounts = {
  activeMembers: number;
  events: number;
  assignments: number;
  songs: number;
};

/**
 * Puro: recebe contagens já resolvidas e devolve os passos com o estado de
 * conclusão. Sem I/O, para poder ser testado sem depender de um Supabase de
 * verdade — o mesmo desenho de operational-summary.ts / -server.ts.
 */
export function buildOnboardingChecklist({
  churchSlug,
  initialModules,
  counts,
}: {
  churchSlug: string;
  initialModules: string[];
  counts: OnboardingCounts;
}): OnboardingChecklist {
  const steps: OnboardingStep[] = [
    {
      id: "convidar",
      label: "Convidar a equipe",
      description: "Compartilhe o código de convite com quem serve com você.",
      href: `/${churchSlug}/mais`,
      // 1 = só quem criou a igreja. Mais de 1 significa que alguém aceitou o convite.
      done: counts.activeMembers > 1,
    },
    {
      id: "culto",
      label: "Criar o primeiro culto",
      description: "Cadastre a data e o horário do próximo encontro.",
      href: `/${churchSlug}/escalas/novo`,
      done: counts.events > 0,
    },
    {
      id: "escala",
      label: "Montar a primeira escala",
      description: "Escale pessoas para as funções do culto.",
      href: `/${churchSlug}/escalas`,
      done: counts.assignments > 0,
    },
  ];

  // Só entra na lista para quem escolheu o módulo de Louvor no setup — uma
  // igreja sem ministério de louvor não deveria ver um passo que nunca vai
  // querer concluir.
  if (initialModules.includes("worship")) {
    steps.push({
      id: "musica",
      label: "Cadastrar a primeira música",
      description: "Monte o acervo para montar repertórios depois.",
      href: `/${churchSlug}/louvor`,
      done: counts.songs > 0,
    });
  }

  return { steps, allDone: steps.every((step) => step.done) };
}
