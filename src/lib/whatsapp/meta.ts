import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAssignmentButtonPayload,
  normalizeWhatsAppPhone,
} from "@/lib/whatsapp/core";

export type WhatsAppMessageKind = "assignment_published" | "reminder_d1";

type SendAssignmentInput = {
  churchId: string;
  eventId: string;
  ministryId: string;
  assignmentId: string;
  userId: string;
  volunteerName: string;
  phone: string | null;
  roleName: string;
  eventTitle: string;
  startsAt: string;
  kind?: WhatsAppMessageKind;
};

export type SendAssignmentResult =
  | { ok: true; skipped: false; messageId: string; waMessageId: string }
  | { ok: true; skipped: true; reason: "already_sent" | "missing_phone"; messageId?: string }
  | { ok: false; error: string };

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    code?: number;
    message?: string;
    error_data?: { details?: string };
  };
};

export function assertWhatsAppSendConfigured(): void {
  if (!serverEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    throw new Error("WhatsApp Cloud API ainda não configurada");
  }
  getSendConfig("assignment_published");
}

export async function sendAssignmentWhatsApp(
  input: SendAssignmentInput
): Promise<SendAssignmentResult> {
  const kind = input.kind ?? "assignment_published";
  const phone = normalizeWhatsAppPhone(input.phone);
  if (!phone) return { ok: true, skipped: true, reason: "missing_phone" };

  const config = getSendConfig(kind);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("whatsapp_messages")
    .select("id, status, wa_message_id")
    .eq("assignment_id", input.assignmentId)
    .eq("message_kind", kind)
    .maybeSingle();

  if (existingError) return { ok: false, error: "Não foi possível consultar o histórico do WhatsApp" };
  if (existing && existing.status !== "failed") {
    return {
      ok: true,
      skipped: true,
      reason: "already_sent",
      messageId: existing.id,
    };
  }

  let messageId = existing?.id ?? null;
  if (messageId) {
    const { error } = await admin
      .from("whatsapp_messages")
      .update({
        phone_e164: phone,
        template_name: config.templateName,
        status: "queued",
        wa_message_id: null,
        error_code: null,
        error_message: null,
        failed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", messageId);
    if (error) return { ok: false, error: "Não foi possível preparar nova tentativa no WhatsApp" };
  } else {
    const { data: created, error } = await admin
      .from("whatsapp_messages")
      .insert({
        church_id: input.churchId,
        event_id: input.eventId,
        ministry_id: input.ministryId,
        assignment_id: input.assignmentId,
        user_id: input.userId,
        phone_e164: phone,
        message_kind: kind,
        template_name: config.templateName,
        status: "queued",
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: "Não foi possível registrar o envio do WhatsApp" };
    }
    messageId = created.id;
  }

  const when = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(input.startsAt));

  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: config.templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.volunteerName },
            { type: "text", text: `${input.roleName} · ${input.eventTitle}` },
            { type: "text", text: when },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "0",
          parameters: [
            {
              type: "payload",
              payload: buildAssignmentButtonPayload("confirm", messageId),
            },
          ],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [
            {
              type: "payload",
              payload: buildAssignmentButtonPayload("decline", messageId),
            },
          ],
        },
      ],
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );
    const payload = (await response.json().catch(() => ({}))) as MetaSendResponse;
    const waMessageId = payload.messages?.[0]?.id;

    if (!response.ok || !waMessageId) {
      const detail = payload.error?.error_data?.details ?? payload.error?.message ?? `HTTP ${response.status}`;
      await markFailed(messageId, String(payload.error?.code ?? response.status), detail);
      return { ok: false, error: detail };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("whatsapp_messages")
      .update({
        wa_message_id: waMessageId,
        status: "sent",
        sent_at: now,
        updated_at: now,
      })
      .eq("id", messageId);
    if (updateError) {
      return { ok: false, error: "Mensagem aceita pela Meta, mas o status local não foi salvo" };
    }

    return { ok: true, skipped: false, messageId, waMessageId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha de rede ao chamar a Meta";
    await markFailed(messageId, "network_error", detail);
    return { ok: false, error: detail };
  }
}

function getSendConfig(kind: WhatsAppMessageKind) {
  const accessToken = serverEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = serverEnv("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = serverEnv("WHATSAPP_GRAPH_API_VERSION") ?? "v26.0";
  const templateName =
    kind === "reminder_d1"
      ? serverEnv("WHATSAPP_TEMPLATE_REMINDER") ?? "escala_lembrete_d1"
      : serverEnv("WHATSAPP_TEMPLATE_ASSIGNMENT") ?? "escala_confirmacao";

  if (!accessToken || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API ainda não configurada");
  }
  return { accessToken, phoneNumberId, graphVersion, templateName };
}

async function markFailed(messageId: string, code: string, detail: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const now = new Date().toISOString();
    await admin
      .from("whatsapp_messages")
      .update({
        status: "failed",
        failed_at: now,
        error_code: code.slice(0, 120),
        error_message: detail.slice(0, 1000),
        updated_at: now,
      })
      .eq("id", messageId);
  } catch {
    // O erro original do envio é mais importante; não mascara com falha de auditoria.
  }
}
