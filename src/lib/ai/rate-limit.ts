/**
 * Lógica pura de rate limiting — sem I/O, sem Supabase.
 * Testável isoladamente.
 */

export type RateLimitConfig = {
  maxMessagesPerHour: number;
  windowMinutes: number;
};

export const DEFAULT_AI_RATE_LIMIT: RateLimitConfig = {
  maxMessagesPerHour: 20,
  windowMinutes: 60,
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; resetAt: Date; remaining: number };

/**
 * Calcula se a próxima requisição está dentro do limite.
 * Recebe a lista de timestamps de requisições recentes (em ordem DESC, mais recente primeiro)
 * e retorna allow/deny com informações pra o cliente.
 */
export function checkRateLimit(
  recentLogTimestamps: Date[],
  config: RateLimitConfig = DEFAULT_AI_RATE_LIMIT,
  now: Date = new Date()
): RateLimitResult {
  const windowStart = new Date(now.getTime() - config.windowMinutes * 60 * 1000);

  // Contar quantas requisições caem dentro da janela
  const countInWindow = recentLogTimestamps.filter((ts) => ts >= windowStart).length;

  if (countInWindow < config.maxMessagesPerHour) {
    return { allowed: true };
  }

  // Limite atingido — calcular quando ele reseta
  // (quando a requisição mais antiga da janela sair da window)
  // Como logs estão em ordem DESC (mais recente primeiro), o mais antigo é o último
  const inWindow = recentLogTimestamps.filter((ts) => ts >= windowStart);
  const oldestInWindow = inWindow.length > 0 ? inWindow[inWindow.length - 1] : null;
  const resetAt = oldestInWindow ? new Date(oldestInWindow.getTime() + config.windowMinutes * 60 * 1000) : now;

  return {
    allowed: false,
    resetAt,
    remaining: 0,
  };
}
