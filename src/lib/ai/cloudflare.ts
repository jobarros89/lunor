import { getCloudflareContext } from "@opennextjs/cloudflare";

export const LUNOR_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";

type WorkersAI = {
  run: (
    model: string,
    input: {
      prompt: string;
      max_tokens?: number;
      temperature?: number;
    }
  ) => Promise<unknown>;
};

export type LunorAiInput = {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
};

export function extractWorkersAiText(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (!result || typeof result !== "object") return "";

  const record = result as Record<string, unknown>;
  if (typeof record.response === "string") return record.response.trim();
  if (typeof record.result === "string") return record.result.trim();

  return "";
}

/**
 * Único ponto de acesso do LUNOR ao Cloudflare Workers AI.
 *
 * Manter as features chamando este provider evita espalhar detalhes de modelo,
 * binding ou fornecedor pela aplicação e permite trocar o provider futuramente.
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

  const { env } = await getCloudflareContext({ async: true });
  const ai = (env as unknown as { AI?: WorkersAI }).AI;
  if (!ai) throw new Error("workers_ai_binding_unavailable");

  const result = await ai.run(LUNOR_AI_MODEL, {
    prompt: `${system.trim()}\n\nTarefa:\n${cleanPrompt}`,
    max_tokens: Math.min(Math.max(maxTokens, 32), 1_024),
    temperature: Math.min(Math.max(temperature, 0), 1),
  });

  const text = extractWorkersAiText(result);
  if (!text) throw new Error("workers_ai_empty_response");
  return text;
}
