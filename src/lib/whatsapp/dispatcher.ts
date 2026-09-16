import "server-only";
import { serverEnv } from "@/lib/env";
import { evolutionProvider } from "@/lib/whatsapp/evolution";
import type { WhatsAppProvider } from "@/lib/whatsapp/provider";
import type { WhatsAppProviderName } from "@/lib/whatsapp/types";

export function configuredWhatsAppProviderName(): WhatsAppProviderName {
  return serverEnv("WHATSAPP_PROVIDER") === "evolution" ? "evolution" : "meta";
}

export function getWhatsAppProvider(): WhatsAppProvider {
  const name = configuredWhatsAppProviderName();
  if (name === "evolution") return evolutionProvider;

  // Meta ainda usa o adapter legado até a persistência/idempotência ser extraída de meta.ts.
  throw new Error("Provider Meta deve continuar usando o adapter legado nesta etapa");
}
