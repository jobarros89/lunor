"use server";

import { createClient } from "@/lib/supabase/server";

export async function updateDailyVerseSettings(
  churchId: string,
  settings: {
    enabled: boolean;
    version?: "blt" | "nvi" | "acf" | "ra";
    theme?: string;
  }
) {
  const supabase = await createClient();

  // Ler settings atuais
  const { data: church, error: readError } = await supabase
    .from("churches")
    .select("settings")
    .eq("id", churchId)
    .single();

  if (readError) throw readError;

  // Mesclar com settings existentes
  const currentSettings = (church?.settings || {}) as Record<string, Record<string, unknown>>;
  const updatedSettings = {
    ...currentSettings,
    notifications: {
      ...(currentSettings.notifications || {}),
      daily_verse_enabled: settings.enabled,
      daily_verse_version: settings.version || "blt",
      daily_verse_theme: settings.theme || "auto",
    },
  };

  // Salvar
  const { error: updateError } = await supabase
    .from("churches")
    .update({ settings: updatedSettings })
    .eq("id", churchId);

  if (updateError) throw updateError;

  return { success: true };
}
