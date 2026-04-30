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
  it("includes a concise 20-minute workflow focused on the highest-value next action", () => {
    const brief = generateDailyBrief([opportunity()], "2026-05-01");

    expect(brief).toContain("## 20-Minute Workflow");
    expect(brief).toContain("0-5 min");
    expect(brief).toContain("5-15 min");
    expect(brief).toContain("15-20 min");
    expect(brief).toContain(
      "Acme Labs - Implementation Specialist: Human review application pack"
    );
  });
});
