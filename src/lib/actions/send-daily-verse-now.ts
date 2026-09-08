"use server";

import { createClient } from "@/lib/supabase/server";
import { runDailyVerseSend, type DailyVerseSendResult } from "@/lib/bible/send-daily-verse";

/**
 * Dispara o envio manual do versículo para uma igreja específica.
 *
 * O envio manual é deliberadamente independente da trava diária do cron:
 * pode rodar antes ou depois do automático e pode ser repetido. A proteção
 * aqui é de autorização — somente coordenadores da igreja podem dispará-lo.
 */
export async function sendDailyVerseNowAction(
  churchId: string
): Promise<DailyVerseSendResult> {
  const supabase = await createClient();
  const { data: isCoord, error } = await supabase.rpc("is_church_coord", {
    p_church: churchId,
  });

  if (error || !isCoord) {
    return {
      ok: false,
      igrejas: 0,
      enviados: 0,
      elegiveis: 0,
      inscricoes: 0,
      falhas: 0,
      erro: "Sem permissão para esta igreja.",
    };
  }

  return runDailyVerseSend({ churchId, force: true });
}
