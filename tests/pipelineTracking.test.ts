import { describe, expect, it } from "vitest";
import {
  markApplied,
  scheduleFollowUp,
  updateNextAction,
  updatePipelineStatus
} from "../src/core/pipeline.js";
import type { Opportunity } from "../src/types/index.js";

describe("pipeline tracking", () => {
  it("updates statuses locally and records applied timestamps", () => {
    const applied = markApplied([opportunity()], "opp_1", {
      now: "2026-05-02T10:00:00.000Z"
    });

    expect(applied[0]).toMatchObject({
      status: "applied",
      appliedAt: "2026-05-02T10:00:00.000Z",
      lastUpdated: "2026-05-02T10:00:00.000Z"
    });
    expect(applied[0].nextAction).toContain("manual application");
  });

  it("sets follow-up dates and next actions without submitting anything", () => {
    const withFollowUp = scheduleFollowUp([opportunity()], "opp_1", "2026-05-10", {
      now: "2026-05-02T10:00:00.000Z"
    });
    const withNext = updateNextAction(withFollowUp, "opp_1", "Prepare final review", {
      now: "2026-05-02T11:00:00.000Z"
    });
    const ignored = updatePipelineStatus(withNext, "opp_1", "ignored", {
      now: "2026-05-02T12:00:00.000Z"
    });

    expect(withFollowUp[0]).toMatchObject({
      status: "follow_up_due",
      followUpDate: "2026-05-10",
      nextAction: "Follow up manually on 2026-05-10"
    });
    expect(withNext[0]).toMatchObject({
      nextAction: "Prepare final review",
      lastUpdated: "2026-05-02T11:00:00.000Z"
    });
    expect(ignored[0]).toMatchObject({
      status: "ignored",
      nextAction: "Do not pursue unless new information changes fit"
    });
  });
});

function opportunity(): Opportunity {
  return {
    id: "opp_1",
    createdAt: "2026-05-01T00:00:00.000Z",
    lastUpdated: "2026-05-01T00:00:00.000Z",
    company: "BlueOrbit Systems",
    role: "Remote Implementation Lead",
    url: "https://example.com/job",
    source: "Manual",
    jobDescription: "Remote implementation role.",
    deadline: "2026-05-15",
    contact: "",
    method: "web",
    notes: "",
    status: "review_ready"
  };
}
