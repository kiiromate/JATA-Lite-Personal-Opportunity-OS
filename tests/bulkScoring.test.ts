import { describe, expect, it } from "vitest";
import { enrichOpportunityWithScore } from "../src/core/bulkScoring.js";
import { createOpportunity } from "../src/core/opportunity.js";
import type { Opportunity, Profile } from "../src/types/index.js";

const profile: Profile = {
  name: "Kaze",
  positioning:
    "Multidisciplinary builder and strategic consultant connecting technology, business, operations, and sustainability.",
  strengths: [
    "fintech sales and customer success",
    "infrastructure project coordination",
    "automation",
    "business development",
    "project execution"
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

describe("bulk scoring", () => {
  it("assigns deterministic priority bands, effort, risk, and recommended action", () => {
    const strong = enrichOpportunityWithScore(
      opportunity({
        id: "opp_strong",
        company: "BlueOrbit Systems",
        role: "Remote Implementation Lead",
        jobDescription:
          "Remote global implementation lead for fintech automation customers. Requires customer success, project coordination, business development, operations, and automation delivery.",
        method: "referral",
        source: "Referral"
      }),
      profile,
      "2026-05-02T00:00:00.000Z"
    );
    const risky = enrichOpportunityWithScore(
      opportunity({
        id: "opp_risky",
        company: "Health Workforce Tools",
        role: "Project Manager Workforce",
        jobDescription:
          "Remote global implementation specialist role requiring automation, customer success, business development, operations, project coordination, donor-funded public health workforce development, safeguarding, reporting, and Ministry of Health coordination.",
        method: "web"
      }),
      profile,
      "2026-05-02T00:00:00.000Z"
    );
    const weak = enrichOpportunityWithScore(
      opportunity({
        id: "opp_weak",
        company: "Granite Retail Group",
        role: "Onsite Store Supervisor",
        jobDescription:
          "Onsite retail supervisor role with night shifts, local presence required, inventory handling, and no remote option.",
        method: "web"
      }),
      profile,
      "2026-05-02T00:00:00.000Z"
    );

    expect(strong.priorityBand).toBe("A");
    expect(strong.effortEstimate).toBe("low");
    expect(strong.applicationRiskLevel).toBe("low");
    expect(strong.recommendedAction).toContain("Shortlist");
    expect(risky.priorityBand).toBe("B");
    expect(risky.applicationRiskLevel).toBe("high");
    expect(risky.recommendedAction).toContain("evidence gaps");
    expect(weak.priorityBand).toBe("D");
    expect(weak.recommendedAction).toContain("Ignore");
  });
});

function opportunity(overrides: Partial<Opportunity>): Opportunity {
  return {
    ...createOpportunity(
      {
        company: "Test Company",
        role: "Test Role",
        source: "Manual",
        jobDescription: "Remote implementation automation role.",
        method: "web"
      },
      {
        id: "opp_base",
        now: "2026-05-01T00:00:00.000Z"
      }
    ),
    ...overrides
  };
}
