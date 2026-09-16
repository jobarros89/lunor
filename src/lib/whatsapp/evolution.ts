import "server-only";
import { serverEnv } from "@/lib/env";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/core";
import { buildScheduleDeepLink } from "@/lib/whatsapp/links";
import {
  markMessageFailed,
  markProviderAccepted,
  prepareAssignmentMessage,
} from "@/lib/whatsapp/message-store";
import type { WhatsAppProvider } from "@/lib/whatsapp/provider";
import type { SendAssignmentInput, SendAssignmentResult } from "@/lib/whatsapp/types";

export const evolutionProvider: WhatsAppProvider = {
  name: "evolution",
  assertConfigured() {
    getConfig();
  },
  async sendAssignment(input: SendAssignmentInput): Promise<SendAssignmentResult> {
    const phone = normalizeWhatsAppPhone(input.phone);
    if (!phone) return { ok: true, skipped: true, reason: "missing_phone" };

    const config = getConfig();
    const kind = input.kind ?? "assignment_published";
    let messageId: string;
    try {
      const prepared = await prepareAssignmentMessage({
        churchId: input.churchId,
        eventId: input.eventId,
        ministryId: input.ministryId,
        assignmentId: input.assignmentId,
        userId: input.userId,
        phone,
        kind,
        provider: "evolution",
        providerInstance: config.instance,
        templateName: null,
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
    const link = input.churchSlug ? buildScheduleDeepLink(input.churchSlug, input.eventId) : null;
    const text = [
      `Olá, ${input.volunteerName}! Você foi escalado no LUNOR.`,
      `${input.roleName} · ${input.eventTitle}`,
      when,
      link ? `Abra sua escala: ${link}` : null,
    ].filter(Boolean).join("\n");

    try {
      const response = await fetch(`${config.baseUrl}/message/sendText/${encodeURIComponent(config.instance)}`, {
        method: "POST",
        headers: {
          apikey: config.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ number: phone, text }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        key?: { id?: string };
        messageId?: string;
        id?: string;
        error?: string;
        message?: string;
      };
      const waMessageId = payload.key?.id ?? payload.messageId ?? payload.id;
      if (!response.ok || !waMessageId) {
        const detail = payload.message ?? payload.error ?? `Evolution HTTP ${response.status}`;
        await safeMarkFailed(messageId, String(response.status), detail);
        return { ok: false, error: detail };
      }

      // HTTP aceito não significa entrega. Mantém status local como queued e
      // deixa MESSAGES_UPDATE promover para sent/delivered/read.
      try {
        await markProviderAccepted(messageId, waMessageId);
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Evolution aceitou a mensagem, mas o ID externo não foi salvo",
        };
      }
      return { ok: true, skipped: false, messageId, waMessageId };
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Falha de rede ao chamar a Evolution";
      await safeMarkFailed(messageId, "network_error", detail);
      return { ok: false, error: detail };
    }
  },
};

function getConfig() {
  const baseUrl = serverEnv("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const apiKey = serverEnv("EVOLUTION_API_KEY");
  const instance = serverEnv("EVOLUTION_INSTANCE");
  if (!baseUrl || !apiKey || !instance) throw new Error("Evolution API ainda não configurada");
  return { baseUrl, apiKey, instance };
}

async function safeMarkFailed(messageId: string, code: string, detail: string): Promise<void> {
  try {
    await markMessageFailed(messageId, code, detail);
  } catch {
    // Preserva o erro original do provider.
  }
}
