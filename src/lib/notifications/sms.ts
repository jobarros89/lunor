import "server-only";
import { normalizePhoneE164 } from "@/lib/phone";

export type SmsSendResult =
  | { status: "sent"; messageId: string | null }
  | { status: "unconfigured" }
  | { status: "invalid_phone" }
  | { status: "failed" };

export async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<SmsSendResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM_NUMBER?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();

  if (!accountSid || !authToken || (!from && !messagingServiceSid)) {
    return { status: "unconfigured" };
  }

  const normalized = normalizePhoneE164(to);
  if (!normalized) return { status: "invalid_phone" };

  try {
    const form = new URLSearchParams({
      To: normalized,
      Body: body.slice(0, 320),
    });
    if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
    else if (from) form.set("From", from);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: form.toString(),
      }
    );

    if (!response.ok) {
      console.error("sendSms: Twilio recusou o envio", response.status);
      return { status: "failed" };
    }

    const data = (await response.json().catch(() => null)) as { sid?: string } | null;
    return { status: "sent", messageId: data?.sid ?? null };
  } catch (error) {
    console.error(
      "sendSms: falha de transporte",
      error instanceof Error ? error.message : "unknown"
    );
    return { status: "failed" };
  }
}
