import { describe, expect, it } from "vitest";
import { resolveServiceWindow } from "@/lib/service-window";

describe("resolveServiceWindow", () => {
  it("usa a janela do ministério antes do horário do culto", () => {
    const result = resolveServiceWindow({
      eventStart: "2026-09-06T13:30:00.000Z",
      eventEnd: "2026-09-06T15:15:00.000Z",
      teamArrival: "2026-09-06T12:00:00.000Z",
      teamRelease: "2026-09-06T15:45:00.000Z",
    });

    expect(result).toEqual({
      arrivalAt: "2026-09-06T12:00:00.000Z",
      releaseAt: "2026-09-06T15:45:00.000Z",
      arrivalSource: "ministry",
      releaseSource: "ministry",
    });
  });

  it("permite override individual sem alterar a janela da equipe", () => {
    const result = resolveServiceWindow({
      eventStart: "2026-09-06T13:30:00.000Z",
      eventEnd: "2026-09-06T15:15:00.000Z",
      teamArrival: "2026-09-06T12:00:00.000Z",
      teamRelease: "2026-09-06T15:45:00.000Z",
      assignmentArrival: "2026-09-06T11:30:00.000Z",
      assignmentRelease: "2026-09-06T16:00:00.000Z",
    });

    expect(result.arrivalAt).toBe("2026-09-06T11:30:00.000Z");
    expect(result.releaseAt).toBe("2026-09-06T16:00:00.000Z");
    expect(result.arrivalSource).toBe("assignment");
    expect(result.releaseSource).toBe("assignment");
  });

  it("herda o culto quando não existe configuração de equipe nem individual", () => {
    const result = resolveServiceWindow({
      eventStart: "2026-09-06T13:30:00.000Z",
      eventEnd: "2026-09-06T15:15:00.000Z",
    });

    expect(result.arrivalSource).toBe("event");
    expect(result.releaseSource).toBe("event");
    expect(result.arrivalAt).toBe("2026-09-06T13:30:00.000Z");
    expect(result.releaseAt).toBe("2026-09-06T15:15:00.000Z");
  });
});
