import {
  LUNOR_AI_MODEL,
  runLunorAiTurn,
  type LunorAiMessage,
  type LunorAiTurn,
} from "@/lib/ai/cloudflare";
import {
  executeInternalAiTool,
  internalAiTools,
  isAssignmentProposal,
  isInternalAiTool,
  isScheduleDraft,
} from "@/lib/ai/internal-tools";
import type { AssignmentProposal } from "@/lib/ai/scheduling";
import {
  executeLunorTool,
  lunorAiTools,
  type LunorToolContext,
} from "@/lib/ai/tools";

const SYSTEM_PROMPT = `Você é o assistente operacional do LUNOR para líderes de igreja.
Responda em português do Brasil, com clareza e objetividade.
Use as ferramentas do LUNOR para fatos sobre cultos, escalas, pessoas ou disponibilidade.
Baseie respostas factuais atuais nos dados retornados pelas ferramentas.
"Sem resposta" é diferente de "indisponível".
O escopo de igreja e ministério é definido pelo servidor.
Para sugerir uma pessoa para uma função, consulte primeiro get_schedule_candidates e depois use propose_assignment.
Para montar um rascunho da próxima escala ou de uma escala completa, descubra o culto com get_operational_summary e use draft_schedule_from_previous_service.
O rascunho usa a escala anterior apenas como referência de funções; deixe isso claro ao líder.
Nunca proponha uma pessoa marcada como indisponível.
Uma proposta NÃO altera dados: a gravação só acontece depois que o líder tocar em "Confirmar escala" no LUNOR.
As demais ferramentas desta versão são somente leitura.
Prefira respostas curtas, salvo quando o usuário pedir detalhes.`;

export type LunorAssistantHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type LunorAssistantResult = {
  answer: string;
  model: string;
  usedTools: string[];
  proposals: AssignmentProposal[];
};

type TurnRunner = (input: {
  messages: LunorAiMessage[];
  tools?: ReturnType<typeof lunorAiTools>;
  maxTokens?: number;
  temperature?: number;
}) => Promise<LunorAiTurn>;

type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
  context: LunorToolContext
) => Promise<unknown>;

async function executeAssistantTool(
  name: string,
  args: Record<string, unknown>,
  context: LunorToolContext
) {
  if (isInternalAiTool(name)) return executeInternalAiTool(name, args, context);
  return executeLunorTool(name, args, context);
}

/**
 * O binding tradicional do Workers AI espera o tool call anterior serializado
 * no conteúdo da mensagem `assistant`; a mensagem `tool` seguinte contém apenas
 * o resultado. Como desabilitamos chamadas paralelas, o caso normal é um único
 * tool call por rodada.
 */
function toolCallMessage(turn: LunorAiTurn) {
  const calls = turn.toolCalls.map((call) => ({
    name: call.name,
    arguments: call.arguments,
  }));
  return JSON.stringify(calls.length === 1 ? calls[0] : calls);
}

function proposalKey(proposal: AssignmentProposal) {
  return `${proposal.eventId}:${proposal.userId}:${proposal.roleName.toLocaleLowerCase("pt-BR")}`;
}

function appendProposal(proposals: AssignmentProposal[], proposal: AssignmentProposal) {
  const key = proposalKey(proposal);
  if (!proposals.some((item) => proposalKey(item) === key)) proposals.push(proposal);
}

export async function runLunorAssistant({
  question,
  history = [],
  context,
  maxToolRounds = 4,
  runner = runLunorAiTurn,
  toolExecutor = executeAssistantTool,
}: {
  question: string;
  history?: LunorAssistantHistoryItem[];
  context: LunorToolContext;
  maxToolRounds?: number;
  runner?: TurnRunner;
  toolExecutor?: ToolExecutor;
}): Promise<LunorAssistantResult> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) throw new Error("assistant_question_empty");
  if (cleanQuestion.length > 1_500) throw new Error("assistant_question_too_large");

  const recentHistory = history
    .slice(-8)
    .map((item) => ({ ...item, content: item.content.trim().slice(0, 1_500) }))
    .filter((item) => item.content.length > 0);
  const messages: LunorAiMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nEscopo atual: ministério ${context.ministryName}.`,
    },
    ...recentHistory,
    { role: "user", content: cleanQuestion },
  ];
  const usedTools: string[] = [];
  const proposals: AssignmentProposal[] = [];
  const tools = [...lunorAiTools(), ...internalAiTools()];
  let usedModel = LUNOR_AI_MODEL;

  for (let round = 0; round < maxToolRounds; round += 1) {
    const turn = await runner({
      messages,
      tools,
      maxTokens: 520,
      temperature: 0.1,
    });
    if (turn.model) usedModel = turn.model;

    if (turn.toolCalls.length === 0) {
      if (!turn.text) throw new Error("assistant_empty_answer");
      return {
        answer: turn.text,
        model: usedModel,
        usedTools: [...new Set(usedTools)],
        proposals,
      };
    }

    messages.push({ role: "assistant", content: toolCallMessage(turn) });

    for (const call of turn.toolCalls.slice(0, 3)) {
      let payload: unknown;
      try {
        const data = await toolExecutor(call.name, call.arguments, context);
        payload = { ok: true, data };
        usedTools.push(call.name);
        if (call.name === "propose_assignment" && isAssignmentProposal(data)) {
          appendProposal(proposals, data);
        }
        if (call.name === "draft_schedule_from_previous_service" && isScheduleDraft(data)) {
          data.proposals.forEach((proposal) => appendProposal(proposals, proposal));
        }
      } catch (error) {
        payload = {
          ok: false,
          error: error instanceof Error ? error.message : "tool_error",
        };
      }

      messages.push({
        role: "tool",
        content: JSON.stringify(payload),
      });
    }
  }

  messages.push({
    role: "user",
    content: "Responda usando somente os resultados das ferramentas acima. Se faltar um dado, informe que ele não foi encontrado.",
  });
  const finalTurn = await runner({ messages, tools: [], maxTokens: 520, temperature: 0.1 });
  if (finalTurn.model) usedModel = finalTurn.model;
  if (!finalTurn.text) throw new Error("assistant_empty_answer");

  return {
    answer: finalTurn.text,
    model: usedModel,
    usedTools: [...new Set(usedTools)],
    proposals,
  };
}
