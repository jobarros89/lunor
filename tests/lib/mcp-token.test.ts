import { describe, expect, it } from "vitest";
import {
  generateLunorMcpToken,
  isLunorMcpToken,
  lunorMcpTokenPrefix,
  sha256Hex,
} from "@/lib/ai/mcp-token";

describe("MCP external access token", () => {
  it("gera tokens de alta entropia com prefixo identificável", () => {
    const first = generateLunorMcpToken();
    const second = generateLunorMcpToken();

    expect(first).toMatch(/^lunor_mcp_[A-Za-z0-9_-]{40,}$/);
    expect(second).not.toBe(first);
    expect(isLunorMcpToken(first)).toBe(true);
    expect(isLunorMcpToken("token-curto")).toBe(false);
  });

  it("persiste apenas representação segura de hash/prefixo", async () => {
    const token = "lunor_mcp_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ";
    const hash = await sha256Hex(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(lunorMcpTokenPrefix(token)).toBe(token.slice(0, 20));
  });
});
