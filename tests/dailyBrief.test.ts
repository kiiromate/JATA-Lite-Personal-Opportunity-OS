import { describe, expect, it } from "vitest";
import { generateDailyBrief } from "../src/generators/dailyBrief.js";
import type { Opportunity } from "../src/types/index.js";

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp_1",
    createdAt: "2026-04-30T00:00:00.000Z",
    lastUpdated: "2026-04-30T00:00:00.000Z",
    company: "Acme Labs",
    role: "Implementation Specialist",
    url: "https://example.com/job",
    source: "Manual",
    jobDescription: "Remote implementation role.",
    deadline: "2026-05-15",
    contact: "",
    method: "email",
    notes: "",
    status: "review_ready",
    nextAction: "Human review application pack",
    score: {
      strategicFitScore: 82,
      sectorFit: 8,
      roleFit: 9,
      compensationPotential: 7,
      remoteGlobalFit: 8,
      networkValue: 5,
      effortLevel: "medium",
      decision: "Pursue",
      rationale: "Strong target lane fit."
    },
    ...overrides
  };
}

describe("generateDailyBrief", () => {
  it("includes pipeline sections for top opportunities, follow-ups, review-ready packs, stale items, and low-priority work", () => {
    const brief = generateDailyBrief(
      [
        opportunity(),
        opportunity({
          id: "opp_followup",
          company: "FollowUp Labs",
          status: "follow_up_due",
          followUpDate: "2026-05-01",
          nextAction: "Send manual follow-up"
        }),
        opportunity({
          id: "opp_stale",
          company: "Stale Systems",
          status: "scored",
          lastUpdated: "2026-04-20T00:00:00.000Z",
          nextAction: "Decide whether to keep active"
        }),
        opportunity({
          id: "opp_low",
          company: "Low Priority Co",
          priorityBand: "D",
          status: "ignored",
          score: {
            strategicFitScore: 35,
            sectorFit: 2,
            roleFit: 2,
            compensationPotential: 3,
            remoteGlobalFit: 2,
            networkValue: 2,
            effortLevel: "high",
            decision: "Ignore",
            rationale: "Low fit."
          }
        })
      ],
      "2026-05-01"
    );

    expect(brief).toContain("## 20-Minute Workflow");
    expect(brief).toContain("## Today's Top 5 Opportunities");
    expect(brief).toContain("## Urgent Deadlines");
    expect(brief).toContain("## Review-Ready Packs");
    expect(brief).toContain("## Follow-ups Due");
    expect(brief).toContain("## Stale Opportunities");
    expect(brief).toContain("## Do Not Touch Today");
    expect(brief).toContain("0-5 min");
    expect(brief).toContain("5-15 min");
    expect(brief).toContain("15-20 min");
    expect(brief).toContain(
      "Acme Labs - Implementation Specialist: Human review application pack"
    );
    expect(brief).toContain("FollowUp Labs");
    expect(brief).toContain("Stale Systems");
    expect(brief).toContain("Low Priority Co");
  });
});
