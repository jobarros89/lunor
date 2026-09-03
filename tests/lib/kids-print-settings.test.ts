import { describe, expect, it } from "vitest";
import {
  DEFAULT_KIDS_PRINT_SETTINGS,
  kidsLabelPreset,
  kidsPrintPageSize,
  kidsPrintSettingsFromRow,
} from "@/lib/kids-print-settings";

describe("kids print settings", () => {
  it("usa 62x50 universal como padrão", () => {
    expect(kidsPrintSettingsFromRow(null)).toEqual(DEFAULT_KIDS_PRINT_SETTINGS);
    expect(kidsLabelPreset(DEFAULT_KIDS_PRINT_SETTINGS)).toBe("62x50");
  });

  it("inverte dimensões quando a orientação é vertical", () => {
    expect(
      kidsPrintPageSize({
        ...DEFAULT_KIDS_PRINT_SETTINGS,
        labelWidthMm: 60,
        labelHeightMm: 40,
        orientation: "vertical",
      })
    ).toEqual({ widthMm: 40, heightMm: 60 });
  });

  it("normaliza valores vindos do numeric do Postgres", () => {
    expect(
      kidsPrintSettingsFromRow({
        print_mode: "universal",
        label_width_mm: "50.0",
        label_height_mm: "30.0",
        margin_mm: "1.5",
        orientation: "horizontal",
        copies: "2",
        qr_enabled: false,
      })
    ).toMatchObject({
      printMode: "universal",
      labelWidthMm: 50,
      labelHeightMm: 30,
      marginMm: 1.5,
      orientation: "horizontal",
      copies: 2,
      qrEnabled: false,
    });
  });
});
