import { beforeEach, describe, expect, it, vi } from "vitest";
import { assignmentReviewSnapshot, setlistReviewSnapshot, recurringReviewSnapshot, REVIEW_CHANGED, REVIEW_REQUIRED } from "@/lib/ai/human-review";

const mocks = vi.hoisted(() => ({ tenant: vi.fn(), ministries: vi.fn(), build: vi.fn(),
  buildSetlist: vi.fn(), add: vi.fn(), client: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getTenant: mocks.tenant }));
vi.mock("@/lib/ministry", () => ({ getActiveMinistry: mocks.ministries }));
vi.mock("@/lib/ai/scheduling", () => ({ buildAssignmentProposal: mocks.build }));
vi.mock("@/lib/ai/worship-setlist-proposal", () => ({ buildWorshipSetlistProposal: mocks.buildSetlist }));
vi.mock("@/lib/actions/escalas", () => ({ addAssignment: mocks.add }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));

import { confirmAssistantAssignment } from "@/lib/actions/ai-assignment";
import { confirmAssistantWorshipSetlist } from "@/lib/actions/ai-worship-setlist";
import { confirmAssistantRecurringEvents } from "@/lib/actions/ai-recurring-events";

const eventId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const ministryId = "33333333-3333-4333-8333-333333333333";
const proposal = { eventId, eventTitle: "Culto", startsAt: "2026-12-13T12:00:00.000Z",
  userId, userName: "Pessoa", roleName: "Baixo", departmentId: null, availability: "available" };
const input = { churchSlug: "rez", ministryId, eventId, userId, roleName: "Baixo" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.tenant.mockResolvedValue({ church: { id: "church" }, guardianOnly: false });
  mocks.ministries.mockResolvedValue({ options: [{ id: ministryId, name: "Louvor", canManage: true }] });
  mocks.build.mockResolvedValue(proposal);
  mocks.add.mockResolvedValue({ ok: true });
});

describe("human review at mutation boundary", () => {
  for (const [name, confirm] of [
    ["assignment", confirmAssistantAssignment], ["setlist", confirmAssistantWorshipSetlist],
    ["recurring events", confirmAssistantRecurringEvents],
  ] as const) {
    it.each([undefined, { validated: false, snapshot: "x" }, { validated: "true", snapshot: "x" }, { validated: true }])(
      `${name}: refuses absent or invalid review before accessing data (%j)`, async review => {
        expect(await confirm({ ...input, review })).toEqual({ ok: false, error: REVIEW_REQUIRED });
        expect(mocks.client).not.toHaveBeenCalled();
        expect(mocks.tenant).not.toHaveBeenCalled();
        expect(mocks.add).not.toHaveBeenCalled();
      });
  }

  it("only saves a validated assignment whose current data match the review", async () => {
    expect(await confirmAssistantAssignment({ ...input,
      review: { validated: true, snapshot: assignmentReviewSnapshot(proposal) },
    })).toEqual({ ok: true });
    expect(mocks.add).toHaveBeenCalledOnce();
    expect(mocks.add).toHaveBeenCalledWith(expect.objectContaining({ eventId, userId, ministryId, roleName: "Baixo" }));
  });

  it.each([{ startsAt: "2026-12-13T18:00:00.000Z" }, { availability: "unknown" }, { departmentId: userId }])(
    "rejects assignment changes after review (%j)", async change => {
      mocks.build.mockResolvedValue({ ...proposal, ...change });
      expect(await confirmAssistantAssignment({ ...input,
        review: { validated: true, snapshot: assignmentReviewSnapshot(proposal) },
      })).toEqual({ ok: false, error: REVIEW_CHANGED });
      expect(mocks.add).not.toHaveBeenCalled();
    });

  it("a reviewed proposal cannot bypass ministry permissions", async () => {
    mocks.ministries.mockResolvedValue({ options: [] });
    expect((await confirmAssistantAssignment({ ...input,
      review: { validated: true, snapshot: assignmentReviewSnapshot(proposal) },
    })).ok).toBe(false);
    expect(mocks.build).not.toHaveBeenCalled();
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("refuses a setlist if musical data changed since review", async () => {
    const setlist = { event: { id: eventId, title: "Culto", startsAt: proposal.startsAt },
      songs: [eventId, userId].map(songId => ({ songId, title: "Música", defaultKey: "C", bpm: 80, timeSignature: "4/4" })) };
    mocks.buildSetlist.mockResolvedValue({ ...setlist, songs: setlist.songs.map(s => ({ ...s, defaultKey: "D" })) });
    expect(await confirmAssistantWorshipSetlist({ churchSlug: "rez", ministryId, eventId,
      songIds: [eventId, userId], review: { validated: true, snapshot: setlistReviewSnapshot(setlist) },
    })).toEqual({ ok: false, error: REVIEW_CHANGED });
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it("recurring review binds the exact dates, duration and campus", () => {
    const recurring = { templateEventId: eventId, title: "Culto", campus: { id: ministryId },
      servicePeriod: "manha", templateStartsAt: proposal.startsAt, location: null,
      occurrences: [{ startsAt: proposal.startsAt, endsAt: null }] };
    const reviewed = recurringReviewSnapshot(recurring);
    expect(recurringReviewSnapshot({ ...recurring, campus: { id: userId } })).not.toBe(reviewed);
    expect(recurringReviewSnapshot({ ...recurring, occurrences: [] })).not.toBe(reviewed);
    expect(recurringReviewSnapshot({ ...recurring, occurrences: [{ ...recurring.occurrences[0], endsAt: "2026-12-13T14:00:00.000Z" }] })).not.toBe(reviewed);
  });
});
