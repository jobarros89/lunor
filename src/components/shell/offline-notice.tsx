"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineNotice() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-3 rounded-xl border border-amber-600/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200"
    >
      <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">Você está sem conexão</p>
        <p className="mt-1 leading-relaxed">
          Reconecte-se antes de enviar alterações. Algumas telas podem estar
          indisponíveis.
        </p>
      </div>
    </div>
  );
}
