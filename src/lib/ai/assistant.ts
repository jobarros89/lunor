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
Para sugerir uma escala, consulte primeiro get_schedule_candidates.
Nunca proponha uma pessoa marcada como indisponível.
Quando o usuário pedir explicitamente para sugerir quem escalar em uma função, use propose_assignment para gerar uma proposta revisável.
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

function toolCallMessage(turn: LunorAiTurn) {
  return JSON.stringify({
    tool_calls: turn.toolCalls.map((call) => ({
      id: call.id,
      name: call.name,
      arguments: call.arguments,
    })),
  });
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

  for (let round = 0; round < maxToolRounds; round += 1) {
    const turn = await runner({
      messages,
      tools,
      maxTokens: 520,
      temperature: 0.1,
    });

    if (turn.toolCalls.length === 0) {
      if (!turn.text) throw new Error("assistant_empty_answer");
      return {
        answer: turn.text,
        model: LUNOR_AI_MODEL,
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
          const key = `${data.eventId}:${data.userId}:${data.roleName.toLocaleLowerCase("pt-BR")}`;
          const exists = proposals.some(
            (proposal) =>
              `${proposal.eventId}:${proposal.userId}:${proposal.roleName.toLocaleLowerCase("pt-BR")}` === key
          );
          if (!exists) proposals.push(data);
        }
      } catch (error) {
        payload = {
          ok: false,
          error: error instanceof Error ? error.message : "tool_error",
        };
      }

      messages.push({
        role: "tool",
        name: call.name,
        ...(call.id ? { tool_call_id: call.id } : {}),
        content: JSON.stringify(payload),
      });
    }
  }

  messages.push({
    role: "user",
    content: "Responda usando somente os resultados das ferramentas acima. Se faltar um dado, informe que ele não foi encontrado.",
  });
  const finalTurn = await runner({ messages, tools: [], maxTokens: 520, temperature: 0.1 });
  if (!finalTurn.text) throw new Error("assistant_empty_answer");

  return {
    answer: finalTurn.text,
    model: LUNOR_AI_MODEL,
    usedTools: [...new Set(usedTools)],
    proposals,
  };
}
