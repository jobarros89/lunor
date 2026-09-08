import { createClient } from "@supabase/supabase-js";
import { serverEnvAsync } from "@/lib/env";
import { sendWebPushDetailed } from "@/lib/push/send";
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

export type DailyVerseSendReason =
  | "sem_alvos"
  | "texto_indisponivel"
  | "push_falhou";

export type DailyVerseSendResult = {
  ok: boolean;
  igrejas: number;
  enviados: number;
  elegiveis: number;
  inscricoes: number;
  falhas: number;
  motivo?: DailyVerseSendReason;
  erro?: string;
};

function emptyResult(erro: string): DailyVerseSendResult {
  return {
    ok: false,
    igrejas: 0,
    enviados: 0,
    elegiveis: 0,
    inscricoes: 0,
    falhas: 0,
    erro,
  };
}

function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Envia o versículo do dia.
 *
 * Sem `churchId`: roda para todas as igrejas elegíveis — é o que o cron
 * (`/api/cron/verse`) chama. Nesse modo, a reserva diária continua garantindo
 * no máximo um disparo automático por igreja.
 *
 * Com `churchId` + `force`: é o botão "Enviar agora" do admin. O envio manual
 * ignora intencionalmente a reserva do cron, então funciona antes ou depois do
 * automático e pode ser repetido quando o coordenador quiser.
 */
export async function runDailyVerseSend({
  churchId,
  force = false,
}: { churchId?: string; force?: boolean } = {}): Promise<DailyVerseSendResult> {
  const segredo = await serverEnvAsync("CRON_SECRET");
  if (!segredo) return emptyResult("CRON_SECRET não configurado");

  const url = await serverEnvAsync("NEXT_PUBLIC_SUPABASE_URL");
  const publicKey =
    (await serverEnvAsync("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) ??
    (await serverEnvAsync("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
  if (!url || !publicKey) return emptyResult("supabase não configurado");

  const supabase = createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("versiculo_alvos", { p_secret: segredo });
  if (error) {
    console.error("runDailyVerseSend: versiculo_alvos falhou", error.message);
    return emptyResult(error.message);
  }

  let alvos = (data ?? []) as Alvo[];
  if (churchId) alvos = alvos.filter((alvo) => alvo.church_id === churchId);

  const elegiveis = new Set(alvos.map((alvo) => alvo.user_id)).size;
  const inscricoesTotal = alvos.length;
  if (inscricoesTotal === 0) {
    return {
      ok: true,
      igrejas: 0,
      enviados: 0,
      elegiveis: 0,
      inscricoes: 0,
      falhas: 0,
      motivo: "sem_alvos",
    };
  }

  const porIgreja = new Map<string, Alvo[]>();
  for (const alvo of alvos) {
    porIgreja.set(alvo.church_id, [...(porIgreja.get(alvo.church_id) ?? []), alvo]);
  }

  const hoje = todayInSaoPaulo();
  const usuariosEnviados = new Set<string>();
  let igrejas = 0;
  let falhas = 0;
  let textoIndisponivel = false;

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

    // O texto é resolvido antes da reserva do cron. Assim uma indisponibilidade
    // externa não consome o único disparo automático do dia sem ter o que enviar.
    const versiculo = await fetchVerseText({ reference: referencia, version: primeira.version });
    if (!versiculo) {
      textoIndisponivel = true;
      console.error("runDailyVerseSend: texto indisponível", referencia.label);
      continue;
    }

    if (!force) {
      const { data: reservou, error: erroReserva } = await supabase.rpc("versiculo_registrar", {
        p_secret: segredo,
        p_church_id: cId,
        p_theme: tema,
        p_reference: referencia.label,
      });
      if (erroReserva || reservou !== true) continue;
    }

    igrejas++;
    for (const inscricao of inscricoes) {
      const delivery = await sendWebPushDetailed(
        [{ endpoint: inscricao.endpoint, p256dh: inscricao.p256dh, auth: inscricao.auth }],
        {
          title: `Versículo do dia · ${versiculo.label}`,
          body: versiculo.text,
          url: `/${inscricao.church_slug}`,
          tag: "versiculo-do-dia",
        }
      );

      falhas += delivery.failed;
      if (delivery.accepted > 0) usuariosEnviados.add(inscricao.user_id);
    }
  }

  let motivo: DailyVerseSendReason | undefined;
  if (usuariosEnviados.size === 0) {
    if (textoIndisponivel) motivo = "texto_indisponivel";
    else if (elegiveis === 0) motivo = "sem_alvos";
    else motivo = "push_falhou";
  }

  return {
    ok: true,
    igrejas,
    enviados: usuariosEnviados.size,
    elegiveis,
    inscricoes: inscricoesTotal,
    falhas,
    motivo,
  };
}
