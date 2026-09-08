import { describe, expect, it } from "vitest";
import {
  localClockKey,
  localDateKey,
  localWeekdayIndex,
  zonedLocalToIso,
} from "@/lib/ai/recurring-events";

describe("recurring event date helpers", () => {
  it("preserves the Botafogo Sunday morning wall clock in Sao Paulo", () => {
    const source = "2026-09-20T10:25:00.000Z";
    expect(localDateKey(source)).toBe("2026-09-20");
    expect(localClockKey(source)).toBe("07:25:00");
    expect(localWeekdayIndex(source)).toBe(0);
    expect(zonedLocalToIso("2026-09-27", "07:25:00")).toBe(
      "2026-09-27T10:25:00.000Z"
    );
  });

  it("keeps Sunday recurrence stable across the end of 2026", () => {
    const lastSunday = zonedLocalToIso("2026-12-27", "07:25:00");
    expect(localDateKey(lastSunday)).toBe("2026-12-27");
    expect(localWeekdayIndex(lastSunday)).toBe(0);
  });
});
