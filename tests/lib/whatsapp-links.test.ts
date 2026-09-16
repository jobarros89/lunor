import { describe, expect, it } from "vitest";
import { buildAvailabilityDeepLink, buildScheduleDeepLink } from "@/lib/whatsapp/links";

describe("WhatsApp deep links", () => {
  it("abre a escala específica dentro da igreja", () => {
    const url = new URL(buildScheduleDeepLink("rez-church-rio", "event-123"));
    expect(url.pathname).toBe("/rez-church-rio/escalas/event-123");
  });

  it("abre disponibilidade dentro da igreja", () => {
    const url = new URL(buildAvailabilityDeepLink("rez-church-rio"));
    expect(url.pathname).toBe("/rez-church-rio/disponibilidade");
  });

  it("escapa slug e id antes de montar o link", () => {
    const url = new URL(buildScheduleDeepLink("igreja teste", "evento/1"));
    expect(url.pathname).toBe("/igreja%20teste/escalas/evento%2F1");
  });
});
