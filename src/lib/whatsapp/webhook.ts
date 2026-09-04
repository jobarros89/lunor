import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractInboundButtonPayload,
  normalizeWhatsAppPhone,
  parseAssignmentButtonPayload,
  sha256Hex,
} from "@/lib/whatsapp/core";

type MetaMessage = {
  id?: string;
  from?: string;
  type?: string;
  button?: { payload?: string; text?: string };
  interactive?: { button_reply?: { id?: string; title?: string } };
};

type MetaStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: { details?: string };
  }>;
};

type MetaWebhook = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaMessage[];
        statuses?: MetaStatus[];
      };
    }>;
  }>;
};

export async function processWhatsAppWebhook(payload: unknown): Promise<void> {
  const webhook = payload as MetaWebhook;
  for (const entry of webhook.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        await processIncomingMessage(message);
      }
      for (const status of change.value?.statuses ?? []) {
        await processDeliveryStatus(status);
      }
    }
  }
}

async function processIncomingMessage(message: MetaMessage): Promise<void> {
  if (!message.id) return;
  const phone = normalizeWhatsAppPhone(message.from);
  const sourceKey = phone ? await sha256Hex(phone) : null;
  const eventKey = `message:${message.id}`;
  if (!(await claimWebhookEvent(eventKey, sourceKey))) return;

  try {
    if (sourceKey && (await exceedsPerPhoneRate(sourceKey))) {
      await markWebhookProcessed(eventKey);
      return;
    }

    const parsed = parseAssignmentButtonPayload(extractInboundButtonPayload(message));
    if (!parsed || !phone) {
      await markWebhookProcessed(eventKey);
      return;
    }

    const admin = createAdminClient();
    const { data: waMessage } = await admin
      .from("whatsapp_messages")
      .select("id, church_id, assignment_id, user_id, phone_e164")
      .eq("id", parsed.messageId)
      .maybeSingle();

    if (!waMessage?.assignment_id || !waMessage.user_id || waMessage.phone_e164 !== phone) {
      await markWebhookProcessed(eventKey);
      return;
    }

    const { data: assignment } = await admin
      .from("assignments")
      .select("id, status")
      .eq("id", waMessage.assignment_id)
      .eq("church_id", waMessage.church_id)
      .eq("user_id", waMessage.user_id)
      .maybeSingle();

    if (!assignment || ["substituido", "presente", "ausente"].includes(assignment.status)) {
      await markWebhookProcessed(eventKey);
      return;
    }

    const now = new Date().toISOString();
    if (parsed.action === "confirm") {
      await admin
        .from("substitution_requests")
        .update({ status: "cancelada", resolved_at: now })
        .eq("assignment_id", assignment.id)
        .eq("requested_by", waMessage.user_id)
        .eq("status", "aberta");

      const { error } = await admin
        .from("assignments")
        .update({
          status: "confirmado",
          responded_at: now,
          response_note: "Confirmado via WhatsApp",
        })
        .eq("id", assignment.id);
      if (error) throw error;

      const { error: messageError } = await admin
        .from("whatsapp_messages")
        .update({
          status: "confirmed",
          responded_at: now,
          inbound_message_id: message.id,
          updated_at: now,
        })
        .eq("id", waMessage.id);
      if (messageError) throw messageError;
    } else {
      const { data: existing } = await admin
        .from("substitution_requests")
        .select("id")
        .eq("assignment_id", assignment.id)
        .eq("requested_by", waMessage.user_id)
        .eq("status", "aberta")
        .maybeSingle();

      if (!existing) {
        const { error: requestError } = await admin.from("substitution_requests").insert({
          church_id: waMessage.church_id,
          assignment_id: assignment.id,
          requested_by: waMessage.user_id,
          reason: "Não posso · resposta via WhatsApp",
        });
        if (requestError) throw requestError;
      }

      const { error } = await admin
        .from("assignments")
        .update({
          status: "substituicao_solicitada",
          responded_at: now,
          response_note: "Não posso · WhatsApp",
        })
        .eq("id", assignment.id);
      if (error) throw error;

      const { error: messageError } = await admin
        .from("whatsapp_messages")
        .update({
          status: "declined",
          responded_at: now,
          inbound_message_id: message.id,
          updated_at: now,
        })
        .eq("id", waMessage.id);
      if (messageError) throw messageError;
    }

    await markWebhookProcessed(eventKey);
  } catch (error) {
    console.error("whatsapp webhook: falha ao processar resposta", error);
    throw error;
  }
}

async function processDeliveryStatus(status: MetaStatus): Promise<void> {
  if (!status.id || !status.status) return;
  const eventKey = `status:${status.id}:${status.status}:${status.timestamp ?? ""}`;
  if (!(await claimWebhookEvent(eventKey, null))) return;

  try {
    const admin = createAdminClient();
    const { data: row } = await admin
      .from("whatsapp_messages")
      .select("id, status")
      .eq("wa_message_id", status.id)
      .maybeSingle();
    if (!row) {
      await markWebhookProcessed(eventKey);
      return;
    }

    const occurredAt = metaTimestamp(status.timestamp);
    const update: Record<string, string | null> = { updated_at: new Date().toISOString() };
    if (status.status === "sent") update.sent_at = occurredAt;
    if (status.status === "delivered") update.delivered_at = occurredAt;
    if (status.status === "read") update.read_at = occurredAt;
    if (status.status === "failed") {
      const failure = status.errors?.[0];
      update.failed_at = occurredAt;
      update.error_code = failure?.code ? String(failure.code) : "meta_failed";
      update.error_message =
        failure?.error_data?.details ?? failure?.message ?? failure?.title ?? "Falha reportada pela Meta";
    }

    if (!['confirmed', 'declined'].includes(row.status)) {
      if (["sent", "delivered", "read", "failed"].includes(status.status)) {
        update.status = status.status;
      }
    }

    const { error } = await admin.from("whatsapp_messages").update(update).eq("id", row.id);
    if (error) throw error;
    await markWebhookProcessed(eventKey);
  } catch (error) {
    console.error("whatsapp webhook: falha ao processar status", error);
    throw error;
  }
}

async function claimWebhookEvent(eventKey: string, sourceKey: string | null): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_webhook_events")
    .insert({ event_key: eventKey, source_key: sourceKey });
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

async function exceedsPerPhoneRate(sourceKey: string): Promise<boolean> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 1000).toISOString();
  const { count, error } = await admin
    .from("whatsapp_webhook_events")
    .select("event_key", { count: "exact", head: true })
    .eq("source_key", sourceKey)
    .gte("received_at", since);
  if (error) throw error;
  return (count ?? 0) > 5;
}

function metaTimestamp(value: string | undefined): string {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(seconds * 1000).toISOString();
  return new Date().toISOString();
}
