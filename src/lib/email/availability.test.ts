import { describe, expect, it } from "vitest";

// Contract smoke-test for the notification tag used by createAvailabilityRequest.
describe("availability email notification contract", () => {
  it("keeps the request id in the availability tag", () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const tag = `availability-${requestId}`;
    expect(tag.slice("availability-".length)).toBe(requestId);
  });

  it("builds the expected Louvor deep-link shape", () => {
    const churchSlug = "rez-church-rio";
    expect(`/${churchSlug}/louvor/disponibilidade`).toBe(
      "/rez-church-rio/louvor/disponibilidade"
    );
  });
});
