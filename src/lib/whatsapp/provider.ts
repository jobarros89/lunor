import "server-only";
import type { SendAssignmentInput, SendAssignmentResult, WhatsAppProviderName } from "@/lib/whatsapp/types";

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  assertConfigured(): void;
  sendAssignment(input: SendAssignmentInput): Promise<SendAssignmentResult>;
}
