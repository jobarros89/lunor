/**
 * ⚠️ INATIVO — este helper NÃO roda hoje.
 *
 * Não existe `middleware.ts` na raiz que o chame: o middleware foi removido
 * de propósito (Next 16 força runtime Node no middleware e o OpenNext/
 * Cloudflare não suportava). Mantido aqui para quando isso mudar.
 *
 * Como a autenticação funciona de verdade:
 *   1. cada página/layout protegido chama `getTenant()` (src/lib/tenant.ts),
 *      que faz `getUser()` e redireciona para /login se não houver sessão;
 *   2. o RLS do Postgres é a barreira real de dados (isolamento por igreja);
 *   3. `SessionKeeper` (client) mantém o token renovado no browser.
 *
 * ⚠️ Ao criar uma rota nova protegida (página OU route handler), chame
 * `getTenant()` — não há gate automático na borda para cobrir o esquecimento.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    throw new Error("Missing Supabase public key");
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANTE: não remover — getUser() revalida o token a cada request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
