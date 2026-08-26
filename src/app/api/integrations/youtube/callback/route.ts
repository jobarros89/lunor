import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  encryptIntegrationSecret,
  hashOAuthState,
} from "@/lib/integrations/crypto";
import {
  exchangeYouTubeCode,
  getYouTubeChannel,
  YOUTUBE_SCOPE,
} from "@/lib/integrations/youtube";

function redirectWithStatus(request: NextRequest, path: string, status: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("youtube", status);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code || !state || request.nextUrl.searchParams.has("error")) {
    return redirectWithStatus(request, "/painel", "authorization-denied");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirectWithStatus(request, "/login", "session-expired");

  const stateHash = await hashOAuthState(state);
  const { data: oauthState } = await supabase
    .from("music_oauth_states")
    .select("church_id, return_to, expires_at")
    .eq("state_hash", stateHash)
    .eq("provider", "YOUTUBE")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !oauthState ||
    new Date(oauthState.expires_at).getTime() <= Date.now()
  ) {
    return redirectWithStatus(request, "/painel", "state-expired");
  }

  await supabase
    .from("music_oauth_states")
    .delete()
    .eq("state_hash", stateHash)
    .eq("user_id", user.id);

  try {
    const tokens = await exchangeYouTubeCode(
      request.nextUrl.origin,
      code
    );
    const channel = await getYouTubeChannel(tokens.access_token!);
    const encryptedAccess = await encryptIntegrationSecret(tokens.access_token!);

    const { data: existing } = await supabase
      .from("church_music_integrations")
      .select("refresh_token_ciphertext")
      .eq("church_id", oauthState.church_id)
      .eq("provider", "YOUTUBE")
      .maybeSingle();
    const encryptedRefresh = tokens.refresh_token
      ? await encryptIntegrationSecret(tokens.refresh_token)
      : existing?.refresh_token_ciphertext ?? null;

    const { error } = await supabase
      .from("church_music_integrations")
      .upsert(
        {
          church_id: oauthState.church_id,
          provider: "YOUTUBE",
          account_external_id: channel.id,
          account_label: channel.title,
          access_token_ciphertext: encryptedAccess,
          refresh_token_ciphertext: encryptedRefresh,
          token_expires_at: new Date(
            Date.now() + (tokens.expires_in ?? 3600) * 1000
          ).toISOString(),
          scopes: tokens.scope?.split(" ") ?? [YOUTUBE_SCOPE],
          created_by: user.id,
        },
        { onConflict: "church_id,provider" }
      );
    if (error) throw error;
    return redirectWithStatus(request, oauthState.return_to, "connected");
  } catch (error) {
    console.error("YouTube OAuth callback failed", error);
    return redirectWithStatus(request, oauthState.return_to, "connection-error");
  }
}
