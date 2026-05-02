import { describe, expect, it } from "vitest";
import { opportunitiesToCsv } from "../src/generators/csvExporter.js";
import type { Opportunity } from "../src/types/index.js";

describe("opportunitiesToCsv", () => {
  it("exports tracker rows with stable columns and escaped values", () => {
    const opportunities: Opportunity[] = [
      {
        id: "opp_1",
        createdAt: "2026-04-30T00:00:00.000Z",
        lastUpdated: "2026-04-30T01:00:00.000Z",
        company: "Acme, Inc",
        role: "Implementation Specialist",
        url: "https://example.com",
        source: "Manual",
        jobDescription: "Description",
        deadline: "2026-05-10",
        contact: "",
        method: "email",
        notes: "",
        status: "scored",
        nextAction: "Draft application pack",
        priorityBand: "A",
        applicationRiskLevel: "low",
        effortEstimate: "medium",
        recommendedAction: "Shortlist and prepare application pack",
        appliedAt: "2026-05-01T10:00:00.000Z",
        followUpDate: "2026-05-08",
        packPath: "outputs/pack",
        score: {
          strategicFitScore: 82,
          sectorFit: 8,
          roleFit: 9,
          compensationPotential: 7,
          remoteGlobalFit: 8,
          networkValue: 6,
          effortLevel: "medium",
          decision: "Pursue",
          rationale: "Strong fit."
        }
      }
    ];

    const csv = opportunitiesToCsv(opportunities);

    expect(csv.split("\n")[0]).toBe(
      "id,createdAt,company,role,source,url,deadline,method,status,strategicFitScore,decision,priorityBand,applicationRiskLevel,effortEstimate,recommendedAction,nextAction,appliedAt,followUpDate,lastUpdated,packPath"
    );
    expect(csv).toContain('"Acme, Inc"');
    expect(csv).toContain(",82,Pursue,A,low,medium,");
    expect(csv).toContain("outputs/pack");
  });
});
