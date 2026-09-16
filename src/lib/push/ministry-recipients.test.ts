import { describe, expect, it } from "vitest";

import {
  ministryOperationalRecipientIds,
  type MinistryRecipientMembership,
} from "./ministry-recipients";

const CHURCH = "123e4567-e89b-12d3-a456-426614174000";
const LOUVOR = "223e4567-e89b-12d3-a456-426614174000";
const KIDS = "323e4567-e89b-12d3-a456-426614174000";

function member(
  userId: string,
  ministryId: string,
  role: string,
  active = true
): MinistryRecipientMembership {
  return {
    user_id: userId,
    church_id: CHURCH,
    ministry_id: ministryId,
    role,
    active,
  };
}

describe("ministryOperationalRecipientIds", () => {
  it("includes active gerente/lider of the target ministry", () => {
    const memberships = [
      member("louvor-gerente", LOUVOR, "gerente"),
      member("louvor-lider", LOUVOR, "lider"),
    ];

    expect(
      ministryOperationalRecipientIds(memberships, {
        churchId: CHURCH,
        ministryId: LOUVOR,
      })
    ).toEqual(["louvor-gerente", "louvor-lider"]);
  });

  it("excludes Kids managers from Louvor notifications", () => {
    const memberships = [
      member("kids-gerente", KIDS, "gerente"),
      member("louvor-lider", LOUVOR, "lider"),
    ];

    expect(
      ministryOperationalRecipientIds(memberships, {
        churchId: CHURCH,
        ministryId: LOUVOR,
      })
    ).toEqual(["louvor-lider"]);
  });

  it("excludes volunteers and inactive leaders", () => {
    const memberships = [
      member("voluntario", LOUVOR, "voluntario"),
      member("inactive-gerente", LOUVOR, "gerente", false),
    ];

    expect(
      ministryOperationalRecipientIds(memberships, {
        churchId: CHURCH,
        ministryId: LOUVOR,
      })
    ).toEqual([]);
  });

  it("keeps the explicit assignment leader and deduplicates it", () => {
    const memberships = [member("assignment-leader", LOUVOR, "lider")];

    expect(
      ministryOperationalRecipientIds(memberships, {
        churchId: CHURCH,
        ministryId: LOUVOR,
        explicitLeaderId: "assignment-leader",
      })
    ).toEqual(["assignment-leader"]);
  });
});
