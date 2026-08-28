"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
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

export function PushToggle({ churchId }: { churchId: string }) {
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
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        toast.error("Avisos indisponíveis no momento");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
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
        toast.success("Avisos ativados neste aparelho");
      } else {
        await sub.unsubscribe().catch(() => {});
        toast.error(res.error);
      }
    } catch {
      toast.error("Não foi possível ativar os avisos");
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
      toast.success("Avisos desativados neste aparelho");
    } catch {
      toast.error("Não foi possível desativar os avisos");
    } finally {
      setBusy(false);
    }
  }

  if (supported === null) return null;

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não suporta avisos. No iPhone, instale o app na tela
        inicial (Compartilhar → Adicionar à Tela de Início) para receber.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <BellRing className="size-5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">Avisos no celular</p>
          <p className="text-sm text-muted-foreground">
            Seja avisado quando for escalado ou algo mudar
          </p>
        </div>
      </div>
      <Button
        variant={enabled ? "outline" : "default"}
        disabled={busy}
        onClick={enabled ? disable : enable}
        className="shrink-0 rounded-full"
      >
        {busy ? "…" : enabled ? "Desativar" : "Ativar"}
      </Button>
    </div>
  );
}
