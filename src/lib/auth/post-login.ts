import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const INVITE_COOKIE = "lunor_invite";
const SIGNUP_INTENT_COOKIE = "lunor_signup_intent";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function resolveAuthenticatedDestination(
  supabase: SupabaseServerClient,
  fallbackPath = "/"
): Promise<string> {
  const cookieStore = await cookies();
  const inviteCode = cookieStore.get(INVITE_COOKIE)?.value;

  if (inviteCode) {
    const { data, error } = await supabase.rpc("join_church", {
      p_invite_code: inviteCode.toLowerCase(),
    });

    if (!error && data) {
      cookieStore.delete(INVITE_COOKIE);
      cookieStore.delete(SIGNUP_INTENT_COOKIE);
      return `/onboarding?igreja=${data}`;
    }
  }

  const intent = cookieStore.get(SIGNUP_INTENT_COOKIE)?.value;
  if (intent) {
    cookieStore.delete(SIGNUP_INTENT_COOKIE);
    if (intent === "criar") return "/comecar?intencao=criar";
    if (intent === "entrar" || intent === "convite") {
      return "/comecar?intencao=entrar";
    }
    return "/comecar";
  }

  return fallbackPath;
}
