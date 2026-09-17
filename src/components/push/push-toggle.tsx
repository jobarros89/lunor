"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { savePushSubscription, removePushSubscription } from "@/lib/actions/push";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

const subscribeSupport = () => () => {};
const getServerSupport = () => null;
const getBrowserSupport = () =>
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function PushToggle({
  churchId,
  vapidPublicKey,
}: {
  churchId: string;
  vapidPublicKey?: string;
}) {
  const supported = useSyncExternalStore(
    subscribeSupport,
    getBrowserSupport,
    getServerSupport
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, [supported]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Permissão de notificações negada");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      if (!vapidPublicKey) {
        toast.error("Avisos indisponíveis no momento");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const json = sub.toJSON();
      const res = await savePushSubscription({
        churchId,
        endpoint: json.endpoint ?? "",
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (res.ok) {
        setEnabled(true);
        toast.success("Notificações ativadas neste aparelho");
      } else {
        await sub.unsubscribe().catch(() => {});
        toast.error(res.error);
      }
    } catch {
      toast.error("Não foi possível ativar as notificações");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
      toast.success("Notificações desativadas neste aparelho");
    } catch {
      toast.error("Não foi possível desativar as notificações");
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) {
    return (
      <div className="min-h-36 animate-pulse rounded-2xl bg-muted/40" aria-hidden="true" />
    );
  }

  if (!supported) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Receba notificações do LUNOR</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Este navegador não suporta avisos neste modo. No iPhone, adicione o LUNOR à Tela de Início e abra por lá para permitir notificações.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Notificações ativadas neste aparelho</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Você pode receber avisos de escalas, alterações e chamados do Kids quando aplicável.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          disabled={busy}
          onClick={disable}
          className="w-full sm:w-auto"
        >
          {busy ? "Desativando…" : "Desativar notificações"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-muted/20 p-5">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-base font-semibold">Ativar notificações</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Permita que o LUNOR avise sobre escalas, mudanças importantes e chamados do Kids mesmo quando a página não estiver aberta.
          </p>
        </div>
      </div>
      <Button
        disabled={busy}
        onClick={enable}
        className="h-12 w-full text-base sm:w-auto sm:px-6"
      >
        <BellRing className="size-4" />
        {busy ? "Solicitando permissão…" : "Permitir notificações"}
      </Button>
      <p className="text-xs text-muted-foreground">
        O navegador sempre pede sua confirmação antes de ativar. Você pode desativar quando quiser.
      </p>
    </div>
  );
}
