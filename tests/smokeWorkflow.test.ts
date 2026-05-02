import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createOpportunity, validateOpportunityInput } from "../src/core/opportunity.js";
import { runSmokeWorkflow } from "../src/smoke/runSmoke.js";
import type { Opportunity, OpportunityInput } from "../src/types/index.js";

const repoRoot = process.cwd();
const smokeRoot = join(repoRoot, ".local", "smoke");

async function loadSampleFixture(): Promise<OpportunityInput> {
  const raw = await readFile(
    join(repoRoot, "fixtures", "sample-opportunity.json"),
    "utf8"
  );

  return JSON.parse(raw) as OpportunityInput;
}

afterEach(async () => {
  await rm(smokeRoot, { recursive: true, force: true });
});

describe("first-use smoke workflow", () => {
  it("loads and validates the fictional sample opportunity fixture", async () => {
    const fixture = await loadSampleFixture();
    const contactLikeText = [
      fixture.contact,
      fixture.jobDescription,
      fixture.notes
    ].join(" ");

    expect(fixture).toMatchObject({
      company: "GreenGrid Labs",
      role: "Operations & Implementation Associate",
      source: "Manual Test",
      method: "email",
      deadline: "2026-06-15"
    });
    expect(contactLikeText).not.toMatch(
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
    );
    expect(contactLikeText).not.toMatch(/\+?\d[\d\s().-]{7,}\d/);
    expect(validateOpportunityInput(fixture)).toEqual([]);

    const opportunity = createOpportunity(fixture, {
      id: "opp_fixture",
      now: "2026-05-01T00:00:00.000Z"
    });

    expect(opportunity.company).toBe("GreenGrid Labs");
  });

  it("runs the full local smoke workflow without external AI", async () => {
    const result = await runSmokeWorkflow({
      repoRoot,
      logger: () => undefined,
      env: {
        JATA_AI_PROVIDER: "openrouter",
        JATA_AI_MODE: "true",
        OPENROUTER_API_KEY: "test-key"
      }
    });

    const opportunities = JSON.parse(
      await readFile(result.opportunitiesFile, "utf8")
    ) as Opportunity[];
    const dailyBrief = await readFile(result.dailyBriefPath, "utf8");
    const trackerCsv = await readFile(result.trackerCsvPath, "utf8");
    const shortlist = await readFile(result.shortlistMarkdownPath, "utf8");
    const firstPack = result.batchApplicationPacks[0];
    if (!firstPack) {
      throw new Error("Smoke workflow did not generate a batch pack.");
    }
    const fitAnalysis = await readFile(
      join(firstPack.directory, "01-fit-analysis.md"),
      "utf8"
    );
    const checklist = await readFile(
      join(firstPack.directory, "05-application-checklist.md"),
      "utf8"
    );

    expect(result.smokeRoot).toBe(smokeRoot);
    expect(opportunities).toHaveLength(7);
    expect(opportunities.filter((item) => item.status === "review_ready")).toHaveLength(2);
    expect(opportunities[0]).toMatchObject({
      company: "BlueOrbit Systems",
      role: "Remote Implementation Lead",
      status: "review_ready"
    });
    expect(opportunities[0].priorityBand).toBe("A");
    expect(dailyBrief).toContain("Today's Top 5 Opportunities");
    expect(dailyBrief).toContain("Review-Ready Packs");
    expect(trackerCsv).toContain("priorityBand");
    expect(shortlist).toContain("## A - Strong pursue");
    expect(fitAnalysis).toContain("Human Review Required");
    expect(fitAnalysis).toContain("Claims to Verify Before Sending");
    expect(fitAnalysis).toContain("Evidence Needed Before Sending");
    expect(fitAnalysis).toContain("Missing Evidence");
    expect(checklist).toContain("Evidence To Add If True");
    expect(checklist).toContain("Claims To Remove Unless Verified");
    expect(fitAnalysis).not.toContain("AI Provider Appendix");
  }, 30000);
});
