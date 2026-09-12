import "server-only";

import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PushMessage } from "@/lib/push/send";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_APP_URL = "https://lunorservice.com";
const FROM = "LUNOR <notificacoes@send.lunorservice.com>";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function assignmentIdFromTag(tag?: string) {
  if (!tag?.startsWith("assignment-")) return null;
  return tag.slice("assignment-".length) || null;
}

/** Envia e-mail de nova escala em best-effort. Nunca deve quebrar a ação principal. */
export async function notifyAssignmentByEmail(
  userIds: string[],
  message: PushMessage
): Promise<void> {
  const assignmentId = assignmentIdFromTag(message.tag);
  if (!assignmentId || userIds.length === 0) return;

  const apiKey = serverEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("notifyAssignmentByEmail: RESEND_API_KEY não configurada");
    return;
  }

  try {
    const admin = createAdminClient();
    const recipients = await Promise.allSettled(
      userIds.map(async (userId) => {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error) throw error;
        return { userId, email: data.user?.email ?? null };
      })
    );
    const emails = recipients.flatMap((result) =>
      result.status === "fulfilled" && result.value.email ? [result.value] : []
    );
    if (emails.length === 0) return;

    const appUrl = (serverEnv("NEXT_PUBLIC_APP_URL") ?? DEFAULT_APP_URL).replace(/\/$/, "");
    const path = message.url ?? "/";
    const actionUrl = `${appUrl}${path.startsWith("/") ? path : `/${path}`}`;
    const safeBody = escapeHtml(message.body || "Você recebeu uma nova escala.").replaceAll("\n", "<br>");

    await Promise.allSettled(
      emails.map(async ({ userId, email }) => {
        const response = await fetch(RESEND_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `assignment/${assignmentId}/${userId}`,
          },
          body: JSON.stringify({
            from: FROM,
            to: [email],
            subject: "LUNOR — você foi escalado 🙌",
            text: `${message.title}\n\n${message.body}\n\nVer minha escala: ${actionUrl}`,
            html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f8;margin:0;padding:32px 16px;color:#171717"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px"><tr><td style="padding:32px"><p style="font-size:13px;line-height:20px;color:#737373;margin:0 0 12px">LUNOR · Presença · preparo · propósito</p><h1 style="font-size:24px;line-height:32px;color:#171717;margin:0 0 12px">Você foi escalado 🙌</h1><p style="font-size:16px;line-height:25px;color:#404040;margin:0 0 24px">${safeBody}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#171717" style="background-color:#171717;border-radius:10px"><a href="${actionUrl}" style="display:inline-block;padding:12px 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#ffffff;text-decoration:none">Ver minha escala</a></td></tr></table></td></tr></table></td></tr></table></body></html>`,
            tags: [
              { name: "type", value: "assignment_created" },
              { name: "assignment_id", value: assignmentId },
            ],
          }),
        });
        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          throw new Error(`Resend ${response.status}: ${detail.slice(0, 300)}`);
        }
      })
    ).then((results) => {
      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) console.warn(`notifyAssignmentByEmail: ${failures.length} envio(s) falharam`);
    });
  } catch (error) {
    console.error("notifyAssignmentByEmail: falha", error);
  }
}
