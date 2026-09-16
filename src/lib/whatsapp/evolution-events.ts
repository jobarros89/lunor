export type EvolutionMappedStatus = "sent" | "delivered" | "read" | "failed" | null;
export type EvolutionConnectionStatus = "connected" | "connecting" | "disconnected" | "error" | null;

export type EvolutionMessageUpdate = {
  event: string;
  instance: string;
  providerMessageId: string;
  providerStatus: string;
  status: EvolutionMappedStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type EvolutionConnectionUpdate = {
  event: string;
  instance: string;
  providerState: string;
  status: EvolutionConnectionStatus;
};

type UnknownRecord = Record<string, unknown>;

export function mapEvolutionMessageStatus(value: unknown): EvolutionMappedStatus {
  const status = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (status === "SERVER_ACK") return "sent";
  if (status === "DELIVERY_ACK") return "delivered";
  if (status === "READ" || status === "PLAYED") return "read";
  if (status === "ERROR") return "failed";
  return null;
}

export function mapEvolutionConnectionStatus(value: unknown): EvolutionConnectionStatus {
  const state = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (["open", "connected"].includes(state)) return "connected";
  if (["connecting", "qr"].includes(state)) return "connecting";
  if (["close", "closed", "disconnected"].includes(state)) return "disconnected";
  if (["error", "refused"].includes(state)) return "error";
  return null;
}

export function parseEvolutionMessageUpdate(payload: unknown): EvolutionMessageUpdate | null {
  const root = asRecord(payload);
  if (!root) return null;

  const event = normalizeEvent(stringValue(root.event));
  if (event !== "messages.update") return null;

  const instance = stringValue(root.instance);
  const data = asRecord(root.data);
  if (!instance || !data) return null;

  const key = asRecord(data.key);
  const update = asRecord(data.update);
  const providerMessageId =
    stringValue(data.keyId) ||
    stringValue(data.messageId) ||
    stringValue(data.id) ||
    stringValue(key?.id);
  const providerStatus = stringValue(data.status) || stringValue(update?.status);
  if (!providerMessageId || !providerStatus) return null;

  const error = asRecord(data.error) ?? asRecord(update?.error);
  return {
    event,
    instance,
    providerMessageId,
    providerStatus: providerStatus.toUpperCase(),
    status: mapEvolutionMessageStatus(providerStatus),
    errorCode: stringValue(error?.code) || null,
    errorMessage: stringValue(error?.message) || stringValue(data.message) || null,
  };
}

export function parseEvolutionConnectionUpdate(payload: unknown): EvolutionConnectionUpdate | null {
  const root = asRecord(payload);
  if (!root) return null;
  const event = normalizeEvent(stringValue(root.event));
  if (event !== "connection.update") return null;

  const instance = stringValue(root.instance);
  const data = asRecord(root.data);
  const providerState = stringValue(data?.state) || stringValue(data?.status) || stringValue(root.state);
  if (!instance || !providerState) return null;
  return { event, instance, providerState, status: mapEvolutionConnectionStatus(providerState) };
}

function normalizeEvent(value: string): string {
  return value.toLowerCase().replaceAll("_", ".");
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}
