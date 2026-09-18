import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "out");
const iconSource = path.join(root, "public", "icons", "lunor-app-icon.svg");
const iconTarget = path.join(outDir, "lunor-app-icon.svg");

const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover"
    />
    <meta name="theme-color" content="#080809" />
    <meta name="color-scheme" content="dark" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"
    />
    <title>LUNOR</title>
    <style>
      :root {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        color: #f7f7f8;
        background: #080809;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100svh;
        background:
          radial-gradient(circle at 80% 20%, rgba(110, 92, 230, 0.18), transparent 32%),
          #080809;
      }

      main {
        min-height: 100svh;
        display: grid;
        place-items: center;
        padding:
          max(28px, env(safe-area-inset-top))
          24px
          max(28px, env(safe-area-inset-bottom));
      }

      .shell {
        width: min(100%, 420px);
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .brand img {
        width: 62px;
        height: 62px;
        border-radius: 18px;
      }

      .wordmark {
        letter-spacing: 0.28em;
        font-size: 20px;
        font-weight: 700;
      }

      .tagline {
        margin: 8px 0 0;
        color: #a7a7ad;
        font-size: 12px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .card {
        margin-top: 42px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 28px;
        padding: 26px;
        background: rgba(255,255,255,0.035);
        box-shadow: 0 24px 80px rgba(0,0,0,0.32);
      }

      h1 {
        margin: 0;
        font-size: clamp(30px, 9vw, 46px);
        line-height: 0.98;
        letter-spacing: -0.05em;
      }

      p {
        color: #b8b8be;
        line-height: 1.6;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 9px;
        margin-top: 14px;
        color: #d4d4d8;
        font-size: 13px;
      }

      .dot {
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: #f59e0b;
      }

      .online .dot {
        background: #10b981;
      }

      a {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 52px;
        margin-top: 26px;
        border-radius: 16px;
        background: #6e5ce6;
        color: white;
        font-weight: 700;
        text-decoration: none;
      }

      small {
        display: block;
        margin-top: 18px;
        color: #777780;
        font-size: 11px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="shell">
        <div class="brand">
          <img src="./lunor-app-icon.svg" alt="" />
          <div>
            <div class="wordmark">LUNOR</div>
            <p class="tagline">Presença · preparo · propósito</p>
          </div>
        </div>

        <div class="card">
          <h1>LUNOR no seu iPhone.</h1>
          <p>
            A base nativa está pronta. Este shell local mantém o aplicativo inicializável
            sem depender de um endereço remoto configurado no Capacitor.
          </p>
          <div id="network-status" class="status">
            <span class="dot"></span>
            <span id="network-copy">Verificando conexão…</span>
          </div>
          <a href="https://lunorservice.com">Abrir LUNOR na web</a>
          <small>
            Esta é a fundação do app nativo. As telas autenticadas serão migradas para
            esta camada antes do build assinado/TestFlight.
          </small>
        </div>
      </section>
    </main>

    <script>
      const status = document.getElementById("network-status");
      const copy = document.getElementById("network-copy");

      function updateNetworkStatus() {
        const online = navigator.onLine;
        status.classList.toggle("online", online);
        copy.textContent = online
          ? "Conexão disponível"
          : "Sem conexão. O LUNOR web continua disponível quando a internet voltar.";
      }

      window.addEventListener("online", updateNetworkStatus);
      window.addEventListener("offline", updateNetworkStatus);
      updateNetworkStatus();
    </script>
  </body>
</html>
`;

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await copyFile(iconSource, iconTarget);
await writeFile(path.join(outDir, "index.html"), html, "utf8");

console.log("LUNOR local mobile shell generated in out/");
