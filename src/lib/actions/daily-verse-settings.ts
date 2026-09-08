"use server";

import { createClient } from "@/lib/supabase/server";

const ALLOWED_THEMES = [
  "auto",
  "servir",
  "encorajamento",
  "descanso",
  "gratidao",
  "perseveranca",
  "unidade",
] as const;

type DailyVerseTheme = (typeof ALLOWED_THEMES)[number];

export async function updateDailyVerseSettings(
  churchId: string,
  settings: {
    enabled: boolean;
    version?: "blt" | "nvi" | "acf" | "ra";
    theme?: DailyVerseTheme;
  }
) {
  const supabase = await createClient();

  const theme = settings.theme || "auto";
  if (!(ALLOWED_THEMES as readonly string[]).includes(theme)) {
    throw new Error("Tema de versículo inválido.");
  }

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
      daily_verse_version: settings.version || "blt",
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
