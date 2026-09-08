"use server";

import { createClient } from "@/lib/supabase/server";

type DailyVerseVersion = "blt" | "nvi" | "acf" | "ra";
type DailyVerseTheme =
  | "auto"
  | "servir"
  | "encorajamento"
  | "descanso"
  | "gratidao"
  | "perseveranca"
  | "unidade";

const VALID_VERSIONS = new Set<DailyVerseVersion>(["blt", "nvi", "acf", "ra"]);
const VALID_THEMES = new Set<DailyVerseTheme>([
  "auto",
  "servir",
  "encorajamento",
  "descanso",
  "gratidao",
  "perseveranca",
  "unidade",
]);

export async function updateDailyVerseSettings(
  churchId: string,
  settings: {
    enabled: boolean;
    version?: DailyVerseVersion;
    theme?: DailyVerseTheme;
  }
) {
  const version = settings.version ?? "blt";
  const theme = settings.theme ?? "auto";
  if (!VALID_VERSIONS.has(version) || !VALID_THEMES.has(theme)) {
    throw new Error("Configuração inválida para o versículo do dia.");
  }

  const supabase = await createClient();

  const { data: church, error: readError } = await supabase
    .from("churches")
    .select("settings")
    .eq("id", churchId)
    .single();

  if (readError) throw readError;

  const currentSettings = (church?.settings || {}) as Record<string, Record<string, unknown>>;
  const updatedSettings = {
    ...currentSettings,
    notifications: {
      ...(currentSettings.notifications || {}),
      daily_verse_enabled: settings.enabled,
      daily_verse_version: version,
      daily_verse_theme: theme,
    },
  };

  const { error: updateError } = await supabase
    .from("churches")
    .update({ settings: updatedSettings })
    .eq("id", churchId);

  if (updateError) throw updateError;

  return { success: true };
}
