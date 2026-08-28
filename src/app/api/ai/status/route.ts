import { createClient } from "@/lib/supabase/server";
import { LUNOR_AI_MODEL, runLunorAi } from "@/lib/ai/cloudflare";

export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * Diagnóstico autenticado do binding Workers AI.
 * Não aceita prompt do cliente e não envia dados da igreja ao modelo.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: HEADERS });
  }

  const started = Date.now();
  try {
    const response = await runLunorAi({
      system: "Responda exatamente com a palavra OK e nada mais.",
      prompt: "Teste de disponibilidade do LUNOR AI.",
      maxTokens: 32,
      temperature: 0,
    });

    return Response.json(
      {
        status: response.trim().toUpperCase().startsWith("OK") ? "ok" : "degraded",
        provider: "cloudflare-workers-ai",
        model: LUNOR_AI_MODEL,
        ms: Date.now() - started,
      },
      { headers: HEADERS }
    );
  } catch {
    return Response.json(
      {
        status: "down",
        provider: "cloudflare-workers-ai",
        model: LUNOR_AI_MODEL,
        ms: Date.now() - started,
      },
      { status: 503, headers: HEADERS }
    );
  }
}
