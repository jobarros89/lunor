import { runLunorAi } from "@/lib/ai/cloudflare";
import { VERSE_THEMES, isVerseTheme, type VerseTheme } from "./references";

/**
 * Rotação determinística por semana. É o comportamento base e o fallback:
 * se a IA estiver indisponível ou devolver algo fora do acervo, o envio
 * acontece do mesmo jeito.
 */
export function rotateTheme(date: string): VerseTheme {
  const week = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / (7 * 24 * 60 * 60 * 1000));
  return VERSE_THEMES[Math.abs(week) % VERSE_THEMES.length];
}

export type ChurchWeekContext = {
  /** Quantas pessoas servem no fim de semana. */
  servingThisWeekend: number;
  /** Quantas estão com carga alta (mesmo critério do /distribuicao). */
  overloaded: number;
  /** Se há culto nas próximas 48h. */
  serviceSoon: boolean;
};

/**
 * A IA escolhe apenas o TEMA da semana — nunca o texto e nunca a referência.
 * O texto vem sempre da API e a referência sai do acervo curado, então não
 * existe caminho pelo qual o modelo possa inventar escritura.
 */
export async function selectThemeWithAi({
  date,
  context,
}: {
  date: string;
  context: ChurchWeekContext;
}): Promise<{ theme: VerseTheme; aiUsed: boolean }> {
  const fallback = rotateTheme(date);

  try {
    const answer = await runLunorAi({
      system:
        "Você escolhe o tema pastoral da semana para uma equipe de voluntários de igreja. " +
        `Responda com exatamente UMA palavra, entre estas opções: ${VERSE_THEMES.join(", ")}. ` +
        "Sem pontuação, sem explicação, sem aspas.",
      prompt:
        `Nesta semana: ${context.servingThisWeekend} pessoas escaladas para servir, ` +
        `${context.overloaded} com carga alta nas últimas semanas, ` +
        `${context.serviceSoon ? "há culto nas próximas 48 horas" : "não há culto próximo"}.`,
      maxTokens: 12,
      temperature: 0,
    });

    const candidate = answer.trim().toLowerCase().replace(/[^a-zç]/g, "");
    if (isVerseTheme(candidate)) return { theme: candidate, aiUsed: true };
    return { theme: fallback, aiUsed: false };
  } catch {
    return { theme: fallback, aiUsed: false };
  }
}
