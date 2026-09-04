import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildAssignmentButtonPayload,
  extractInboundButtonPayload,
  normalizeWhatsAppPhone,
  parseAssignmentButtonPayload,
  verifyMetaSignature,
} from "../../src/lib/whatsapp/core";

const messageId = "0d2d84be-b943-4a25-a443-6f92be7ddf8a";

describe("WhatsApp core", () => {
  it("normaliza telefones brasileiros para DDI 55", () => {
    expect(normalizeWhatsAppPhone("(21) 98115-9410")).toBe("5521981159410");
    expect(normalizeWhatsAppPhone("+55 21 98115-9410")).toBe("5521981159410");
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("gera e valida payload opaco de resposta", () => {
    const payload = buildAssignmentButtonPayload("confirm", messageId);
    expect(payload).toBe(`lunor:assignment:confirm:${messageId}`);
    expect(parseAssignmentButtonPayload(payload)).toEqual({
      action: "confirm",
      messageId,
    });
    expect(parseAssignmentButtonPayload("Confirmar")).toBeNull();
  });

  it("aceita callback de quick reply de template e interactive", () => {
    const payload = buildAssignmentButtonPayload("decline", messageId);
    expect(extractInboundButtonPayload({ type: "button", button: { payload } })).toBe(payload);
    expect(
      extractInboundButtonPayload({
        type: "interactive",
        interactive: { button_reply: { id: payload } },
      })
    ).toBe(payload);
  });

  it("valida X-Hub-Signature-256 com HMAC SHA-256", async () => {
    const secret = "meta-app-secret-test";
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    await expect(verifyMetaSignature(body, `sha256=${signature}`, secret)).resolves.toBe(true);
    await expect(verifyMetaSignature(`${body}x`, `sha256=${signature}`, secret)).resolves.toBe(false);
  });
});
