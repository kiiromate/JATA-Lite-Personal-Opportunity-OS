import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateApplicationPack } from "../src/generators/applicationPack.js";
import { type AIProvider, MockProvider } from "../src/generators/aiProvider.js";
import type { Opportunity, Profile } from "../src/types/index.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("generateApplicationPack", () => {
  it("creates reviewable markdown artifacts without inventing claims", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-pack-"));
    const profile: Profile = {
      name: "Kaze",
      positioning:
        "Multidisciplinary builder and strategic consultant connecting technology, business, operations, and sustainability.",
      strengths: ["automation", "customer success"],
      targetLanes: ["implementation specialist", "automation consulting"],
      constraints: ["no fabricated work history"],
      languages: ["English", "French"]
    };
    const opportunity: Opportunity = {
      id: "opp_1",
      createdAt: "2026-04-30T00:00:00.000Z",
      lastUpdated: "2026-04-30T00:00:00.000Z",
      company: "Acme Labs",
      role: "Implementation Specialist",
      url: "https://example.com/job",
      source: "Referral",
      jobDescription:
        "We need implementation support, customer success, automation, enterprise onboarding, and SQL evidence.",
      deadline: "2026-05-15",
      contact: "Jane",
      method: "referral",
      notes: "",
      status: "scored"
    };

    const result = await generateApplicationPack({
      opportunity,
      profile,
      outputRoot: tempDir,
      date: "2026-04-30",
      aiProvider: new MockProvider()
    });

    expect(result.files).toHaveLength(5);
    const fitAnalysis = await readFile(
      join(result.directory, "01-fit-analysis.md"),
      "utf8"
    );
    const coverEmail = await readFile(
      join(result.directory, "03-cover-email-draft.md"),
      "utf8"
    );

    expect(fitAnalysis).toContain("Human Review Required");
    expect(fitAnalysis).toContain("Claims to Verify Before Sending");
    expect(fitAnalysis).toContain("Evidence Needed Before Sending");
    expect(fitAnalysis).toContain("Missing Evidence");
    expect(fitAnalysis).toContain("SQL");
    expect(coverEmail).toContain("Acme Labs");
    expect(coverEmail).not.toContain("10 years");
  });

  it("redacts PII and limits AI prompt context to profile plus job description", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-pack-"));
    const prompts: string[] = [];
    const provider: AIProvider = {
      name: "test-provider",
      async generate(prompt: string): Promise<string> {
        prompts.push(prompt);
        return "AI draft notes";
      }
    };
    const profile: Profile = {
      name: "Kaze",
      positioning: "Automation consultant.",
      strengths: ["automation"],
      targetLanes: ["implementation specialist"],
      constraints: ["no fabricated work history"],
      languages: ["English"]
    };
    const opportunity: Opportunity = {
      id: "opp_2",
      createdAt: "2026-04-30T00:00:00.000Z",
      lastUpdated: "2026-04-30T00:00:00.000Z",
      company: "PrivateCo",
      role: "Implementation Specialist",
      url: "https://private.example.com/job",
      source: "Private referral",
      jobDescription:
        "Contact recruiter@example.com or +250 788 123 456. National ID 1199887766554433 should never be sent.",
      deadline: "2026-05-15",
      contact: "Sensitive Contact",
      method: "referral",
      notes: "Private notes must stay local.",
      status: "scored"
    };

    await generateApplicationPack({
      opportunity,
      profile,
      outputRoot: tempDir,
      date: "2026-04-30",
      aiProvider: provider,
      useAI: true
    });

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("[REDACTED_EMAIL]");
    expect(prompts[0]).toContain("[REDACTED_PHONE]");
    expect(prompts[0]).toContain("[REDACTED_LONG_NUMBER]");
    expect(prompts[0]).not.toContain("Private notes must stay local");
    expect(prompts[0]).not.toContain("Sensitive Contact");
    expect(prompts[0]).not.toContain("https://private.example.com/job");
  });
});
