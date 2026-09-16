import "server-only";
import { serverEnv } from "@/lib/env";
import { buildAssignmentButtonPayload, normalizeWhatsAppPhone } from "@/lib/whatsapp/core";
import {
  markMessageFailed,
  markMessageSent,
  prepareAssignmentMessage,
} from "@/lib/whatsapp/message-store";
import type { WhatsAppProvider } from "@/lib/whatsapp/provider";
import type {
  SendAssignmentInput,
  SendAssignmentResult,
  WhatsAppMessageKind,
} from "@/lib/whatsapp/types";

export type { SendAssignmentResult, WhatsAppMessageKind } from "@/lib/whatsapp/types";

type MetaSendResponse = {
  messages?: Array<{ id?: string }>;
  error?: {
    code?: number;
    message?: string;
    error_data?: { details?: string };
  };
};

export const metaProvider: WhatsAppProvider = {
  name: "meta",
  assertConfigured: assertWhatsAppSendConfigured,
  sendAssignment: sendAssignmentWhatsApp,
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
  let messageId: string | null = null;
  try {
    const prepared = await prepareAssignmentMessage({
      churchId: input.churchId,
      eventId: input.eventId,
      ministryId: input.ministryId,
      assignmentId: input.assignmentId,
      userId: input.userId,
      phone,
      kind,
      provider: "meta",
      providerInstance: config.phoneNumberId,
      templateName: config.templateName,
    });
    messageId = prepared.messageId;
    if (prepared.skipped) {
      return { ok: true, skipped: true, reason: "already_sent", messageId };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao preparar envio do WhatsApp" };
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
          parameters: [{ type: "payload", payload: buildAssignmentButtonPayload("confirm", messageId) }],
        },
        {
          type: "button",
          sub_type: "quick_reply",
          index: "1",
          parameters: [{ type: "payload", payload: buildAssignmentButtonPayload("decline", messageId) }],
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
      await safeMarkFailed(messageId, String(payload.error?.code ?? response.status), detail);
      return { ok: false, error: detail };
    }

    await markMessageSent(messageId, waMessageId);
    return { ok: true, skipped: false, messageId, waMessageId };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Falha de rede ao chamar a Meta";
    await safeMarkFailed(messageId, "network_error", detail);
    return { ok: false, error: detail };
  }
}

function getSendConfig(kind: Exclude<WhatsAppMessageKind, "availability_request">) {
  const accessToken = serverEnv("WHATSAPP_ACCESS_TOKEN");
  const phoneNumberId = serverEnv("WHATSAPP_PHONE_NUMBER_ID");
  const graphVersion = serverEnv("WHATSAPP_GRAPH_API_VERSION") ?? "v26.0";
  const templateName =
    kind === "reminder_d1"
      ? serverEnv("WHATSAPP_TEMPLATE_REMINDER") ?? "escala_lembrete_d1"
      : serverEnv("WHATSAPP_TEMPLATE_ASSIGNMENT") ?? "escala_confirmacao";

  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp Cloud API ainda não configurada");
  return { accessToken, phoneNumberId, graphVersion, templateName };
}

async function safeMarkFailed(messageId: string, code: string, detail: string): Promise<void> {
  try {
    await markMessageFailed(messageId, code, detail);
  } catch {
    // O erro original do provider é mais importante; não o mascara com falha de auditoria.
  }
}
