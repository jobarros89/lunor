import { serverEnv } from "@/lib/env";
import { processEvolutionWebhook } from "@/lib/whatsapp/evolution-webhook";

export async function POST(request: Request): Promise<Response> {
  const expected = serverEnv("EVOLUTION_WEBHOOK_SECRET");
  if (!expected) return new Response("Not configured", { status: 503 });

  const url = new URL(request.url);
  const supplied =
    request.headers.get("x-lunor-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    url.searchParams.get("secret");
  if (!supplied || supplied !== expected) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    await processEvolutionWebhook(payload);
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch {
    // 5xx permite retry do provider. Eventos concluídos são deduplicados no banco.
    return new Response("Processing failed", { status: 500 });
  }
}
