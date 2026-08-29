/* LUNOR — service worker mínimo.
   Durante o desenvolvimento ativo, NÃO cacheamos HTML/CSS/JS: o app sempre
   busca do servidor (evita PWA travado em versão antiga no iPhone).
   Mantém apenas instalabilidade (PWA) + limpeza de caches antigos. */
const CACHE = "lunor-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Sem interceptar fetch: o navegador vai direto à rede (assets do Next são
// versionados por hash, então já ficam frescos automaticamente).

// ---------- Web Push ----------
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "LUNOR", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "LUNOR";
  const options = {
    body: payload.body || "",
    icon: "/icons/lunor-icon-192-v2.png",
    badge: "/icons/lunor-icon-192-v2.png",
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const win of wins) {
          if ("focus" in win) {
            win.navigate?.(url);
            return win.focus();
          }
        }
        return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
      })
  );
});
