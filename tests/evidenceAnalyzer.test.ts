import { describe, expect, it } from "vitest";
import { analyzeEvidence } from "../src/core/evidenceAnalyzer.js";
import type { Opportunity, Profile } from "../src/types/index.js";

describe("analyzeEvidence", () => {
  it("detects Fred Hollows-style missing evidence conservatively", () => {
    const analysis = analyzeEvidence({
      profile: testProfile(),
      opportunity: healthWorkforceOpportunity()
    });

    expect(analysis.applicationRiskLevel).toBe("high");
    expect(analysis.strongMatches).toContain(
      "Project/program coordination and implementation execution"
    );
    expect(analysis.transferableMatches).toContain(
      "Infrastructure project coordination can transfer to structured workplan delivery and partner follow-through."
    );
    expect(analysis.missingEvidence).toContain(
      "Direct public health or eye health programme delivery evidence"
    );
    expect(analysis.missingEvidence).toContain(
      "Donor-funded project delivery, budget, and reporting evidence"
    );
    expect(analysis.missingEvidence).toContain(
      "Formal workforce development or capacity strengthening evidence"
    );
    expect(analysis.missingEvidence).toContain(
      "Training systems, faculty development, mentorship, or CPD evidence"
    );
    expect(analysis.missingEvidence).toContain(
      "Safeguarding or child-safe implementation evidence"
    );
    expect(analysis.riskyClaims).toContain(
      "Direct public health or eye health programme delivery"
    );
    expect(analysis.riskyClaims).toContain(
      "Donor-funded programme ownership or reporting"
    );
    expect(analysis.riskyClaims).toContain(
      "Formal workforce development or training systems leadership"
    );
    expect(analysis.riskyClaims).toContain(
      "Safeguarding or child-safe implementation responsibility"
    );
  });
});

function testProfile(): Profile {
  return {
    name: "Kaze",
    positioning:
      "Multidisciplinary builder and strategic consultant connecting technology, business, operations, and sustainability.",
    strengths: [
      "fintech sales and customer success",
      "infrastructure project coordination",
      "conservation technology",
      "bilingual/multilingual communication",
      "automation",
      "business development",
      "project execution"
    ],
    targetLanes: [
      "digital operations",
      "implementation specialist",
      "customer success",
      "project/program coordination",
      "fintech",
      "climate/agri tech",
      "sustainable infrastructure",
      "automation consulting"
    ],
    constraints: [
      "remote-friendly",
      "global mobility preferred",
      "low budget",
      "high adaptability",
      "no fake credentials",
      "no fabricated work history"
    ],
    languages: ["English", "French", "Kinyarwanda", "Swahili"]
  };
}

function healthWorkforceOpportunity(): Opportunity {
  return {
    id: "opp_health_workforce",
    createdAt: "2026-05-01T00:00:00.000Z",
    lastUpdated: "2026-05-01T00:00:00.000Z",
    company: "Health Access Foundation",
    role: "Project Manager, Workforce",
    url: "https://example.com/health-workforce",
    source: "Manual Test",
    jobDescription: [
      "The role leads eye health workforce interventions aligned with Ministry of Health priorities.",
      "Requires 5-7 years of project or programme management in public health or international development.",
      "The manager will deliver donor-funded project workplans, budgets, forecasts, and reporting.",
      "The role strengthens pre-service and in-service training systems, faculty development, mentorship, and CPD.",
      "The role coordinates ministries, NGOs, academic institutions, training sites, and partners.",
      "Safeguarding, child-safe implementation, compliance, and risk judgement are required."
    ].join(" "),
    deadline: "2026-05-11",
    contact: "N/A",
    method: "web",
    notes: "",
    status: "scored"
  };
}
