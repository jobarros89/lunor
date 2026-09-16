import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WhatsAppMessageKind, WhatsAppProviderName } from "@/lib/whatsapp/types";

type PrepareMessageInput = {
  churchId: string;
  eventId: string;
  ministryId: string;
  assignmentId: string;
  userId: string;
  phone: string;
  kind: Exclude<WhatsAppMessageKind, "availability_request">;
  provider: WhatsAppProviderName;
  providerInstance?: string | null;
  templateName?: string | null;
};

export type PreparedMessage =
  | { skipped: true; reason: "already_sent"; messageId: string }
  | { skipped: false; messageId: string };

export async function prepareAssignmentMessage(input: PrepareMessageInput): Promise<PreparedMessage> {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("whatsapp_messages")
    .select("id, status")
    .eq("assignment_id", input.assignmentId)
    .eq("message_kind", input.kind)
    .maybeSingle();

  if (existingError) throw new Error("Não foi possível consultar o histórico do WhatsApp");
  if (existing && existing.status !== "failed") {
    return { skipped: true, reason: "already_sent", messageId: existing.id };
  }

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await admin
      .from("whatsapp_messages")
      .update({
        church_id: input.churchId,
        event_id: input.eventId,
        ministry_id: input.ministryId,
        user_id: input.userId,
        phone_e164: input.phone,
        provider: input.provider,
        provider_instance: input.providerInstance ?? null,
        template_name: input.templateName ?? null,
        status: "queued",
        wa_message_id: null,
        inbound_message_id: null,
        sent_at: null,
        delivered_at: null,
        read_at: null,
        responded_at: null,
        failed_at: null,
        error_code: null,
        error_message: null,
        updated_at: now,
      })
      .eq("id", existing.id);
    if (error) throw new Error("Não foi possível preparar nova tentativa no WhatsApp");
    return { skipped: false, messageId: existing.id };
  }

  const { data: created, error } = await admin
    .from("whatsapp_messages")
    .insert({
      church_id: input.churchId,
      event_id: input.eventId,
      ministry_id: input.ministryId,
      assignment_id: input.assignmentId,
      user_id: input.userId,
      phone_e164: input.phone,
      message_kind: input.kind,
      provider: input.provider,
      provider_instance: input.providerInstance ?? null,
      template_name: input.templateName ?? null,
      status: "queued",
    })
    .select("id")
    .single();

  if (error || !created) throw new Error("Não foi possível registrar o envio do WhatsApp");
  return { skipped: false, messageId: created.id };
}

export async function markProviderAccepted(messageId: string, providerMessageId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_messages")
    .update({ wa_message_id: providerMessageId, updated_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw new Error("Mensagem aceita pelo provider, mas o ID externo não foi salvo");
}

export async function markMessageSent(messageId: string, providerMessageId: string): Promise<void> {
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_messages")
    .update({ wa_message_id: providerMessageId, status: "sent", sent_at: now, updated_at: now })
    .eq("id", messageId);
  if (error) throw new Error("Mensagem aceita pelo provider, mas o status local não foi salvo");
}

export async function markMessageFailed(messageId: string, code: string, detail: string): Promise<void> {
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("whatsapp_messages")
    .update({
      status: "failed",
      failed_at: now,
      error_code: code.slice(0, 120),
      error_message: detail.slice(0, 1000),
      updated_at: now,
    })
    .eq("id", messageId);
  if (error) throw error;
}

export type EvolutionDeliveryStatus = "sent" | "delivered" | "read" | "failed";

export async function applyEvolutionDeliveryStatus(input: {
  instance: string;
  providerMessageId: string;
  status: EvolutionDeliveryStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data: row, error: readError } = await admin
    .from("whatsapp_messages")
    .select("id, status")
    .eq("provider", "evolution")
    .eq("provider_instance", input.instance)
    .eq("wa_message_id", input.providerMessageId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return false;
  if (["confirmed", "declined"].includes(row.status)) return true;

  const rank: Record<string, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };
  if (input.status !== "failed" && (rank[row.status] ?? -1) >= rank[input.status]) return true;

  const now = new Date().toISOString();
  const update: Record<string, string | null> = { status: input.status, updated_at: now };
  if (input.status === "sent") update.sent_at = now;
  if (input.status === "delivered") update.delivered_at = now;
  if (input.status === "read") update.read_at = now;
  if (input.status === "failed") {
    update.failed_at = now;
    update.error_code = input.errorCode?.slice(0, 120) ?? "evolution_error";
    update.error_message = input.errorMessage?.slice(0, 1000) ?? "Falha reportada pela Evolution";
  }

  const { error } = await admin.from("whatsapp_messages").update(update).eq("id", row.id);
  if (error) throw error;
  return true;
}
