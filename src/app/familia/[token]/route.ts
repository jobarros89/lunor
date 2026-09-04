import { NextResponse, type NextRequest } from "next/server";
import {
  FAMILY_INVITE_COOKIE,
  guardianInviteErrorPath,
} from "@/lib/guardian-invite-preview";
import { createClient } from "@/lib/supabase/server";

function setFamilyCookie(response: NextResponse, token: string) {
  response.cookies.set(FAMILY_INVITE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/i.test(token)) {
    const response = NextResponse.redirect(
      new URL("/familia/acesso?erro=convite-invalido", request.url)
    );
    response.cookies.delete(FAMILY_INVITE_COOKIE);
    return response;
  }

  const supabase = await createClient();
  const { data: previewData, error: previewError } = await supabase.rpc(
    "guardian_invite_preview",
    { p_token: token }
  );
  const preview = Array.isArray(previewData) ? previewData[0] : previewData;
  const status = preview?.status ?? "invalid";

  if (previewError || status === "invalid") {
    const response = NextResponse.redirect(
      new URL("/familia/acesso?erro=convite-invalido", request.url)
    );
    response.cookies.delete(FAMILY_INVITE_COOKIE);
    return response;
  }

  if (status === "expired" || !preview?.invited_email) {
    const response = NextResponse.redirect(
      new URL("/familia/acesso?erro=convite-expirado", request.url)
    );
    setFamilyCookie(response, token);
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: churchSlug, error } = await supabase.rpc("redeem_guardian_invite", {
      p_token: token,
    });
    if (!error && churchSlug) {
      const response = NextResponse.redirect(
        new URL(`/${churchSlug}/infantil`, request.url)
      );
      response.cookies.delete(FAMILY_INVITE_COOKIE);
      return response;
    }

    const response = NextResponse.redirect(
      new URL(guardianInviteErrorPath(error?.message), request.url)
    );
    setFamilyCookie(response, token);
    return response;
  }

  const response = NextResponse.redirect(
    new URL(
      status === "used" ? "/familia/acesso?erro=convite-usado" : "/familia/acesso",
      request.url
    )
  );
  setFamilyCookie(response, token);
  return response;
}
