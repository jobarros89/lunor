import "server-only";
import { serverEnv } from "@/lib/env";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp/core";
import { buildScheduleDeepLink } from "@/lib/whatsapp/links";
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
        return { ok: false, error: payload.message ?? payload.error ?? `Evolution HTTP ${response.status}` };
      }

      // Persistência/idempotência será centralizada no dispatcher para Meta e Evolution.
      return { ok: true, skipped: false, messageId: input.assignmentId, waMessageId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Falha de rede ao chamar a Evolution" };
    }
  },
};

function getConfig() {
  const baseUrl = serverEnv("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const apiKey = serverEnv("EVOLUTION_API_KEY");
  const instance = serverEnv("EVOLUTION_INSTANCE");
  if (!baseUrl || !apiKey || !instance) {
    throw new Error("Evolution API ainda não configurada");
  }
  return { baseUrl, apiKey, instance };
}
