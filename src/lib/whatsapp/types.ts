export type WhatsAppProviderName = "meta" | "evolution";

export type WhatsAppMessageKind =
  | "assignment_published"
  | "reminder_d1"
  | "availability_request";

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

export type SendAssignmentResult =
  | { ok: true; skipped: false; messageId: string; waMessageId: string }
  | {
      ok: true;
      skipped: true;
      reason: "already_sent" | "missing_phone";
      messageId?: string;
    }
  | { ok: false; error: string };
