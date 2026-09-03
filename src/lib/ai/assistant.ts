import {
  LUNOR_AI_MODEL,
  runLunorAiTurn,
  type LunorAiMessage,
  type LunorAiTurn,
} from "@/lib/ai/cloudflare";
import {
  executeLunorTool,
  lunorAiTools,
  type LunorToolContext,
} from "@/lib/ai/tools";

const SYSTEM_PROMPT = `Você é o assistente operacional do LUNOR para líderes de igreja.
Responda em português do Brasil, com clareza e objetividade.
Use as ferramentas do LUNOR para fatos sobre cultos, escalas, pessoas ou disponibilidade.
Baseie respostas apenas nos dados retornados pelas ferramentas.
"Sem resposta" é diferente de "indisponível".
O escopo de igreja e ministério é definido pelo servidor.
As ferramentas desta versão são somente leitura.
Prefira respostas curtas, salvo quando o usuário pedir detalhes.`;

export type LunorAssistantResult = {
  answer: string;
  model: string;
  usedTools: string[];
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
  context,
  maxToolRounds = 4,
  runner = runLunorAiTurn,
  toolExecutor = executeLunorTool,
}: {
  question: string;
  context: LunorToolContext;
  maxToolRounds?: number;
  runner?: TurnRunner;
  toolExecutor?: ToolExecutor;
}): Promise<LunorAssistantResult> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) throw new Error("assistant_question_empty");
  if (cleanQuestion.length > 1_500) throw new Error("assistant_question_too_large");

  const messages: LunorAiMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nEscopo atual: ministério ${context.ministryName}.`,
    },
    { role: "user", content: cleanQuestion },
  ];
  const usedTools: string[] = [];
  const tools = lunorAiTools();

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
      };
    }

    messages.push({ role: "assistant", content: toolCallMessage(turn) });

    for (const call of turn.toolCalls.slice(0, 3)) {
      let payload: unknown;
      try {
        payload = { ok: true, data: await toolExecutor(call.name, call.arguments, context) };
        usedTools.push(call.name);
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
  };
}
