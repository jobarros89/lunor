import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, DEFAULT_AI_RATE_LIMIT, type RateLimitResult } from "@/lib/ai/rate-limit";

/**
 * Verifica rate limit do usuário + igreja e registra a chamada.
 * Retorna allow/deny com informações pra cliente.
 * Em caso de falha no Supabase, fallback pra permitir (fail-open, não quebra a app).
 */
export async function checkAndLogAiUsage({
  userId,
  churchId,
}: {
  userId: string;
  churchId: string;
}): Promise<RateLimitResult> {
  const supabase = await createClient();

  try {
    // Buscar logs recentes (últimos 60 min) ordenados por timestamp DESC
    const { data: logs, error } = await supabase
      .from("ai_usage_logs")
      .select("created_at")
      .eq("user_id", userId)
      .eq("church_id", churchId)
      .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      console.error("rate-limit-server: failed to fetch logs", error);
      // Fail-open: permite se a query falhar, pra não quebrar assistente por erro de infra
      return { allowed: true };
    }

    const timestamps = (logs ?? []).map((log) => new Date(log.created_at));
    const result = checkRateLimit(timestamps, DEFAULT_AI_RATE_LIMIT);

    // Se passou, registra essa chamada
    if (result.allowed) {
      const { error: insertError } = await supabase.from("ai_usage_logs").insert({
        user_id: userId,
        church_id: churchId,
      });

      if (insertError) {
        console.error("rate-limit-server: failed to log usage", insertError);
        // Fail-open: mesmo se não conseguir logar, permite (pior caso: log incompleto)
      }
    }

    return result;
  } catch (err) {
    console.error("rate-limit-server: unexpected error", err instanceof Error ? err.message : "unknown");
    // Fail-open
    return { allowed: true };
  }
}
