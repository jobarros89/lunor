import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = serverEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey =
    serverEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    serverEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl) {
    throw new Error("Missing Supabase URL");
  }

  if (!supabaseKey) {
    throw new Error("Missing Supabase public key");
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // chamado de um Server Component: o middleware renova a sessão
          }
        },
      },
    }
  );
}
