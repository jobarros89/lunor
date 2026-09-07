import { createClient } from "@supabase/supabase-js";
import { serverEnvAsync } from "@/lib/env";
import { sendWebPush } from "@/lib/push/send";
import { isVerseTheme } from "@/lib/bible/references";
import { rotateTheme } from "@/lib/bible/select-theme";
import { selectDailyVerse } from "@/lib/bible/select-verse";
import { fetchVerseText } from "@/lib/bible/fetch-verse";

type Alvo = {
  church_id: string;
  church_slug: string;
  version: string;
  fixed_theme: string | null;
  recent_references: string[] | null;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type DailyVerseSendResult = {
  ok: boolean;
  igrejas: number;
  enviados: number;
  erro?: string;
};

/**
 * Envia o versículo do dia.
 *
 * Sem `churchId`: roda para todas as igrejas elegíveis — é o que o cron
 * (`/api/cron/verse`) chama todo dia às 12h.
 *
 * Com `churchId`: filtra para essa igreja só — é o que o botão "Enviar
 * agora" do admin chama. Mesma reserva de dia (`versiculo_registrar`), então
 * clicar duas vezes no mesmo dia não manda duas vezes: a segunda chamada
 * simplesmente não encontra nada pendente para essa igreja.
 *
 * Mesmo desenho de segurança nos dois casos: as RPCs exigem o CRON_SECRET
 * internamente, lido aqui do ambiente do servidor — nunca chega ao cliente.
 */
export async function runDailyVerseSend({
  churchId,
}: { churchId?: string } = {}): Promise<DailyVerseSendResult> {
  const segredo = await serverEnvAsync("CRON_SECRET");
  if (!segredo) {
    return { ok: false, igrejas: 0, enviados: 0, erro: "CRON_SECRET não configurado" };
  }

  const url = await serverEnvAsync("NEXT_PUBLIC_SUPABASE_URL");
  const publicKey =
    (await serverEnvAsync("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) ??
    (await serverEnvAsync("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  if (!url || !publicKey) {
    return { ok: false, igrejas: 0, enviados: 0, erro: "supabase não configurado" };
  }

  const supabase = createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("versiculo_alvos", { p_secret: segredo });
  if (error) {
    console.error("runDailyVerseSend: versiculo_alvos falhou", error.message);
    return { ok: false, igrejas: 0, enviados: 0, erro: error.message };
  }

  let alvos = (data ?? []) as Alvo[];
  if (churchId) {
    alvos = alvos.filter((alvo) => alvo.church_id === churchId);
  }

  const porIgreja = new Map<string, Alvo[]>();
  for (const alvo of alvos) {
    porIgreja.set(alvo.church_id, [...(porIgreja.get(alvo.church_id) ?? []), alvo]);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let igrejas = 0;
  let enviados = 0;

  for (const [cId, inscricoes] of porIgreja) {
    const primeira = inscricoes[0];
    const tema =
      primeira.fixed_theme && isVerseTheme(primeira.fixed_theme)
        ? primeira.fixed_theme
        : rotateTheme(hoje);

    const referencia = selectDailyVerse({
      theme: tema,
      churchId: cId,
      date: hoje,
      recentLabels: primeira.recent_references ?? [],
    });

    // Reserva o dia antes de enviar: se duas execuções coincidirem (cron +
    // botão manual, ou dois cliques), só uma passa daqui.
    const { data: reservou, error: erroReserva } = await supabase.rpc("versiculo_registrar", {
      p_secret: segredo,
      p_church_id: cId,
      p_theme: tema,
      p_reference: referencia.label,
    });
    if (erroReserva || reservou !== true) continue;

    const versiculo = await fetchVerseText({ reference: referencia, version: primeira.version });
    if (!versiculo) {
      console.error("runDailyVerseSend: texto indisponível", referencia.label);
      continue;
    }

    igrejas++;
    for (const inscricao of inscricoes) {
      try {
        await sendWebPush(
          [{ endpoint: inscricao.endpoint, p256dh: inscricao.p256dh, auth: inscricao.auth }],
          {
            title: `Palavra de hoje · ${versiculo.label}`,
            body: versiculo.text,
            url: `/${inscricao.church_slug}`,
            tag: "versiculo-do-dia",
          }
        );
        enviados++;
      } catch (err) {
        console.error("runDailyVerseSend: push falhou", err);
      }
    }
  }

  return { ok: true, igrejas, enviados };
}
