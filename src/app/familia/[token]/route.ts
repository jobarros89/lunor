import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const FAMILY_COOKIE = "lunor_family_invite";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    return NextResponse.redirect(new URL("/login?convite=familia-invalido", request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: churchSlug, error } = await supabase.rpc("redeem_guardian_invite", {
      p_token: token,
    });
    if (!error && churchSlug) {
      const response = NextResponse.redirect(new URL(`/${churchSlug}/infantil`, request.url));
      response.cookies.delete(FAMILY_COOKIE);
      return response;
    }
    return NextResponse.redirect(new URL("/login?convite=familia-invalido", request.url));
  }

  const response = NextResponse.redirect(
    new URL(`/signup?familia=${encodeURIComponent(token)}`, request.url)
  );
  response.cookies.set(FAMILY_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
