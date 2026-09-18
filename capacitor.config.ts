import type { CapacitorConfig } from "@capacitor/cli";

const appMode = process.env.CAPACITOR_APP_MODE?.trim().toLowerCase() || "remote";
const useRemoteServer = appMode === "remote";
const remoteServerUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() || "https://lunorservice.com";

if (!["remote", "local"].includes(appMode)) {
  throw new Error(
    `CAPACITOR_APP_MODE inválido: "${appMode}". Use "remote" ou "local".`
  );
}

const config: CapacitorConfig = {
  appId: "com.lunor.app",
  appName: "LUNOR",
  webDir: "out",
  ...(useRemoteServer
    ? {
        server: {
          url: remoteServerUrl,
          cleartext: false,
        },
      }
    : {}),
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
