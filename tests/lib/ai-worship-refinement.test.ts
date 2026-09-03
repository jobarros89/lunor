import { describe, expect, it, vi } from "vitest";
import { runLunorAssistant } from "@/lib/ai/assistant";

const proposal = {
  kind: "worship_setlist_proposal" as const,
  event: {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Culto de Domingo",
    startsAt: "2026-09-06T18:00:00.000Z",
  },
  songs: [
    {
      position: 1,
      songId: "22222222-2222-4222-8222-222222222222",
      title: "Gratidão",
      artist: "Artista 1",
      defaultKey: "G",
      bpm: 72,
      timeSignature: "4/4",
      usesLast120Days: 1,
      lastUsedAt: null,
    },
    {
      position: 2,
      songId: "33333333-3333-4333-8333-333333333333",
      title: "Santo Pra Sempre",
      artist: "Artista 2",
      defaultKey: "A",
      bpm: 74,
      timeSignature: "4/4",
      usesLast120Days: 0,
      lastUsedAt: null,
    },
    {
      position: 3,
      songId: "44444444-4444-4444-8444-444444444444",
      title: "Bondade de Deus",
      artist: "Artista 3",
      defaultKey: "Bb",
      bpm: 68,
      timeSignature: "4/4",
      usesLast120Days: 2,
      lastUsedAt: null,
    },
  ],
  transitions: [],
  warnings: [],
};

describe("refinamento conversacional do Louvor", () => {
  it("mantém uma descrição ordenada da proposta no histórico quando o texto do modelo não lista as músicas", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          {
            id: "call-setlist",
            name: "propose_worship_setlist",
            arguments: {
              eventId: proposal.event.id,
              songIds: proposal.songs.map((song) => song.songId),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Preparei uma proposta para você revisar.",
        toolCalls: [],
      });
    const toolExecutor = vi.fn().mockResolvedValue(proposal);

    const result = await runLunorAssistant({
      question: "Sugira 3 músicas para domingo",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Louvor",
      },
      runner,
      toolExecutor,
    });

    expect(result.worshipSetlistProposals).toEqual([proposal]);
    expect(result.answer).toContain("Proposta atual para refinamento");
    expect(result.answer).toContain("1. Gratidão");
    expect(result.answer).toContain("2. Santo Pra Sempre");
    expect(result.answer).toContain("3. Bondade de Deus");

    const firstCall = runner.mock.calls[0]?.[0];
    const systemMessage = firstCall.messages.find(
      (message: { role: string }) => message.role === "system"
    );
    expect(systemMessage.content).toContain("troque a segunda música");
    expect(systemMessage.content).toContain("preserve o mesmo culto");
  });

  it("não repete o resumo quando a resposta do modelo já contém todas as músicas", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        text: "",
        toolCalls: [
          {
            id: "call-setlist-2",
            name: "propose_worship_setlist",
            arguments: {
              eventId: proposal.event.id,
              songIds: proposal.songs.map((song) => song.songId),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        text: "Sugestão: Gratidão, Santo Pra Sempre e Bondade de Deus.",
        toolCalls: [],
      });

    const result = await runLunorAssistant({
      question: "Monte uma proposta",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Louvor",
      },
      runner,
      toolExecutor: vi.fn().mockResolvedValue(proposal),
    });

    expect(result.answer).not.toContain("Proposta atual para refinamento");
  });
});
