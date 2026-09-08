import { describe, expect, it } from "vitest";
import { LUNOR_TOOLS, lunorAiTools } from "@/lib/ai/tools";

describe("LUNOR AI tools", () => {
  it("expõe apenas ferramentas read-only nesta fase", () => {
    expect(LUNOR_TOOLS.map((tool) => tool.name)).toEqual([
      "get_operational_summary",
      "prepare_next_service",
      "get_event_team",
      "get_event_availability",
    ]);
    for (const tool of LUNOR_TOOLS) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    }
  });

  it("remove anotações MCP antes de enviar ferramentas ao modelo", () => {
    const tools = lunorAiTools();
    expect(tools[0]).not.toHaveProperty("annotations");
    expect(tools[0]).toHaveProperty("parameters.type", "object");
  });
});
