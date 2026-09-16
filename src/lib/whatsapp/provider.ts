import "server-only";
import type {
  SendAssignmentInput,
  SendAssignmentResult,
  SendAvailabilityRequestInput,
  SendAvailabilityRequestResult,
  WhatsAppProviderName,
} from "@/lib/whatsapp/types";

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  assertConfigured(): void;
  sendAssignment(input: SendAssignmentInput): Promise<SendAssignmentResult>;
  sendAvailabilityRequest?(
    input: SendAvailabilityRequestInput
  ): Promise<SendAvailabilityRequestResult>;
}
