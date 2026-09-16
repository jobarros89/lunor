import { serverEnv } from "@/lib/env";

export async function POST(request: Request): Promise<Response> {
  const expected = serverEnv("EVOLUTION_WEBHOOK_SECRET");
  if (!expected) return new Response("Not configured", { status: 503 });

  const supplied = request.headers.get("x-lunor-webhook-secret");
  if (!supplied || supplied !== expected) return new Response("Unauthorized", { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  // Endpoint separado do webhook Meta. O processamento dos eventos Evolution
  // será ativado apenas para eventos necessários pelo LUNOR; payloads desconhecidos
  // são aceitos sem alterar estado para evitar acoplamento ao formato do provider.
  void payload;
  return new Response("EVENT_RECEIVED", { status: 200 });
}
