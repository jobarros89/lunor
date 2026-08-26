import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const INVITE_COOKIE = "lunor_invite";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.trim().toLowerCase();

  if (!/^[a-f0-9]{32}$/.test(code)) {
    return NextResponse.redirect(new URL("/comecar?convite=invalido", request.url));
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data, error } = await supabase.rpc("join_church", {
      p_invite_code: code,
    });
    if (!error && data) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    return NextResponse.redirect(new URL("/comecar?convite=invalido", request.url));
  }

  const response = NextResponse.redirect(new URL("/signup", request.url));
  response.cookies.set(INVITE_COOKIE, code, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
