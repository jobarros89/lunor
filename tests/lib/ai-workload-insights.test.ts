import { describe, expect, it } from "vitest";
import { buildTeamWorkloadInsights } from "@/lib/ai/workload-insights";

describe("análise de carga do time", () => {
  const context = {
    churchId: "church-1",
    ministryId: "11111111-1111-4111-8111-111111111111",
    ministryName: "Louvor",
  };

  it("identifica concentração de carga e oportunidades de rotação", () => {
    const members = [
      { userId: "ana", name: "Ana" },
      { userId: "bruno", name: "Bruno" },
      { userId: "carla", name: "Carla" },
      { userId: "diego", name: "Diego" },
      { userId: "eva", name: "Eva" },
    ];
    const participations = [
      ...Array.from({ length: 6 }, (_, index) => ({
        userId: "ana",
        eventId: `a-${index}`,
        startsAt: `2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      })),
      // Duas funções no mesmo culto não devem contar como dois serviços.
      {
        userId: "ana",
        eventId: "a-0",
        startsAt: "2026-08-01T12:00:00.000Z",
      },
      {
        userId: "bruno",
        eventId: "b-1",
        startsAt: "2026-08-02T12:00:00.000Z",
      },
      {
        userId: "bruno",
        eventId: "b-2",
        startsAt: "2026-08-09T12:00:00.000Z",
      },
      {
        userId: "carla",
        eventId: "c-1",
        startsAt: "2026-08-03T12:00:00.000Z",
      },
      {
        userId: "eva",
        eventId: "e-1",
        startsAt: "2026-08-04T12:00:00.000Z",
      },
    ];

    const result = buildTeamWorkloadInsights({
      context,
      members,
      participations,
      historyDays: 60,
      generatedAt: "2026-09-08T00:00:00.000Z",
    });

    expect(result.summary.averageServicesPerMember).toBe(2);
    expect(result.summary.highLoadThreshold).toBe(3);
    expect(result.summary.concentrationSignal).toBe("concentrated");
    expect(result.summary.concentrationSharePercent).toBe(60);
    expect(result.highLoad).toEqual([
      expect.objectContaining({
        userId: "ana",
        name: "Ana",
        services: 6,
        relativeToAverage: 3,
      }),
    ]);
    expect(result.rotationOpportunities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "diego", services: 0 }),
        expect.objectContaining({ userId: "carla", services: 1 }),
        expect.objectContaining({ userId: "eva", services: 1 }),
      ])
    );
  });

  it("não inventa sobrecarga quando há poucos dados", () => {
    const result = buildTeamWorkloadInsights({
      context,
      members: [
        { userId: "ana", name: "Ana" },
        { userId: "bruno", name: "Bruno" },
      ],
      participations: [
        {
          userId: "ana",
          eventId: "event-1",
          startsAt: "2026-09-01T12:00:00.000Z",
        },
      ],
      historyDays: 30,
      generatedAt: "2026-09-08T00:00:00.000Z",
    });

    expect(result.summary.concentrationSignal).toBe("balanced_or_insufficient_data");
    expect(result.highLoad).toHaveLength(0);
  });
});
