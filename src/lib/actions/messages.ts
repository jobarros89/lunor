"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyUsers } from "@/lib/push/notify";
import type { ActionResult } from "./types";

const sendSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  ministryId: z.string().uuid().nullable(),
  recipientUserId: z.string().uuid(),
  body: z.string().trim().min(1).max(1000),
});

const readSchema = z.object({
  churchSlug: z.string().min(2),
  churchId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).min(1).max(100),
});

export async function sendMemberMessage(
  raw: unknown,
): Promise<ActionResult<{ messageId: string }>> {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Mensagem inválida" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { data: messageId, error } = await supabase.rpc("send_inbox_message", {
    p_church: d.churchId,
    p_ministry: d.ministryId,
    p_recipient: d.recipientUserId,
    p_body: d.body,
  });

  if (error || !messageId) {
    console.error("sendMemberMessage:", error?.message);
    return {
      ok: false,
      error:
        error?.message === "message_not_allowed"
          ? "Você não tem permissão para enviar mensagem para essa pessoa."
          : "Não foi possível enviar a mensagem.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  await notifyUsers([d.recipientUserId], {
    title: "Nova mensagem no LUNOR",
    body: `${profile?.full_name || "Sua liderança"}: ${d.body.slice(0, 180)}`,
    url: `/${d.churchSlug}/mensagens`,
    tag: `inbox-message-${messageId}`,
  });

  revalidatePath(`/${d.churchSlug}/mensagens`);
  return { ok: true, data: { messageId: messageId as string } };
}

export async function markInboxMessagesRead(raw: unknown): Promise<ActionResult> {
  const parsed = readSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Mensagens inválidas" };
  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  const { error } = await supabase
    .from("inbox_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("church_id", d.churchId)
    .eq("recipient_id", user.id)
    .in("id", d.messageIds)
    .is("read_at", null);

  if (error) {
    console.error("markInboxMessagesRead:", error.message);
    return { ok: false, error: "Não foi possível atualizar as mensagens." };
  }

  revalidatePath(`/${d.churchSlug}/mensagens`);
  revalidatePath(`/${d.churchSlug}`);
  return { ok: true, data: undefined };
}
