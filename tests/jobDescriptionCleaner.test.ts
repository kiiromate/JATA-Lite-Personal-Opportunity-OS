import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { createOpportunity } from "../src/core/opportunity.js";
import { cleanJobDescription } from "../src/core/jobDescriptionCleaner.js";
import { scoreOpportunity } from "../src/scoring/scorer.js";
import type { Opportunity, Profile } from "../src/types/index.js";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("job description cleaner", () => {
  it("normalizes whitespace and removes duplicated fragments without inventing details", () => {
    const raw = [
      "Lead workforce planning across partners.",
      "Lead workforce planning across partners.",
      "The role is accountable for delivery The role is accountable for delivery",
      "Find out more at https://www.hollows.org/careers.",
      "Manage budgets, reporting, and safeguarding."
    ].join("\n\n");

    const result = cleanJobDescription(raw);

    expect(result.cleaned).toContain("Lead workforce planning across partners.");
    expect(
      result.cleaned.match(/Lead workforce planning across partners\./g)
    ).toHaveLength(1);
    expect(result.cleaned).toContain("The role is accountable for delivery");
    expect(result.cleaned).toContain("https://www.hollows.org/careers");
    expect(result.cleaned).toContain("Manage budgets, reporting, and safeguarding.");
    expect(result.cleaned).not.toContain("\n\n");
    expect(result.original).toBe(raw);
    expect(result.changed).toBe(true);
    expect(result.summary.join(" ")).toMatch(/duplicate/i);
  });

  it("marks an opportunity as needing regeneration and preserves the raw JD", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-clean-jd-"));
    const dataDir = join(tempDir, "data");
    const outputsDir = join(tempDir, "outputs");
    const profile = await readProfile();
    const opportunity = createOpportunity(
      {
        company: "Test Foundation",
        role: "Project Manager",
        url: "https://example.com/project-manager",
        source: "Manual",
        jobDescription: [
          "Implementation coordination for workforce planning.",
          "Implementation coordination for workforce planning.",
          "Donor reporting and workforce planning."
        ].join("\n"),
        deadline: "2026-05-11",
        contact: "",
        method: "web",
        notes: ""
      },
      {
        id: "opp_clean_test",
        now: "2026-05-01T00:00:00.000Z"
      }
    );
    const scoredOpportunity: Opportunity = {
      ...opportunity,
      status: "review_ready",
      nextAction: "Human review application pack",
      score: scoreOpportunity(opportunity, profile)
    };

    await mkdir(dataDir, { recursive: true });
    await mkdir(outputsDir, { recursive: true });
    await writeFile(
      join(dataDir, "profile.json"),
      `${JSON.stringify(profile, null, 2)}\n`,
      "utf8"
    );
    await writeFile(
      join(dataDir, "opportunities.json"),
      `${JSON.stringify([scoredOpportunity], null, 2)}\n`,
      "utf8"
    );

    await runCli(["clean-jd", "opp_clean_test"], tempDir);
    const cleaned = await readOpportunities(tempDir);

    expect(cleaned[0].status).toBe("needs_regeneration");
    expect(cleaned[0].nextAction).toBe("Regenerate application pack");
    expect(cleaned[0].jobDescriptionOriginal).toBe(opportunity.jobDescription);
    expect(cleaned[0].jobDescription).not.toBe(opportunity.jobDescription);
    expect(cleaned[0].jobDescriptionCleaning?.previousScore?.strategicFitScore).toBe(
      scoredOpportunity.score?.strategicFitScore
    );

    await runCli(["score"], tempDir);
    await runCli(["generate", "opp_clean_test"], tempDir);
    const regenerated = await readOpportunities(tempDir);
    const packDir = regenerated[0].generatedPackDir;

    expect(regenerated[0].status).toBe("review_ready");
    expect(regenerated[0].nextAction).toBe("Human review application pack");
    expect(regenerated[0].score).toBeDefined();
    expect(packDir).toBeDefined();

    const fitAnalysis = await readFile(join(packDir as string, "01-fit-analysis.md"), "utf8");
    const report = await readFile(join(packDir as string, "00-review-report.md"), "utf8");

    expect(fitAnalysis).toContain("Human Review Required");
    expect(fitAnalysis).not.toContain("AI Provider Appendix");
    expect(report).toContain("Original Score");
    expect(report).toContain("New Score");
    expect(report).toContain("Final Human-Review Checklist");
  }, 30000);
});

async function readProfile(): Promise<Profile> {
  return JSON.parse(
    await readFile(join(repoRoot, "data", "profile.json"), "utf8")
  ) as Profile;
}

async function readOpportunities(root: string): Promise<Opportunity[]> {
  return JSON.parse(
    await readFile(join(root, "data", "opportunities.json"), "utf8")
  ) as Opportunity[];
}

async function runCli(args: string[], projectRoot: string): Promise<void> {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

  await execFileAsync(pnpm, ["exec", "tsx", "src/cli/index.ts", ...args], {
    cwd: repoRoot,
    env: sanitizeEnv({
      ...process.env,
      JATA_PROJECT_ROOT: projectRoot,
      JATA_AI_PROVIDER: "mock",
      JATA_AI_MODE: "false",
      OPENROUTER_API_KEY: "",
      GEMINI_API_KEY: ""
    }),
    shell: process.platform === "win32"
  });
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(env)) {
    if (
      value === undefined ||
      key.includes("=") ||
      key.includes("\0") ||
      value.includes("\0")
    ) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}
