import { describe, expect, it } from "vitest";
import {
  generateShortlistCsv,
  generateShortlistMarkdown,
  selectShortlist
} from "../src/generators/shortlist.js";
import type { Opportunity } from "../src/types/index.js";

describe("shortlist generation", () => {
  it("ranks A-band opportunities above C and D opportunities and explains next actions", () => {
    const ranked = selectShortlist(
      [
        opportunity("opp_d", "D", 42, "high", "Ignore unless fit changes"),
        opportunity("opp_a", "A", 84, "low", "Shortlist and prepare pack"),
        opportunity("opp_c", "C", 58, "medium", "Park for later")
      ],
      { top: 3, date: "2026-05-02" }
    );
    const markdown = generateShortlistMarkdown(ranked, {
      date: "2026-05-02"
    });
    const csv = generateShortlistCsv(ranked);

    expect(ranked.map((item) => item.id)).toEqual(["opp_a", "opp_c", "opp_d"]);
    expect(markdown).toContain("## A - Strong pursue");
    expect(markdown).toContain("## B - Worth review");
    expect(markdown).toContain("## C - Maybe later");
    expect(markdown).toContain("## D - Ignore");
    expect(markdown).toContain("Why ranked:");
    expect(markdown).toContain("Next action: Shortlist and prepare pack");
    expect(csv.split("\n")[0]).toContain("priorityBand");
  });

  it("filters by priority band and maximum application risk", () => {
    const ranked = selectShortlist(
      [
        opportunity("opp_a_low", "A", 88, "low", "Shortlist"),
        opportunity("opp_a_high", "A", 82, "high", "Review gaps"),
        opportunity("opp_b_medium", "B", 72, "medium", "Review")
      ],
      { band: "A", maxRisk: "medium", date: "2026-05-02" }
    );

    expect(ranked.map((item) => item.id)).toEqual(["opp_a_low"]);
  });
});

function opportunity(
  id: string,
  priorityBand: Opportunity["priorityBand"],
  score: number,
  risk: Opportunity["applicationRiskLevel"],
  recommendedAction: string
): Opportunity {
  return {
    id,
    createdAt: "2026-05-01T00:00:00.000Z",
    lastUpdated: "2026-05-01T00:00:00.000Z",
    company: `${id} Company`,
    role: `${id} Role`,
    url: `https://example.com/${id}`,
    source: "Manual",
    jobDescription: "Description",
    deadline: id.endsWith("_d") ? "2026-05-03" : "2026-05-20",
    contact: "",
    method: "web",
    notes: "",
    status: "scored",
    priorityBand,
    applicationRiskLevel: risk,
    effortEstimate: risk === "high" ? "high" : "medium",
    recommendedAction,
    nextAction: recommendedAction,
    score: {
      strategicFitScore: score,
      sectorFit: 7,
      roleFit: 7,
      compensationPotential: 6,
      remoteGlobalFit: 6,
      networkValue: 4,
      effortLevel: risk === "high" ? "high" : "medium",
      decision: score >= 70 ? "Pursue" : score >= 50 ? "Maybe" : "Ignore",
      rationale: "Test rationale."
    }
  };
}
