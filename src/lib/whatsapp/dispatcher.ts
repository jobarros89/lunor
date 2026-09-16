import "server-only";
import { serverEnv } from "@/lib/env";
import { evolutionProvider } from "@/lib/whatsapp/evolution";
import { metaProvider } from "@/lib/whatsapp/meta";
import type { WhatsAppProvider } from "@/lib/whatsapp/provider";
import type { WhatsAppProviderName } from "@/lib/whatsapp/types";

export function configuredWhatsAppProviderName(): WhatsAppProviderName {
  return serverEnv("WHATSAPP_PROVIDER") === "evolution" ? "evolution" : "meta";
}

export function getWhatsAppProvider(): WhatsAppProvider {
  return configuredWhatsAppProviderName() === "evolution" ? evolutionProvider : metaProvider;
}
