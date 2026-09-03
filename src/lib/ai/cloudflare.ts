import { getCloudflareContext } from "@opennextjs/cloudflare";

export const LUNOR_AI_MODEL = "@cf/zai-org/glm-4.7-flash";

export type LunorAiMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type LunorAiTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type LunorAiToolCall = {
  id: string | null;
  name: string;
  arguments: Record<string, unknown>;
};

export type LunorAiTurn = {
  text: string;
  toolCalls: LunorAiToolCall[];
};

type WorkersAI = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

export type LunorAiInput = {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseToolCall(value: unknown, index: number): LunorAiToolCall | null {
  const record = recordOf(value);
  if (!record) return null;

  const fn = recordOf(record.function);
  const name =
    (typeof record.name === "string" && record.name) ||
    (typeof fn?.name === "string" && fn.name) ||
    "";
  if (!name) return null;

  const args = fn ? fn.arguments : record.arguments;
  return {
    id: typeof record.id === "string" ? record.id : `tool-${index + 1}`,
    name,
    arguments: parseArguments(args),
  };
}

function messageFromChoice(result: Record<string, unknown>) {
  const choices = Array.isArray(result.choices) ? result.choices : [];
  const first = recordOf(choices[0]);
  return first ? recordOf(first.message) : null;
}

/**
 * Normaliza respostas do binding Workers AI. Mantemos suporte tanto ao formato
 * direto do binding (`response`/`tool_calls`) quanto ao formato compatível com
 * Chat Completions (`choices[0].message`).
 */
export function parseWorkersAiTurn(result: unknown): LunorAiTurn {
  if (typeof result === "string") return { text: result.trim(), toolCalls: [] };
  const record = recordOf(result);
  if (!record) return { text: "", toolCalls: [] };

  const message = messageFromChoice(record);
  const rawText = message?.content ?? record.response ?? record.result;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const rawCalls = Array.isArray(message?.tool_calls)
    ? message.tool_calls
    : Array.isArray(record.tool_calls)
      ? record.tool_calls
      : [];
  const toolCalls = rawCalls
    .map((call, index) => parseToolCall(call, index))
    .filter((call): call is LunorAiToolCall => Boolean(call));

  return { text, toolCalls };
}

export function extractWorkersAiText(result: unknown): string {
  return parseWorkersAiTurn(result).text;
}

async function workersAi() {
  const { env } = await getCloudflareContext({ async: true });
  const ai = (env as unknown as { AI?: WorkersAI }).AI;
  if (!ai) throw new Error("workers_ai_binding_unavailable");
  return ai;
}

export async function runLunorAiTurn({
  messages,
  tools = [],
  maxTokens = 480,
  temperature = 0.15,
}: {
  messages: LunorAiMessage[];
  tools?: LunorAiTool[];
  maxTokens?: number;
  temperature?: number;
}): Promise<LunorAiTurn> {
  if (messages.length === 0) throw new Error("ai_messages_empty");
  const totalChars = messages.reduce((total, message) => total + message.content.length, 0);
  if (totalChars > 32_000) throw new Error("ai_messages_too_large");

  const ai = await workersAi();
  const result = await ai.run(LUNOR_AI_MODEL, {
    messages,
    ...(tools.length > 0
      ? {
          tools,
          tool_choice: "auto",
          parallel_tool_calls: false,
        }
      : {}),
    max_completion_tokens: Math.min(Math.max(maxTokens, 32), 1_024),
    temperature: Math.min(Math.max(temperature, 0), 1),
  });

  const turn = parseWorkersAiTurn(result);
  if (!turn.text && turn.toolCalls.length === 0) {
    throw new Error("workers_ai_empty_response");
  }
  return turn;
}

/**
 * Ponto simples de geração textual. Features agentivas devem preferir
 * `runLunorAiTurn`, que suporta ferramentas sem dar acesso direto ao banco.
 */
export async function runLunorAi({
  system = "Você é o assistente do LUNOR. Responda em português do Brasil, de forma curta, clara e sem inventar dados.",
  prompt,
  maxTokens = 320,
  temperature = 0.2,
}: LunorAiInput): Promise<string> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new Error("ai_prompt_empty");
  if (cleanPrompt.length > 8_000) throw new Error("ai_prompt_too_large");

  const turn = await runLunorAiTurn({
    messages: [
      { role: "system", content: system.trim() },
      { role: "user", content: cleanPrompt },
    ],
    maxTokens,
    temperature,
  });
  if (!turn.text) throw new Error("workers_ai_empty_response");
  return turn.text;
}
