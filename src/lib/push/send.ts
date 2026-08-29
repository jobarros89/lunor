import "server-only";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { serverEnv } from "@/lib/env";

export type PushTarget = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/**
 * Envia uma notificação Web Push para os alvos (best-effort).
 * Roda no runtime do Worker via WebCrypto (o `web-push` do Node não funciona lá).
 * Assina com a chave privada VAPID (secret de runtime).
 * Retorna somente ids de inscrições que o provedor confirmou como expiradas
 * (HTTP 404/410), para limpeza posterior no banco.
 */
export async function sendWebPush(targets: PushTarget[], message: PushMessage): Promise<string[]> {
  if (targets.length === 0) return [];
  const publicKey = serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = serverEnv("VAPID_PRIVATE_KEY");
  const subject = serverEnv("VAPID_SUBJECT") ?? "mailto:contato@lunorservice.com";
  if (!publicKey || !privateKey) {
    console.warn("sendWebPush: chaves VAPID ausentes — notificação ignorada");
    return [];
  }
  const vapid = { subject, publicKey, privateKey };

  const results = await Promise.all(
    targets.map(async (t) => {
      const subscription = {
        endpoint: t.endpoint,
        expirationTime: null,
        keys: { p256dh: t.p256dh, auth: t.auth },
      };
      const data: Record<string, string> = { title: message.title, body: message.body };
      if (message.url) data.url = message.url;
      if (message.tag) data.tag = message.tag;
      try {
        const payload = await buildPushPayload(
          { data, options: { ttl: 60 * 60 * 24, urgency: "normal" } },
          subscription,
          vapid
        );
        const res = await fetch(subscription.endpoint, {
          method: payload.method,
          headers: payload.headers,
          body: payload.body as BodyInit,
        });
        if (res.status === 404 || res.status === 410) {
          return t.id;
        }
        if (!res.ok) {
          console.warn("sendWebPush: provedor recusou notificação", res.status);
        }
      } catch (err) {
        console.error("sendWebPush: falha ao enviar", err);
      }
      return null;
    })
  );

  return results.filter((id): id is string => !!id);
}
