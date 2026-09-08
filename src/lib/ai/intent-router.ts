export type AssistantIntent =
  | "lookup"
  | "analysis"
  | "plan"
  | "action"
  | "conversation";

export type AssistantRequestScope = "local" | "cross_module" | "global";

export type AssistantRequestProfile = {
  intent: AssistantIntent;
  scope: AssistantRequestScope;
  strategy: "direct_lookup" | "orchestrator";
  needsLeadershipInsights: boolean;
  reasons: string[];
};

type MinistryRef = { id: string; name: string };

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalize(term)));
}

const GLOBAL_TERMS = [
  "igreja como um todo",
  "visao geral",
  "panorama geral",
  "todos os ministerios",
  "todos os modulos",
  "reuniao de lideres",
  "lideranca como um todo",
  "app como um todo",
  "lunor como um todo",
  "operacao da igreja",
];

const ANALYSIS_TERMS = [
  "analise",
  "analisa",
  "insight",
  "insights",
  "o que chama atencao",
  "o que precisa de atencao",
  "prioridade",
  "prioridades",
  "risco",
  "riscos",
  "gargalo",
  "gargalos",
  "sobrecarregado",
  "sobrecarregada",
  "muito usado",
  "muito escalado",
  "frequencia",
  "equilibrio",
  "compare",
  "comparar",
  "melhor opcao",
  "melhor pessoa",
  "quem seria melhor",
  "por que",
  "porque",
  "tendencia",
  "tendencias",
];

const PLAN_TERMS = [
  "prepare",
  "preparar",
  "planeje",
  "planejar",
  "monte",
  "montar",
  "organize",
  "organizar",
  "sugira",
  "sugerir",
  "recomende",
  "recomendar",
  "rascunho",
  "proposta",
  "proponha",
  "proximo culto",
  "proximo domingo",
  "escala completa",
  "repertorio",
];

const ACTION_TERMS = [
  "adicione",
  "adicionar",
  "escale",
  "escalar",
  "substitua",
  "substituir",
  "confirme",
  "confirmar",
  "crie",
  "criar",
  "remova",
  "remover",
  "envie",
  "enviar",
  "publique",
  "publicar",
];

const LOOKUP_PREFIXES = [
  "quem ",
  "qual ",
  "quais ",
  "quando ",
  "onde ",
  "quantos ",
  "quantas ",
  "tem ",
  "ha ",
  "esta disponivel",
  "estao disponiveis",
];

const LEADERSHIP_INSIGHT_TERMS = [
  ...ANALYSIS_TERMS,
  "como esta a igreja",
  "como esta a operacao",
  "status geral",
  "resumo para lideres",
  "reuniao de lideres",
  "o que devo resolver primeiro",
  "o que falta",
];

function resolveScope(
  normalized: string,
  currentMinistryId: string,
  allowedMinistries: MinistryRef[]
): { scope: AssistantRequestScope; reasons: string[] } {
  const reasons: string[] = [];
  if (includesAny(normalized, GLOBAL_TERMS)) {
    reasons.push("global_term");
    return { scope: "global", reasons };
  }

  const otherMentioned = allowedMinistries.find(
    (item) =>
      item.id !== currentMinistryId &&
      normalize(item.name).length >= 3 &&
      normalized.includes(normalize(item.name))
  );
  if (otherMentioned) {
    reasons.push(`other_ministry:${otherMentioned.id}`);
    return { scope: "cross_module", reasons };
  }

  return { scope: "local", reasons };
}

function resolveIntent(normalized: string) {
  const reasons: string[] = [];

  if (includesAny(normalized, ACTION_TERMS)) {
    reasons.push("action_language");
    return { intent: "action" as const, reasons };
  }
  if (includesAny(normalized, PLAN_TERMS)) {
    reasons.push("planning_language");
    return { intent: "plan" as const, reasons };
  }
  if (includesAny(normalized, ANALYSIS_TERMS)) {
    reasons.push("analysis_language");
    return { intent: "analysis" as const, reasons };
  }
  if (LOOKUP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    reasons.push("lookup_language");
    return { intent: "lookup" as const, reasons };
  }

  // Perguntas curtas e objetivas ainda podem aproveitar o caminho determinístico.
  // Na dúvida, preferimos o orquestrador: é mais seguro perder um pouco de latência
  // do que responder uma pergunta analítica como se fosse somente consulta.
  const questionLike = normalized.endsWith("?") || normalized.split(/\s+/).length <= 8;
  if (questionLike && !includesAny(normalized, LEADERSHIP_INSIGHT_TERMS)) {
    reasons.push("simple_question");
    return { intent: "lookup" as const, reasons };
  }

  reasons.push("ambiguous_request");
  return { intent: "conversation" as const, reasons };
}

export function classifyAssistantRequest({
  question,
  currentMinistryId,
  allowedMinistries,
}: {
  question: string;
  currentMinistryId: string;
  allowedMinistries: MinistryRef[];
}): AssistantRequestProfile {
  const normalized = normalize(question);
  const intentResult = resolveIntent(normalized);
  const scopeResult = resolveScope(normalized, currentMinistryId, allowedMinistries);
  const needsLeadershipInsights =
    scopeResult.scope === "global" || includesAny(normalized, LEADERSHIP_INSIGHT_TERMS);

  const strategy =
    intentResult.intent === "lookup" && scopeResult.scope === "local"
      ? "direct_lookup"
      : "orchestrator";

  return {
    intent: intentResult.intent,
    scope: scopeResult.scope,
    strategy,
    needsLeadershipInsights,
    reasons: [...intentResult.reasons, ...scopeResult.reasons],
  };
}

export function assistantRequestProfileDescription(profile: AssistantRequestProfile) {
  const intentGuidance: Record<AssistantIntent, string> = {
    lookup:
      "Responda o fato pedido com dados atuais e evite ampliar a resposta sem necessidade.",
    analysis:
      "Cruze os dados relevantes, destaque evidências, riscos, padrões e próximos passos concretos.",
    plan:
      "Transforme a solicitação em um plano operacional revisável, explicando premissas e pendências.",
    action:
      "Entenda a ação desejada, mas use somente propostas confirmáveis quando houver escrita; nunca grave sem confirmação humana.",
    conversation:
      "Entenda a intenção pelo contexto e use ferramentas quando qualquer afirmação depender de dados atuais do LUNOR.",
  };

  return [
    `Intenção detectada pelo servidor: ${profile.intent}.`,
    `Escopo detectado pelo servidor: ${profile.scope}.`,
    intentGuidance[profile.intent],
    profile.needsLeadershipInsights
      ? "A solicitação pede visão de liderança: consulte get_leadership_insights antes de concluir quando houver dados operacionais envolvidos."
      : "Use o menor conjunto de ferramentas necessário para responder com segurança.",
  ].join("\n");
}
