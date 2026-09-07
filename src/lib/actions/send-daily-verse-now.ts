"use server";

import { createClient } from "@/lib/supabase/server";
import { runDailyVerseSend, type DailyVerseSendResult } from "@/lib/bible/send-daily-verse";

/**
 * Dispara o envio do versículo do dia para uma igreja específica, agora.
 *
 * As RPCs de envio são gated por CRON_SECRET, não por RLS — então a
 * checagem de permissão precisa ser explícita aqui, antes de chamar
 * runDailyVerseSend. Mesmo padrão de canManageMusic em actions/youtube.ts.
 */
export async function sendDailyVerseNowAction(
  churchId: string
): Promise<DailyVerseSendResult> {
  const supabase = await createClient();
  const { data: isCoord, error } = await supabase.rpc("is_church_coord", {
    p_church: churchId,
  });

  if (error || !isCoord) {
    return { ok: false, igrejas: 0, enviados: 0, erro: "Sem permissão para esta igreja." };
  }

  return runDailyVerseSend({ churchId });
}
