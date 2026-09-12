import "server-only";
import { createClient } from "@/lib/supabase/server";
import { notifyAvailabilityByEmail } from "@/lib/email/availability";
import { sendWebPush, type PushMessage, type PushTarget } from "./send";

async function notifyByPush(ids: string[], message: PushMessage): Promise<void> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_push_subscriptions", { p_user_ids: ids });
    if (error || !data) return;

    const staleIds = await sendWebPush(data as PushTarget[], message);
    if (staleIds.length > 0) {
      const { error: cleanupError } = await supabase.rpc("delete_stale_push_subscriptions", {
        p_subscription_ids: staleIds,
      });
      if (cleanupError) {
        console.warn("notifyUsers: não foi possível limpar inscrições expiradas");
      }
    }
  } catch (err) {
    console.error("notifyUsers/push: falha", err);
  }
}

/**
 * Notifica um conjunto de usuários em best-effort.
 * Push continua autorizado pela RPC SECURITY DEFINER no banco.
 * Solicitações de disponibilidade também recebem e-mail transacional via Resend.
 * Nenhuma falha de notificação pode quebrar a ação que a disparou.
 */
export async function notifyUsers(userIds: (string | null | undefined)[], message: PushMessage): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return;

  await Promise.allSettled([
    notifyByPush(ids, message),
    notifyAvailabilityByEmail(ids, message),
  ]);
}
