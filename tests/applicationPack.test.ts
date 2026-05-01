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

  it("uses one conservative evidence analysis across review, fit, cover, and checklist", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-pack-"));
    let externalProviderCalled = false;
    const throwingProvider: AIProvider = {
      name: "throwing-provider",
      async generate(): Promise<string> {
        externalProviderCalled = true;
        throw new Error("External provider must not be called");
      }
    };
    const profile: Profile = {
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
    const opportunity: Opportunity = {
      id: "opp_health_workforce",
      createdAt: "2026-05-01T00:00:00.000Z",
      lastUpdated: "2026-05-01T00:00:00.000Z",
      company: "Health Access Foundation",
      role: "Project Manager-Workforce",
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
      status: "scored",
      score: {
        strategicFitScore: 81,
        sectorFit: 8,
        roleFit: 9,
        compensationPotential: 6,
        remoteGlobalFit: 8,
        networkValue: 4,
        effortLevel: "medium",
        decision: "Pursue",
        rationale: "Pursue: strong target lane and role fit."
      },
      jobDescriptionOriginal: "Original raw pasted job description.",
      jobDescriptionCleaning: {
        cleanedAt: "2026-05-01T00:00:00.000Z",
        originalLength: 1200,
        cleanedLength: 900,
        summary: ["Removed duplicated pasted blocks."],
        previousScore: {
          strategicFitScore: 81,
          sectorFit: 8,
          roleFit: 9,
          compensationPotential: 6,
          remoteGlobalFit: 8,
          networkValue: 4,
          effortLevel: "medium",
          decision: "Pursue",
          rationale: "Pursue: strong target lane and role fit."
        }
      }
    };

    const result = await generateApplicationPack({
      opportunity,
      profile,
      outputRoot: tempDir,
      date: "2026-05-01",
      aiProvider: throwingProvider,
      useAI: false
    });

    const reviewReport = await readFile(
      join(result.directory, "00-review-report.md"),
      "utf8"
    );
    const fitAnalysis = await readFile(
      join(result.directory, "01-fit-analysis.md"),
      "utf8"
    );
    const coverEmail = await readFile(
      join(result.directory, "03-cover-email-draft.md"),
      "utf8"
    );
    const checklist = await readFile(
      join(result.directory, "05-application-checklist.md"),
      "utf8"
    );
    const missingHealthEvidence =
      "Direct public health or eye health programme delivery evidence";
    const riskySafeguardingClaim =
      "Safeguarding or child-safe implementation responsibility";

    expect(result.files.some((file) => file.endsWith("00-review-report.md"))).toBe(
      true
    );
    expect(reviewReport).toContain("Application Risk Level: high");
    expect(reviewReport).toContain(
      "generated from the same EvidenceAnalysis object"
    );
    expect(reviewReport).toContain(missingHealthEvidence);
    expect(fitAnalysis).toContain("Executive Fit Verdict");
    expect(fitAnalysis).toContain("Missing or Weak Evidence");
    expect(fitAnalysis).toContain("Claims Not To Make Yet");
    expect(fitAnalysis).toContain(missingHealthEvidence);
    expect(fitAnalysis).toContain(riskySafeguardingClaim);
    expect(checklist).toContain("Evidence To Add If True");
    expect(checklist).toContain("Claims To Remove Unless Verified");
    expect(checklist).toContain(missingHealthEvidence);
    expect(checklist).toContain(riskySafeguardingClaim);
    expect(coverEmail).toContain("Subject: Application for Project Manager-Workforce - Kaze");
    expect(coverEmail).toContain("Dear Hiring Team,");
    expect(coverEmail).not.toContain("Hello N/A");
    expect(coverEmail).not.toMatch(
      /I (have|bring|offer) direct (public health|eye health|donor-funded|safeguarding|workforce development)/i
    );
    expect(coverEmail).toContain("Add one verified project example.");
    expect(externalProviderCalled).toBe(false);
  });
});
