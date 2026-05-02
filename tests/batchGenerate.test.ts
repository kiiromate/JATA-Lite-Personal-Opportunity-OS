import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateBatchApplicationPacks } from "../src/generators/batchGenerator.js";
import type { AIProvider } from "../src/generators/aiProvider.js";
import type { Opportunity, Profile } from "../src/types/index.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("batch application pack generation", () => {
  it("respects the top limit and skips D-band opportunities by default", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-batch-"));

    const result = await generateBatchApplicationPacks({
      opportunities: [
        opportunity("opp_a1", "A", 88),
        opportunity("opp_a2", "A", 84),
        opportunity("opp_b1", "B", 72),
        opportunity("opp_d1", "D", 42)
      ],
      profile,
      outputRoot: tempDir,
      top: 2,
      date: "2026-05-02"
    });

    expect(result.generated.map((item) => item.id)).toEqual(["opp_a1", "opp_a2"]);
    expect(result.skipped.map((item) => item.id)).toContain("opp_d1");
    expect(
      result.updatedOpportunities.filter(
        (item) => item.status === "review_ready" && item.packPath
      )
    ).toHaveLength(2);
  });

  it("allows explicit D-band generation by id without calling an external provider", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-batch-explicit-"));
    let externalProviderCalled = false;
    const provider: AIProvider = {
      name: "external-test-provider",
      async generate(): Promise<string> {
        externalProviderCalled = true;
        throw new Error("External provider must not be called");
      }
    };

    const result = await generateBatchApplicationPacks({
      opportunities: [opportunity("opp_d1", "D", 42)],
      profile,
      outputRoot: tempDir,
      ids: ["opp_d1"],
      aiProvider: provider,
      date: "2026-05-02"
    });

    expect(result.generated.map((item) => item.id)).toEqual(["opp_d1"]);
    expect(externalProviderCalled).toBe(false);
  });
});

const profile: Profile = {
  name: "Kaze",
  positioning: "Automation consultant.",
  strengths: ["automation", "project execution"],
  targetLanes: ["implementation specialist"],
  constraints: ["no fabricated work history"],
  languages: ["English"]
};

function opportunity(
  id: string,
  priorityBand: Opportunity["priorityBand"],
  score: number
): Opportunity {
  return {
    id,
    createdAt: "2026-05-01T00:00:00.000Z",
    lastUpdated: "2026-05-01T00:00:00.000Z",
    company: `${id} Company`,
    role: "Implementation Specialist",
    url: `https://example.com/${id}`,
    source: "Manual",
    jobDescription:
      "Implementation role for operations automation and project execution.",
    deadline: "2026-05-20",
    contact: "",
    method: "web",
    notes: "",
    status: "scored",
    priorityBand,
    applicationRiskLevel: priorityBand === "D" ? "high" : "low",
    effortEstimate: priorityBand === "D" ? "high" : "medium",
    recommendedAction:
      priorityBand === "D" ? "Ignore unless fit changes" : "Shortlist",
    score: {
      strategicFitScore: score,
      sectorFit: 7,
      roleFit: 7,
      compensationPotential: 6,
      remoteGlobalFit: 6,
      networkValue: 4,
      effortLevel: priorityBand === "D" ? "high" : "medium",
      decision: priorityBand === "D" ? "Ignore" : "Pursue",
      rationale: "Test rationale."
    }
  };
}
