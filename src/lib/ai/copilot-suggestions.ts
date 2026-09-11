import type { LeadershipInsight } from "@/lib/ai/leadership-insights";

export function copilotSuggestion(insight: LeadershipInsight) {
  const target = insight.event
    ? `o culto ${insight.event.title} (ID ${insight.event.id}, início ${insight.event.startsAt})`
    : "os próximos cultos";
  const actions = {
    staffing: { label: "Preparar rascunho", instruction: "Prepare um rascunho de escala com candidatos disponíveis e considere o equilíbrio de participações." },
    substitution: { label: "Analisar substituições", instruction: "Consulte as funções que precisam de substituição e sugira candidatos disponíveis. Explique o que precisará ser ajustado manualmente na escala atual; não trate uma inclusão como substituição concluída." },
    availability: { label: "Planejar disponibilidade", instruction: "Analise a disponibilidade, diferencie quem não respondeu de quem está indisponível e proponha o próximo passo. Se necessário, redija uma mensagem para eu revisar, sem enviar." },
    confirmation: { label: "Preparar acompanhamento", instruction: "Confira as confirmações pendentes e prepare um texto curto de acompanhamento para minha revisão, sem enviar mensagens." },
    readiness: { label: "Preparar próximos passos", instruction: "Analise o preparo e proponha até três próximos passos, priorizando o que é urgente." },
  };
  const action = actions[insight.category];
  return {
    label: action.label,
    question: `Em ${insight.ministry.name}, revise ${target}. ${action.instruction} Use dados atuais das ferramentas, explique a evidência e o impacto. Prepare somente sugestões para revisão humana; não execute nem aprove alterações.`,
  };
}

export function copilotSuggestionHref(churchSlug: string, insight: LeadershipInsight) {
  const query = new URLSearchParams({
    ministryId: insight.ministry.id,
    question: copilotSuggestion(insight).question,
  });
  return `/${encodeURIComponent(churchSlug)}/assistente?${query.toString()}`;
}
