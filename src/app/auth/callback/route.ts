import { NextResponse } from "next/server";
import { resolveAuthenticatedDestination } from "@/lib/auth/post-login";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?erro=google", requestUrl.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback:", error);
    return NextResponse.redirect(new URL("/login?erro=google", requestUrl.origin));
  }

  const destination = await resolveAuthenticatedDestination(supabase, "/");
  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
