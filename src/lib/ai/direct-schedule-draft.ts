import { buildScheduleDraftFromPreviousService } from "@/lib/ai/schedule-draft";
import type { AssignmentProposal, SchedulingContext } from "@/lib/ai/scheduling";
import { loadOperationalSummary } from "@/lib/operational-summary-server";

export type DirectScheduleDraftAnswer = {
  answer: string;
  usedTools: string[];
  proposals: AssignmentProposal[];
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

function asksForScheduleDraft(question: string) {
  const text = normalize(question);
  return (
    text.includes("montar a proxima escala") ||
    text.includes("monte a proxima escala") ||
    text.includes("rascunho da proxima escala") ||
    text.includes("sugestao da proxima escala") ||
    text.includes("montar a escala completa") ||
    text.includes("monte a escala completa")
  );
}

export async function runDirectScheduleDraft({
  question,
  context,
}: {
  question: string;
  context: SchedulingContext;
}): Promise<DirectScheduleDraftAnswer | null> {
  if (!asksForScheduleDraft(question)) return null;

  const summary = await loadOperationalSummary({
    churchId: context.churchId,
    ministryId: context.ministryId,
    ministryName: context.ministryName,
    limit: 1,
  });
  const nextEvent = summary.events[0];
  if (!nextEvent) {
    return {
      answer: "Não encontrei um culto futuro para montar a escala. Cadastre ou selecione um culto e tente novamente.",
      usedTools: ["get_operational_summary"],
      proposals: [],
    };
  }

  const draft = await buildScheduleDraftFromPreviousService(context, {
    eventId: nextEvent.id,
    maxRoles: 12,
  });
  if (!draft.referenceEvent) {
    return {
      answer: `Encontrei ${draft.event.title}, mas ainda não existe uma escala anterior de ${context.ministryName} que possa servir de referência. Posso sugerir pessoas por função se você me disser quais posições precisa preencher.`,
      usedTools: ["get_operational_summary", "draft_schedule_from_previous_service"],
      proposals: [],
    };
  }

  if (draft.proposals.length === 0) {
    const alreadyFilled = draft.skippedRoles.filter((item) => item.reason === "already_filled").length;
    const withoutCandidate = draft.skippedRoles.filter(
      (item) => item.reason === "no_eligible_candidate"
    ).length;
    return {
      answer: `Analisei ${draft.event.title} usando ${draft.referenceEvent.title} como referência. Não há novas sugestões para adicionar agora.${alreadyFilled ? ` ${alreadyFilled} função(ões) já estão preenchidas.` : ""}${withoutCandidate ? ` ${withoutCandidate} função(ões) ficaram sem candidato elegível.` : ""}`,
      usedTools: ["get_operational_summary", "draft_schedule_from_previous_service"],
      proposals: [],
    };
  }

  const withoutCandidate = draft.skippedRoles.filter(
    (item) => item.reason === "no_eligible_candidate"
  ).length;
  return {
    answer: `Preparei um rascunho para ${draft.event.title} usando ${draft.referenceEvent.title} apenas como referência de funções. São ${draft.proposals.length} sugestão(ões) abaixo. Revise e confirme cada pessoa antes de gravar.${withoutCandidate ? ` ${withoutCandidate} função(ões) ficaram sem candidato elegível e precisam de revisão manual.` : ""}`,
    usedTools: ["get_operational_summary", "draft_schedule_from_previous_service"],
    proposals: draft.proposals,
  };
}
