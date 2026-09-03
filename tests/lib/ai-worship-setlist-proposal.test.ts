import { describe, expect, it, vi } from "vitest";
import { runLunorAssistant } from "@/lib/ai/assistant";
import { isWorshipSetlistProposal } from "@/lib/ai/worship-setlist-proposal";

describe("Worship setlist proposal", () => {
  const proposal = {
    kind: "worship_setlist_proposal" as const,
    event: {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Culto de Domingo",
      startsAt: "2026-09-13T18:00:00.000Z",
    },
    songs: [
      {
        position: 1,
        songId: "22222222-2222-4222-8222-222222222222",
        title: "Música A",
        artist: "Artista A",
        defaultKey: "G",
        bpm: 72,
        timeSignature: "4/4",
        usesLast120Days: 0,
        lastUsedAt: null,
      },
      {
        position: 2,
        songId: "33333333-3333-4333-8333-333333333333",
        title: "Música B",
        artist: "Artista B",
        defaultKey: "A",
        bpm: 78,
        timeSignature: "4/4",
        usesLast120Days: 1,
        lastUsedAt: "2026-08-16T18:00:00.000Z",
      },
    ],
    transitions: [],
    warnings: [],
  };

  it("reconhece somente proposta estruturada válida", () => {
    expect(isWorshipSetlistProposal(proposal)).toBe(true);
    expect(isWorshipSetlistProposal({ kind: "worship_setlist_proposal" })).toBe(false);
    expect(isWorshipSetlistProposal({ kind: "assignment", songs: [] })).toBe(false);
  });

  it("coleta proposta do Louvor sem gravar dados", async () => {
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
        text: "Preparei uma proposta de repertório para sua revisão.",
        toolCalls: [],
      });
    const toolExecutor = vi.fn().mockResolvedValue(proposal);

    const result = await runLunorAssistant({
      question: "Sugira duas músicas do acervo para domingo",
      context: {
        churchId: "church-1",
        ministryId: "ministry-1",
        ministryName: "Louvor",
      },
      runner,
      toolExecutor,
    });

    expect(result.worshipSetlistProposals).toEqual([proposal]);
    expect(result.proposals).toEqual([]);
    expect(result.usedTools).toEqual(["propose_worship_setlist"]);
    expect(toolExecutor).toHaveBeenCalledTimes(1);
  });
});
