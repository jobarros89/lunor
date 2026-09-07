import { describe, expect, it } from "vitest";
import {
  buildDistributionOverview,
  giniCoefficient,
  relativeLastService,
  type DistributionAssignment,
  type DistributionMember,
} from "@/lib/distribution";

const NOW = new Date("2026-09-06T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

function daysAhead(days: number) {
  return new Date(NOW.getTime() + days * DAY_MS).toISOString();
}

function member(userId: string, name: string): DistributionMember {
  return { userId, name };
}

function serve(
  userId: string,
  startsAt: string,
  status = "confirmado"
): DistributionAssignment {
  return {
    userId,
    status,
    eventId: `ev-${userId}-${startsAt}`,
    eventTitle: "Culto",
    startsAt,
  };
}

describe("giniCoefficient", () => {
  it("devolve null quando não há carga alguma", () => {
    expect(giniCoefficient([0, 0, 0])).toBeNull();
    expect(giniCoefficient([])).toBeNull();
  });

  it("é 0 quando todos servem igual", () => {
    expect(giniCoefficient([3, 3, 3, 3])).toBeCloseTo(0, 5);
  });

  it("cresce quando uma pessoa concentra a carga", () => {
    const igual = giniCoefficient([2, 2, 2, 2])!;
    const concentrado = giniCoefficient([8, 0, 0, 0])!;
    expect(concentrado).toBeGreaterThan(igual);
    expect(concentrado).toBeLessThanOrEqual(1);
  });
});

describe("buildDistributionOverview", () => {
  it("marca como atenção quem serviu 4+ vezes em 30 dias", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Ana")],
      assignments: [
        serve("u1", daysAgo(3)),
        serve("u1", daysAgo(10)),
        serve("u1", daysAgo(17)),
        serve("u1", daysAgo(24)),
      ],
      now: NOW,
    });

    expect(overview.people[0].last30).toBe(4);
    expect(overview.people[0].signal).toBe("attention");
    expect(overview.attention).toHaveLength(1);
  });

  it("marca como reconectar quem está há 6+ semanas sem servir e sem escala futura", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Bruno")],
      assignments: [serve("u1", daysAgo(50))],
      now: NOW,
    });

    expect(overview.people[0].signal).toBe("reconnect");
    expect(overview.people[0].daysSinceLast).toBe(50);
    expect(overview.reconnect).toHaveLength(1);
  });

  it("não marca reconectar quando existe escala futura", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Bruno")],
      assignments: [serve("u1", daysAgo(50)), serve("u1", daysAhead(5))],
      now: NOW,
    });

    expect(overview.people[0].signal).toBe("balanced");
    expect(overview.people[0].upcoming).toBe(1);
  });

  it("ignora ausências e substituições no cálculo de carga", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Carla")],
      assignments: [
        serve("u1", daysAgo(2), "ausente"),
        serve("u1", daysAgo(4), "substituido"),
        serve("u1", daysAgo(6), "substituicao_solicitada"),
        serve("u1", daysAgo(8), "presente"),
      ],
      now: NOW,
    });

    expect(overview.people[0].last30).toBe(1);
  });

  it("conta semanas seguidas servindo", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Davi")],
      assignments: [
        serve("u1", daysAgo(1)),
        serve("u1", daysAgo(8)),
        serve("u1", daysAgo(15)),
      ],
      now: NOW,
    });

    expect(overview.people[0].consecutiveWeeks).toBeGreaterThanOrEqual(3);
  });

  it("monta a série semanal na ordem cronológica e no tamanho pedido", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Ana"), member("u2", "Bruno")],
      assignments: [serve("u1", daysAgo(2)), serve("u2", daysAgo(2))],
      now: NOW,
      weeksBack: 8,
    });

    expect(overview.weeks).toHaveLength(8);
    const keys = overview.weeks.map((week) => week.weekStart);
    expect([...keys].sort()).toEqual(keys);

    const ultima = overview.weeks.at(-1)!;
    expect(ultima.count).toBe(2);
    expect(ultima.people).toBe(2);
  });

  it("não conta escalas futuras na série semanal", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Ana")],
      assignments: [serve("u1", daysAhead(3))],
      now: NOW,
    });

    expect(overview.weeks.every((week) => week.count === 0)).toBe(true);
    expect(overview.totalServices30).toBe(0);
  });

  it("devolve índice de equilíbrio null quando ninguém serviu em 30 dias", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Ana"), member("u2", "Bruno")],
      assignments: [],
      now: NOW,
    });

    expect(overview.balanceIndex).toBeNull();
    expect(overview.idleMembers).toBe(2);
  });

  it("dá índice de equilíbrio alto quando a carga está bem dividida", () => {
    const equilibrado = buildDistributionOverview({
      members: [member("u1", "Ana"), member("u2", "Bruno"), member("u3", "Carla")],
      assignments: [
        serve("u1", daysAgo(3)),
        serve("u2", daysAgo(4)),
        serve("u3", daysAgo(5)),
      ],
      now: NOW,
    });

    const concentrado = buildDistributionOverview({
      members: [member("u1", "Ana"), member("u2", "Bruno"), member("u3", "Carla")],
      assignments: [
        serve("u1", daysAgo(3)),
        serve("u1", daysAgo(10)),
        serve("u1", daysAgo(17)),
      ],
      now: NOW,
    });

    expect(equilibrado.balanceIndex).toBe(100);
    expect(concentrado.balanceIndex!).toBeLessThan(equilibrado.balanceIndex!);
  });

  it("ordena atenção pela carga e reconectar pelo tempo parado", () => {
    const overview = buildDistributionOverview({
      members: [
        member("u1", "Ana"),
        member("u2", "Bruno"),
        member("u3", "Carla"),
        member("u4", "Davi"),
      ],
      assignments: [
        serve("u1", daysAgo(2)),
        serve("u1", daysAgo(9)),
        serve("u1", daysAgo(16)),
        serve("u1", daysAgo(23)),
        serve("u2", daysAgo(1)),
        serve("u2", daysAgo(3)),
        serve("u2", daysAgo(5)),
        serve("u2", daysAgo(7)),
        serve("u2", daysAgo(11)),
        serve("u3", daysAgo(45)),
        serve("u4", daysAgo(70)),
      ],
      now: NOW,
    });

    expect(overview.attention.map((p) => p.name)).toEqual(["Bruno", "Ana"]);
    expect(overview.reconnect.map((p) => p.name)).toEqual(["Davi", "Carla"]);
  });

  it("trata quem nunca serviu como reconectar, não como equilibrado", () => {
    const overview = buildDistributionOverview({
      members: [member("u1", "Novato")],
      assignments: [],
      now: NOW,
    });

    expect(overview.people[0].daysSinceLast).toBeNull();
    expect(overview.people[0].signal).toBe("reconnect");
  });
});

describe("relativeLastService", () => {
  it("descreve o intervalo em português", () => {
    expect(relativeLastService(null)).toBe("Sem serviço na janela");
    expect(relativeLastService(0)).toBe("Serviu hoje");
    expect(relativeLastService(1)).toBe("Serviu ontem");
    expect(relativeLastService(4)).toBe("Serviu há 4 dias");
    expect(relativeLastService(7)).toBe("Serviu há 1 semana");
    expect(relativeLastService(21)).toBe("Serviu há 3 semanas");
  });
});
