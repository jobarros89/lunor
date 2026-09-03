export type KidsPrintMode = "universal" | "direct";
export type KidsPrintOrientation = "horizontal" | "vertical";

export type KidsPrintSettings = {
  printMode: KidsPrintMode;
  labelWidthMm: number;
  labelHeightMm: number;
  marginMm: number;
  orientation: KidsPrintOrientation;
  copies: number;
  qrEnabled: boolean;
};

export const DEFAULT_KIDS_PRINT_SETTINGS: KidsPrintSettings = {
  printMode: "universal",
  labelWidthMm: 62,
  labelHeightMm: 50,
  marginMm: 2.5,
  orientation: "horizontal",
  copies: 1,
  qrEnabled: true,
};

export type KidsPrintSettingsRow = {
  print_mode?: string | null;
  label_width_mm?: number | string | null;
  label_height_mm?: number | string | null;
  margin_mm?: number | string | null;
  orientation?: string | null;
  copies?: number | string | null;
  qr_enabled?: boolean | null;
} | null;

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function kidsPrintSettingsFromRow(
  row: KidsPrintSettingsRow
): KidsPrintSettings {
  if (!row) return { ...DEFAULT_KIDS_PRINT_SETTINGS };

  const mode = row.print_mode === "direct" ? "direct" : "universal";
  const orientation =
    row.orientation === "vertical" ? "vertical" : "horizontal";
  const copies = Math.min(
    3,
    Math.max(1, Math.round(finiteNumber(row.copies, DEFAULT_KIDS_PRINT_SETTINGS.copies)))
  );

  return {
    printMode: mode,
    labelWidthMm: finiteNumber(
      row.label_width_mm,
      DEFAULT_KIDS_PRINT_SETTINGS.labelWidthMm
    ),
    labelHeightMm: finiteNumber(
      row.label_height_mm,
      DEFAULT_KIDS_PRINT_SETTINGS.labelHeightMm
    ),
    marginMm: finiteNumber(row.margin_mm, DEFAULT_KIDS_PRINT_SETTINGS.marginMm),
    orientation,
    copies,
    qrEnabled:
      typeof row.qr_enabled === "boolean"
        ? row.qr_enabled
        : DEFAULT_KIDS_PRINT_SETTINGS.qrEnabled,
  };
}

export function kidsPrintPageSize(settings: KidsPrintSettings) {
  return settings.orientation === "vertical"
    ? {
        widthMm: settings.labelHeightMm,
        heightMm: settings.labelWidthMm,
      }
    : {
        widthMm: settings.labelWidthMm,
        heightMm: settings.labelHeightMm,
      };
}

export type KidsLabelPreset = "62x50" | "60x40" | "50x30" | "custom";

export function kidsLabelPreset(settings: KidsPrintSettings): KidsLabelPreset {
  const key = `${settings.labelWidthMm}x${settings.labelHeightMm}`;
  if (key === "62x50" || key === "60x40" || key === "50x30") return key;
  return "custom";
}
