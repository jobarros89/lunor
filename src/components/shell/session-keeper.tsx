"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Substitui o refresh de sessão que o middleware/proxy fazia.
 * No Cloudflare (Next 16) o proxy roda em Node e não é suportado pelo OpenNext,
 * então mantemos a sessão viva pelo cliente: o browser client renova o token
 * antes de expirar e persiste nos mesmos cookies que o servidor lê.
 *
 * O SDK do Supabase é carregado depois da hidratação para não fazer Auth,
 * Realtime e Storage participarem do caminho síncrono inicial do shell.
 */
export function SessionKeeper() {
  const router = useRouter();

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;

    void import("@/lib/supabase/client")
      .then(({ createClient }) => {
        if (disposed) return;

        const supabase = createClient();
        // dispara o timer interno de auto-refresh e sincroniza cookies
        void supabase.auth.getSession();

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
          // logout em outra aba ou expiração definitiva → recarrega para o gate de auth agir
          if (event === "SIGNED_OUT") router.refresh();
          // token renovado: os cookies já foram atualizados pelo client
        });

        if (disposed) {
          subscription.unsubscribe();
          return;
        }

        unsubscribe = () => subscription.unsubscribe();
      })
      .catch((error) => {
        console.error("session-keeper:", error);
      });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [router]);

  return null;
}
