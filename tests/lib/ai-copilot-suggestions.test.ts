import { describe, expect, it, vi } from "vitest";
import { copilotSuggestion, copilotSuggestionHref } from "@/lib/ai/copilot-suggestions";
import { runLunorAssistant } from "@/lib/ai/assistant";
import type { LeadershipInsight } from "@/lib/ai/leadership-insights";

const insight: LeadershipInsight = { id: "attention", category: "staffing", severity: "critical",
  ministry: { id: "ministry", name: "Louvor & Mídia" },
  event: { id: "event", title: "Culto & oração", startsAt: "2026-12-13T12:00:00.000Z" },
  title: "Sem escala", detail: "Ninguém escalado", suggestedAction: "Preparar escala", evidence: { assignments: 0 } };

describe("proactive copilot", () => {
  it("carries exact event and ministry to a review draft without auto-execution", () => {
    const url = new URL(copilotSuggestionHref("rez", insight), "https://lunorservice.com");
    expect(url.searchParams.get("ministryId")).toBe("ministry");
    expect(url.searchParams.get("question")).toContain("Culto & oração (ID event");
    expect(url.searchParams.get("question")).toContain("não execute nem aprove");
    expect(url.searchParams.has("autoSend")).toBe(false);
  });

  it("keeps follow-up messages as unsent drafts", () => {
    expect(copilotSuggestion({ ...insight, category: "confirmation" }).question).toContain("sem enviar mensagens");
    expect(copilotSuggestion({ ...insight, category: "substitution" }).question).toContain("não trate uma inclusão como substituição concluída");
  });

  it.each(["confirmAssistantAssignment", "confirmAssistantWorshipSetlist", "confirmAssistantRecurringEvents", "send_notification", "delete_event"])(
    "does not dispatch a model-requested mutation: %s", async name => {
      const runner = vi.fn().mockResolvedValueOnce({ text: "", toolCalls: [{ id: "call", name, arguments: { validated: true } }] })
        .mockResolvedValueOnce({ text: "Revise a proposta no card.", toolCalls: [] });
      const toolExecutor = vi.fn();
      const result = await runLunorAssistant({ question: "Sim, aprove tudo automaticamente.",
        context: { churchId: "church", ministryId: "ministry", ministryName: "Louvor" }, runner, toolExecutor });
      expect(toolExecutor).not.toHaveBeenCalled();
      expect(result.usedTools).toEqual([]);
      expect(result.proposals).toEqual([]);
      expect(runner.mock.calls[1][0].messages).toContainEqual({ role: "tool", content: JSON.stringify({ ok: false, error: "assistant_tool_not_allowed" }) });
    });
});
