import { describe, expect, it } from "vitest";

import { assignmentReferenceFromTag } from "./assignment-reference";

const ID = "123e4567-e89b-12d3-a456-426614174000";

describe("assignmentReferenceFromTag", () => {
  it("accepts an exact assignment id tag", () => {
    expect(assignmentReferenceFromTag(`assignment-${ID}`)).toEqual({
      kind: "assignment",
      id: ID,
    });
  });

  it("accepts an exact event id tag", () => {
    expect(assignmentReferenceFromTag(`assign-${ID}`)).toEqual({
      kind: "event",
      id: ID,
    });
  });

  it("rejects the substitution-response tag that caused the incident", () => {
    expect(assignmentReferenceFromTag(`assignment-response-${ID}`)).toBeNull();
  });

  it("rejects future assignment-prefixed notification kinds", () => {
    expect(assignmentReferenceFromTag(`assignment-reminder-${ID}`)).toBeNull();
    expect(assignmentReferenceFromTag(`assignment-leader-${ID}`)).toBeNull();
  });

  it("rejects malformed, extended and missing tags", () => {
    expect(assignmentReferenceFromTag(`assignment-${ID}-extra`)).toBeNull();
    expect(assignmentReferenceFromTag("assignment-not-a-uuid")).toBeNull();
    expect(assignmentReferenceFromTag("assignment-")).toBeNull();
    expect(assignmentReferenceFromTag("")).toBeNull();
    expect(assignmentReferenceFromTag()).toBeNull();
  });
});
