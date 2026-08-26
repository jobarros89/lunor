import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createOAuthState, hashOAuthState } from "@/lib/integrations/crypto";
import { spotifyAuthorizationUrl } from "@/lib/integrations/spotify";

function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function GET(request: NextRequest) {
  const churchId = request.nextUrl.searchParams.get("churchId");
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  if (!churchId || !returnTo) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL(`/login?next=${encodeURIComponent(returnTo)}`, request.url)
    );
  }

  const [{ data: isLeader }, { data: isCoord }] = await Promise.all([
    supabase.rpc("is_louvor_leader", { p_church: churchId }),
    supabase.rpc("is_church_coord", { p_church: churchId }),
  ]);
  if (!isLeader && !isCoord) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const state = createOAuthState();
    const stateHash = await hashOAuthState(state);
    await supabase
      .from("music_oauth_states")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", "SPOTIFY")
      .lt("expires_at", new Date().toISOString());

    const { error } = await supabase.from("music_oauth_states").insert({
      state_hash: stateHash,
      church_id: churchId,
      provider: "SPOTIFY",
      user_id: user.id,
      return_to: returnTo,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`${returnTo}?spotify=connection-error`, request.url)
      );
    }
    return NextResponse.redirect(
      spotifyAuthorizationUrl(request.nextUrl.origin, state)
    );
  } catch (error) {
    console.error("Spotify OAuth start failed", error);
    return NextResponse.redirect(
      new URL(`${returnTo}?spotify=not-configured`, request.url)
    );
  }
}
