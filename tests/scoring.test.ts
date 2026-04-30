import { describe, expect, it } from "vitest";
import { scoreOpportunity } from "../src/scoring/scorer.js";
import type { Opportunity, Profile } from "../src/types/index.js";

const profile: Profile = {
  name: "Kaze",
  positioning:
    "Multidisciplinary builder and strategic consultant connecting technology, business, operations, and sustainability.",
  strengths: [
    "fintech sales and customer success",
    "infrastructure project coordination",
    "automation",
    "business development"
  ],
  targetLanes: [
    "digital operations",
    "implementation specialist",
    "customer success",
    "fintech",
    "climate/agri tech",
    "automation consulting"
  ],
  constraints: ["remote-friendly", "global mobility preferred"],
  languages: ["English", "French", "Kinyarwanda", "Swahili"]
};

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp_1",
    createdAt: "2026-04-30T00:00:00.000Z",
    lastUpdated: "2026-04-30T00:00:00.000Z",
    company: "FinClimate Labs",
    role: "Implementation Specialist",
    url: "https://example.com/job",
    source: "LinkedIn",
    jobDescription:
      "Remote implementation specialist role for fintech and climate technology customers. Requires customer success, automation, project coordination, and business development experience.",
    deadline: "2026-05-15",
    contact: "recruiter@example.com",
    method: "email",
    notes: "Strong match.",
    status: "captured",
    ...overrides
  };
}

describe("scoreOpportunity", () => {
  it("scores strong target-lane matches as pursue without AI", () => {
    const score = scoreOpportunity(opportunity(), profile);

    expect(score.decision).toBe("Pursue");
    expect(score.strategicFitScore).toBeGreaterThanOrEqual(70);
    expect(score.sectorFit).toBeGreaterThanOrEqual(7);
    expect(score.roleFit).toBeGreaterThanOrEqual(7);
    expect(score.remoteGlobalFit).toBeGreaterThanOrEqual(7);
    expect(score.rationale).toContain("target lane");
  });

  it("scores weak or unrelated opportunities as ignore", () => {
    const score = scoreOpportunity(
      opportunity({
        company: "Factory Floor Inc",
        role: "Onsite Warehouse Picker",
        jobDescription:
          "Onsite warehouse picker role with night shifts, local presence required, heavy manual inventory handling, and no remote option.",
        method: "web"
      }),
      profile
    );

    expect(score.decision).toBe("Ignore");
    expect(score.strategicFitScore).toBeLessThan(50);
    expect(score.effortLevel).toBe("medium");
  });
});
