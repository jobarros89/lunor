import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = new URL("/redefinir-senha", url.origin);

  if (!code) {
    next.searchParams.set("erro", "link-invalido");
    return NextResponse.redirect(next);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    next.searchParams.set("erro", "link-invalido");
    return NextResponse.redirect(next);
  }

  return NextResponse.redirect(next);
}
