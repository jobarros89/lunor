import { serverEnv } from "@/lib/env";
import { verifyMetaSignature } from "@/lib/whatsapp/core";
import { processWhatsAppWebhook } from "@/lib/whatsapp/webhook";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = serverEnv("WHATSAPP_VERIFY_TOKEN");

  if (mode === "subscribe" && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  const appSecret = serverEnv("WHATSAPP_APP_SECRET");
  if (!appSecret) return new Response("Not configured", { status: 503 });

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!(await verifyMetaSignature(rawBody, signature, appSecret))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  try {
    await processWhatsAppWebhook(payload);
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch {
    // 5xx faz a Meta tentar novamente. Eventos concluídos são deduplicados no banco.
    return new Response("Processing failed", { status: 500 });
  }
}
