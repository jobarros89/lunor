import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function redirectNoStore(request: NextRequest, path: string) {
  const url = new URL(path, request.url);
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/**
 * Consome o token de recovery no servidor e cria a sessão em cookie.
 * O token nunca é encaminhado para a tela de redefinição.
 */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");

  if (!tokenHash) {
    return redirectNoStore(request, "/redefinir-senha?erro=link");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return redirectNoStore(request, "/redefinir-senha?erro=link");
  }

  return redirectNoStore(request, "/redefinir-senha");
}
