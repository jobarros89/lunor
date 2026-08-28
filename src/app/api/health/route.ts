import { createClient } from "@/lib/supabase/server";

/**
 * Health check público para monitor de uptime.
 *
 * Expõe apenas disponibilidade do app/banco e latência. Detalhes de
 * configuração, credenciais e integrações ficam fora desta rota para não
 * oferecer informação de reconhecimento desnecessária a visitantes anônimos.
 */
export const dynamic = "force-dynamic";

const HEALTH_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET() {
  const started = Date.now();
  try {
    const supabase = await createClient();
    const { error } = await supabase
      .from("churches")
      .select("id", { count: "exact", head: true });

    if (error) {
      return Response.json(
        { status: "degraded", db: "error", ms: Date.now() - started },
        { status: 503, headers: HEALTH_HEADERS }
      );
    }

    return Response.json(
      { status: "ok", db: "ok", ms: Date.now() - started },
      { headers: HEALTH_HEADERS }
    );
  } catch {
    return Response.json(
      { status: "down", db: "unknown", ms: Date.now() - started },
      { status: 503, headers: HEALTH_HEADERS }
    );
  }
}
