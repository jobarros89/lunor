import "server-only";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { serverEnv } from "@/lib/env";

export type PushTarget = { id?: string; endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export type PushDeliveryResult = {
  staleIds: string[];
  accepted: number;
  failed: number;
};

/**
 * Envia Web Push e informa quantas inscrições foram efetivamente aceitas pelo
 * provedor. 404/410 continuam sendo devolvidos como staleIds para limpeza.
 */
export async function sendWebPushDetailed(
  targets: PushTarget[],
  message: PushMessage
): Promise<PushDeliveryResult> {
  if (targets.length === 0) return { staleIds: [], accepted: 0, failed: 0 };

  const publicKey = serverEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privateKey = serverEnv("VAPID_PRIVATE_KEY");
  const subject = serverEnv("VAPID_SUBJECT") ?? "mailto:contato@lunorservice.com";
  if (!publicKey || !privateKey) {
    console.warn("sendWebPush: chaves VAPID ausentes — notificação ignorada");
    return { staleIds: [], accepted: 0, failed: targets.length };
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

        if (res.ok) return { accepted: true, staleId: null as string | null };
        if ((res.status === 404 || res.status === 410) && t.id) {
          return { accepted: false, staleId: t.id };
        }

        console.warn("sendWebPush: provedor recusou notificação", res.status);
        return { accepted: false, staleId: null as string | null };
      } catch (err) {
        console.error("sendWebPush: falha ao enviar", err);
        return { accepted: false, staleId: null as string | null };
      }
    })
  );

  const staleIds = results
    .map((result) => result.staleId)
    .filter((id): id is string => !!id);
  const accepted = results.filter((result) => result.accepted).length;

  return {
    staleIds,
    accepted,
    failed: results.length - accepted,
  };
}

/**
 * API compatível com os chamadores existentes: retorna somente inscrições
 * expiradas. Novos fluxos que precisam confirmar entrega usam a versão detalhada.
 */
export async function sendWebPush(targets: PushTarget[], message: PushMessage): Promise<string[]> {
  const result = await sendWebPushDetailed(targets, message);
  return result.staleIds;
}
