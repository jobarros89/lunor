import "server-only";
import { createClient } from "@/lib/supabase/server";
import { notifyAvailabilityByEmail } from "@/lib/email/availability";
import { notifyAssignmentByEmail } from "@/lib/email/assignment";
import { sendWebPush, type PushMessage, type PushTarget } from "./send";

async function enrichAssignmentMessage(message: PushMessage): Promise<PushMessage> {
  if (!message.tag?.startsWith("assign-")) return message;
  const eventId = message.tag.slice("assign-".length);
  if (!eventId) return message;

  try {
    const supabase = await createClient();
    const { data: event } = await supabase.from("events").select("starts_at").eq("id", eventId).maybeSingle();
    if (!event?.starts_at) return message;

    const startsAt = new Date(event.starts_at);
    const date = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      timeZone: "America/Sao_Paulo",
    }).format(startsAt);
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Sao_Paulo",
    }).format(startsAt);
    const label = `${date.charAt(0).toUpperCase()}${date.slice(1)} · ${time}`;
    return { ...message, body: `${message.body}\n${label}` };
  } catch (error) {
    console.warn("notifyUsers: não foi possível enriquecer data/hora da escala", error);
    return message;
  }
}

async function notifyByPush(ids: string[], message: PushMessage): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_push_subscriptions", { p_user_ids: ids });
    if (error || !data) return;
    const staleIds = await sendWebPush(data as PushTarget[], message);
    if (staleIds.length > 0) {
      const { error: cleanupError } = await supabase.rpc("delete_stale_push_subscriptions", { p_subscription_ids: staleIds });
      if (cleanupError) console.warn("notifyUsers: não foi possível limpar inscrições expiradas");
    }
  } catch (err) {
    console.error("notifyUsers/push: falha", err);
  }
}

export async function notifyUsers(userIds: (string | null | undefined)[], message: PushMessage): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;
  const enrichedMessage = await enrichAssignmentMessage(message);
  await Promise.allSettled([
    notifyByPush(ids, enrichedMessage),
    notifyAvailabilityByEmail(ids, enrichedMessage),
    notifyAssignmentByEmail(ids, enrichedMessage),
  ]);
}
