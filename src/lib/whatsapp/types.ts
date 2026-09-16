export type WhatsAppProviderName = "meta" | "evolution";

export type WhatsAppMessageKind =
  | "assignment_published"
  | "reminder_d1"
  | "availability_request";

export type SendWhatsAppResult =
  | { ok: true; skipped: false; messageId: string; waMessageId: string }
  | {
      ok: true;
      skipped: true;
      reason: "already_sent" | "missing_phone" | "unsupported";
      messageId?: string;
    }
  | { ok: false; error: string };

export type SendAssignmentInput = {
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
  churchSlug?: string;
  kind?: Exclude<WhatsAppMessageKind, "availability_request">;
};

export type SendAvailabilityRequestInput = {
  churchId: string;
  ministryId: string;
  requestId: string;
  userId: string;
  volunteerName: string;
  phone: string | null;
  ministryName: string;
  title: string;
  respondBy: string | null;
  churchSlug: string;
};

export type SendAssignmentResult = SendWhatsAppResult;
export type SendAvailabilityRequestResult = SendWhatsAppResult;
