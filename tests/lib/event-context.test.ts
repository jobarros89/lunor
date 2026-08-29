import { describe, expect, it } from "vitest";
import { eventContextLabel, inferServicePeriod, servicePeriodLabel } from "@/lib/event-context";

describe("event context", () => {
  it("combina campus e período para identificar o culto", () => {
    expect(
      eventContextLabel({
        campusName: "Botafogo",
        servicePeriod: "noite",
        fallbackLocation: "Rua X",
      })
    ).toBe("Botafogo · Noite");
  });

  it("mantém location legado quando o evento ainda não tem campus", () => {
    expect(
      eventContextLabel({
        campusName: null,
        servicePeriod: "manha",
        fallbackLocation: "Auditório principal",
      })
    ).toBe("Auditório principal · Manhã");
  });

  it("não inventa contexto quando campus, local e período estão vazios", () => {
    expect(
      eventContextLabel({
        campusName: null,
        servicePeriod: null,
        fallbackLocation: null,
      })
    ).toBe("");
  });

  it("mantém os rótulos de período e a inferência por horário", () => {
    expect(servicePeriodLabel("tarde")).toBe("Tarde");
    expect(inferServicePeriod("2026-08-30T09:00")).toBe("manha");
    expect(inferServicePeriod("2026-08-30T15:00")).toBe("tarde");
    expect(inferServicePeriod("2026-08-30T19:00")).toBe("noite");
  });
});
