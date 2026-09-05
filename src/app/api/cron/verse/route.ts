import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";
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

/**
 * Versículo diário das igrejas que ativaram o recurso.
 *
 * Mesmo desenho de segurança de /api/cron: chave anon (nunca service role)
 * e prova de identidade pelo CRON_SECRET, que as RPCs SECURITY DEFINER
 * também exigem. 404 em vez de 401 para não confirmar o endpoint a quem sonda.
 *
 * O texto bíblico nunca é gerado nem armazenado aqui: vem da API na tradução
 * configurada pela igreja. O banco guarda só a referência, para o rodízio.
 */
export async function POST(request: Request): Promise<Response> {
  const segredo = serverEnv("CRON_SECRET");
  if (!segredo || request.headers.get("x-cron-secret") !== segredo) {
    return new Response("Not found", { status: 404 });
  }

  const url = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anon) {
    return Response.json({ ok: false, erro: "supabase não configurado" }, { status: 500 });
  }

  const supabase = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("versiculo_alvos", { p_secret: segredo });
  if (error) {
    console.error("cron/verse: RPC falhou", error.message);
    return Response.json({ ok: false, erro: error.message }, { status: 500 });
  }

  const alvos = (data ?? []) as Alvo[];
  const porIgreja = new Map<string, Alvo[]>();
  for (const alvo of alvos) {
    porIgreja.set(alvo.church_id, [...(porIgreja.get(alvo.church_id) ?? []), alvo]);
  }

  const hoje = new Date().toISOString().slice(0, 10);
  let igrejas = 0;
  let enviados = 0;

  for (const [churchId, inscricoes] of porIgreja) {
    const primeira = inscricoes[0];
    const tema =
      primeira.fixed_theme && isVerseTheme(primeira.fixed_theme)
        ? primeira.fixed_theme
        : rotateTheme(hoje);

    const referencia = selectDailyVerse({
      theme: tema,
      churchId,
      date: hoje,
      recentLabels: primeira.recent_references ?? [],
    });

    // Reserva o dia antes de enviar: se duas execuções coincidirem, só uma
    // passa daqui. Preferimos não enviar a enviar duas vezes.
    const { data: reservou, error: erroReserva } = await supabase.rpc("versiculo_registrar", {
      p_secret: segredo,
      p_church_id: churchId,
      p_theme: tema,
      p_reference: referencia.label,
    });
    if (erroReserva || reservou !== true) continue;

    const versiculo = await fetchVerseText({ reference: referencia, version: primeira.version });
    if (!versiculo) {
      console.error("cron/verse: texto indisponível", referencia.label);
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
        console.error("cron/verse: push falhou", err);
      }
    }
  }

  return Response.json({ ok: true, igrejas, enviados });
}
