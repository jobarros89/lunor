import { serverEnv } from "@/lib/env";
import { runDailyVerseSend } from "@/lib/bible/send-daily-verse";

/**
 * Versículo diário das igrejas que ativaram o recurso.
 *
 * Mesmo desenho de segurança de /api/cron: chave anon (nunca service role)
 * e prova de identidade pelo CRON_SECRET, que as RPCs SECURITY DEFINER
 * também exigem. 404 em vez de 401 para não confirmar o endpoint a quem sonda.
 *
 * A lógica de envio em si vive em src/lib/bible/send-daily-verse.ts,
 * compartilhada com o botão "Enviar agora" do admin.
 */
export async function POST(request: Request): Promise<Response> {
  const segredo = serverEnv("CRON_SECRET");
  if (!segredo || request.headers.get("x-cron-secret") !== segredo) {
    return new Response("Not found", { status: 404 });
  }

  const resultado = await runDailyVerseSend();
  if (!resultado.ok) {
    return Response.json({ ok: false, erro: resultado.erro }, { status: 500 });
  }

  return Response.json({ ok: true, igrejas: resultado.igrejas, enviados: resultado.enviados });
}
