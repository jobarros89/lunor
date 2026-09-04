export type AssignmentWhatsAppAction = "confirm" | "decline";

const ASSIGNMENT_PAYLOAD_PREFIX = "lunor:assignment";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeWhatsAppPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);

  // LUNOR V1 opera no Brasil: telefone salvo sem DDI recebe +55.
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 12 || digits.length > 15) return null;
  return digits;
}

export function buildAssignmentButtonPayload(
  action: AssignmentWhatsAppAction,
  messageId: string
): string {
  if (!UUID_RE.test(messageId)) throw new Error("WhatsApp message id inválido");
  return `${ASSIGNMENT_PAYLOAD_PREFIX}:${action}:${messageId}`;
}

export function parseAssignmentButtonPayload(
  value: string | null | undefined
): { action: AssignmentWhatsAppAction; messageId: string } | null {
  if (!value) return null;
  const [prefix, scope, action, messageId, extra] = value.split(":");
  if (prefix !== "lunor" || scope !== "assignment" || extra) return null;
  if (action !== "confirm" && action !== "decline") return null;
  if (!messageId || !UUID_RE.test(messageId)) return null;
  return { action, messageId };
}

export function extractInboundButtonPayload(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const data = message as {
    type?: string;
    button?: { payload?: unknown };
    interactive?: { button_reply?: { id?: unknown } };
  };

  if (data.type === "button" && typeof data.button?.payload === "string") {
    return data.button.payload;
  }
  if (
    data.type === "interactive" &&
    typeof data.interactive?.button_reply?.id === "string"
  ) {
    return data.interactive.button_reply.id;
  }
  return null;
}

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=") || !appSecret) return false;
  const supplied = signatureHeader.slice("sha256=".length).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(supplied)) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody)
  );
  const expected = bytesToHex(new Uint8Array(signature));
  return constantTimeEqual(expected, supplied);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
