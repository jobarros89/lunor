import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadOperationalSummary: vi.fn(),
  buildScheduleDraftFromPreviousService: vi.fn(),
}));

vi.mock("@/lib/operational-summary-server", () => ({
  loadOperationalSummary: mocks.loadOperationalSummary,
}));
vi.mock("@/lib/ai/schedule-draft", () => ({
  buildScheduleDraftFromPreviousService: mocks.buildScheduleDraftFromPreviousService,
}));

import { runDirectScheduleDraft } from "@/lib/ai/direct-schedule-draft";

const context = {
  churchId: "church-1",
  ministryId: "ministry-1",
  ministryName: "Louvor",
};

describe("runDirectScheduleDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não intercepta uma pergunta livre", async () => {
    const result = await runDirectScheduleDraft({
      question: "O que você acha desse repertório?",
      context,
    });
    expect(result).toBeNull();
    expect(mocks.loadOperationalSummary).not.toHaveBeenCalled();
  });

  it("monta rascunho da próxima escala sem depender do LLM", async () => {
    const proposal = {
      kind: "assignment" as const,
      eventId: "11111111-1111-4111-8111-111111111111",
      eventTitle: "Culto de Domingo",
      startsAt: "2026-09-06T10:30:00.000Z",
      userId: "22222222-2222-4222-8222-222222222222",
      userName: "Pessoa Teste",
      roleName: "Baixo",
      departmentId: null,
      departmentName: null,
      availability: "available" as const,
      availabilityLabel: "Disponível",
      rationale: "Disponível",
    };
    mocks.loadOperationalSummary.mockResolvedValue({
      events: [{ id: proposal.eventId, title: proposal.eventTitle }],
    });
    mocks.buildScheduleDraftFromPreviousService.mockResolvedValue({
      kind: "schedule_draft",
      event: { id: proposal.eventId, title: proposal.eventTitle, startsAt: proposal.startsAt },
      referenceEvent: {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Culto anterior",
        startsAt: "2026-08-30T10:30:00.000Z",
      },
      proposals: [proposal],
      skippedRoles: [],
    });

    const result = await runDirectScheduleDraft({
      question: "Me ajude a montar a próxima escala.",
      context,
    });

    expect(result?.proposals).toEqual([proposal]);
    expect(result?.usedTools).toEqual([
      "get_operational_summary",
      "draft_schedule_from_previous_service",
    ]);
    expect(result?.answer).toContain("rascunho");
  });
});
