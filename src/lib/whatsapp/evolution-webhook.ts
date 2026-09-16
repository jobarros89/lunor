import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parseEvolutionConnectionUpdate,
  parseEvolutionMessageUpdate,
} from "@/lib/whatsapp/evolution-events";
import { applyEvolutionDeliveryStatus } from "@/lib/whatsapp/message-store";

export async function processEvolutionWebhook(payload: unknown): Promise<void> {
  const messageUpdate = parseEvolutionMessageUpdate(payload);
  if (messageUpdate) {
    const eventKey = [
      "evolution",
      messageUpdate.instance,
      messageUpdate.event,
      messageUpdate.providerMessageId,
      messageUpdate.providerStatus,
    ].join(":");
    if (!(await claimWebhookEvent(eventKey))) return;

    try {
      if (messageUpdate.status) {
        await applyEvolutionDeliveryStatus({
          instance: messageUpdate.instance,
          providerMessageId: messageUpdate.providerMessageId,
          status: messageUpdate.status,
          errorCode: messageUpdate.errorCode,
          errorMessage: messageUpdate.errorMessage,
        });
      }
      await markWebhookProcessed(eventKey);
      return;
    } catch (error) {
      console.error("evolution webhook: falha ao processar status", error);
      throw error;
    }
  }

  const connectionUpdate = parseEvolutionConnectionUpdate(payload);
  if (connectionUpdate) {
    const eventKey = [
      "evolution",
      connectionUpdate.instance,
      connectionUpdate.event,
      connectionUpdate.providerState,
    ].join(":");
    if (!(await claimWebhookEvent(eventKey))) return;

    try {
      if (connectionUpdate.status) {
        const admin = createAdminClient();
        const now = new Date().toISOString();
        const update: Record<string, string | null> = {
          status: connectionUpdate.status,
          last_event_at: now,
          updated_at: now,
        };
        if (connectionUpdate.status === "connected") update.connected_at = now;
        const { error } = await admin
          .from("whatsapp_connections")
          .update(update)
          .eq("provider", "evolution")
          .eq("provider_instance", connectionUpdate.instance);
        if (error) throw error;
      }
      await markWebhookProcessed(eventKey);
    } catch (error) {
      console.error("evolution webhook: falha ao processar conexão", error);
      throw error;
    }
  }
}

async function claimWebhookEvent(eventKey: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("whatsapp_webhook_events").insert({ event_key: eventKey });
  if (!error) return true;
  if (error.code !== "23505") throw error;

  const { data: existing, error: readError } = await admin
    .from("whatsapp_webhook_events")
    .select("processed_at")
    .eq("event_key", eventKey)
    .maybeSingle();
  if (readError) throw readError;
  return !existing?.processed_at;
}

async function markWebhookProcessed(eventKey: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("event_key", eventKey);
  if (error) throw error;
}
