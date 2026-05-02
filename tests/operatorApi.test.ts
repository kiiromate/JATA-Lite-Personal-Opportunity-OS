import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { handleApiRequest, type ApiResponse } from "../src/server/operatorApi.js";
import { writeJsonFile } from "../src/storage/jsonStore.js";
import type { Opportunity, Profile } from "../src/types/index.js";

let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "jata-operator-api-"));
  await writeJsonFile(join(tempRoot, "data", "profile.json"), profile);
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("operator console API", () => {
  it("returns health and current local settings without exposing secrets", async () => {
    const health = await api("GET", "/api/health");
    const settings = await api("GET", "/api/settings");

    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({
      ok: true,
      mode: "local",
      aiProviderMode: "mock"
    });
    expect(settings.status).toBe(200);
    expect(settings.body).toMatchObject({
      aiProviderMode: "mock",
      costSafety: {
        maxRequestsPerBatch: 5,
        maxOpportunitiesPerRun: 20
      },
      connectors: {
        n8n: { enabled: false },
        googleDrive: { enabled: false },
        googleSheets: { enabled: false },
        externalAI: { enabled: false },
        browserAssistant: { enabled: false }
      }
    });
    expect(JSON.stringify(settings.body)).not.toMatch(/API_KEY|secret|token/i);
  });

  it("lists saved opportunities and summarizes dashboard counts", async () => {
    await seedOpportunities([
      opportunity("opp_a", "A", "review_ready", "2026-05-05"),
      opportunity("opp_b", "B", "follow_up_due", "2026-06-01"),
      opportunity("opp_c", "C", "new", ""),
      opportunity("opp_d", "D", "ignored", "")
    ]);

    const response = await api("GET", "/api/opportunities");

    expect(response.status).toBe(200);
    expect(response.body.opportunities).toHaveLength(4);
    expect(response.body.summary).toMatchObject({
      total: 4,
      priorityBands: { A: 1, B: 1, C: 1, D: 1 },
      urgentDeadlines: 1,
      reviewReadyPacks: 1,
      followUpsDue: 1
    });
    expect(response.body.recommendedActions[0]).toContain("Review");
  });

  it("previews CSV imports without saving and commits only valid rows", async () => {
    const csv = [
      "company,role,description,url,method,deadline",
      "Atlas Ops,Automation Lead,Own automation delivery,https://example.com/a,web,2026-05-30",
      ",Broken Row,Missing company,https://example.com/b,web,2026-05-30"
    ].join("\n");

    const preview = await api("POST", "/api/import/preview", {
      format: "csv",
      content: csv
    });
    const afterPreview = await api("GET", "/api/opportunities");
    const commit = await api("POST", "/api/import/commit", {
      format: "csv",
      content: csv
    });

    expect(preview.status).toBe(200);
    expect(preview.body.summary).toMatchObject({
      imported: 1,
      skipped: 1,
      invalid: 1
    });
    expect(afterPreview.body.opportunities).toHaveLength(0);
    expect(commit.status).toBe(200);
    expect(commit.body.summary).toMatchObject({
      imported: 1,
      skipped: 1,
      invalid: 1
    });
    expect(commit.body.opportunities[0]).toMatchObject({
      company: "Atlas Ops",
      role: "Automation Lead"
    });
  });

  it("scores, shortlists, generates packs, reads packs, and creates application kits", async () => {
    await seedOpportunities([
      {
        ...opportunity("opp_a", undefined, "new", "2026-05-10"),
        jobDescription:
          "Remote implementation lead role for automation, stakeholder coordination, and delivery systems."
      },
      {
        ...opportunity("opp_d", undefined, "new", "2026-05-25"),
        company: "Low Fit Org",
        jobDescription: "Senior clinical ophthalmology role requiring medical credentials."
      }
    ]);

    const bulkScore = await api("POST", "/api/score/bulk", {
      ids: ["opp_a", "opp_d"]
    });
    const shortlist = await api("POST", "/api/shortlist", { top: 5 });
    const batch = await api("POST", "/api/generate-batch", { ids: ["opp_a"] });
    const pack = await api("GET", "/api/packs/opp_a");
    const resume = await api("POST", "/api/resumes", {
      title: "Kaze Automation Resume",
      targetLane: "automation",
      industries: ["technology", "operations"],
      seniority: "mid",
      language: "English",
      filePath: "C:/Users/PC/Resumes/kaze-automation.pdf",
      notes: "Manually registered only."
    });
    const kit = await api("POST", "/api/application-kit/opp_a", {
      resumeVersionId: resume.body.resume.id,
      applicationNotes: "Check salary and availability before applying."
    });

    expect(bulkScore.status).toBe(200);
    expect(bulkScore.body.scored).toBe(2);
    expect(shortlist.status).toBe(200);
    expect(shortlist.body.shortlist[0]).toMatchObject({ id: "opp_a" });
    expect(shortlist.body.notWorthTouchingToday[0]).toMatchObject({
      id: "opp_d"
    });
    expect(batch.status).toBe(200);
    expect(batch.body.generated).toHaveLength(1);
    expect(pack.status).toBe(200);
    expect(pack.body.tabs.map((tab: { key: string }) => tab.key)).toContain(
      "fit-analysis"
    );
    expect(pack.body.tabs.map((tab: { key: string }) => tab.key)).toContain(
      "cover-email"
    );
    expect(kit.status).toBe(200);
    expect(kit.body.files).toEqual(
      expect.arrayContaining([
        expect.stringContaining("application-notes.md"),
        expect.stringContaining("form-answer-cheat-sheet.md"),
        expect.stringContaining("claims-to-verify.md"),
        expect.stringContaining("copy-fields.json")
      ])
    );
    await expect(readFile(join(kit.body.directory, "copy-fields.json"), "utf8"))
      .resolves.toContain("candidateSummary");
  });

  it("updates pipeline status, next action, follow-up date, and pack review notes", async () => {
    await seedOpportunities([opportunity("opp_a", "A", "review_ready", "2026-05-10")]);

    const status = await api("POST", "/api/pipeline/status", {
      id: "opp_a",
      status: "interview"
    });
    const next = await api("POST", "/api/pipeline/next", {
      id: "opp_a",
      nextAction: "Prepare interview notes"
    });
    const followup = await api("POST", "/api/pipeline/followup", {
      id: "opp_a",
      followUpDate: "2026-05-12"
    });
    const notes = await api("POST", "/api/packs/opp_a/review-notes", {
      notes: "Keep automation claim. Verify salary.",
      claimReviews: [
        {
          claim: "Automation delivery",
          decision: "keep"
        }
      ]
    });

    expect(status.body.opportunity).toMatchObject({ status: "interview" });
    expect(next.body.opportunity).toMatchObject({
      nextAction: "Prepare interview notes"
    });
    expect(followup.body.opportunity).toMatchObject({
      status: "follow_up_due",
      followUpDate: "2026-05-12"
    });
    expect(notes.status).toBe(200);
    expect(notes.body.reviewNotes.claimReviews[0]).toMatchObject({
      decision: "keep"
    });
  });

  it("ingests n8n opportunity payloads with validation and deduplication", async () => {
    const payload = {
      company: "N8N Source",
      role: "Workflow Automation Consultant",
      description: "Automation role sourced from a future n8n workflow.",
      url: "https://example.com/n8n",
      method: "web"
    };

    const first = await api("POST", "/api/ingest/opportunity", payload);
    const duplicate = await api("POST", "/api/ingest/opportunity", payload);
    const broken = await api("POST", "/api/ingest/opportunity", {
      company: "",
      role: "Broken",
      description: ""
    });

    expect(first.status).toBe(200);
    expect(first.body.summary).toMatchObject({ imported: 1, skipped: 0 });
    expect(duplicate.body.summary).toMatchObject({
      imported: 0,
      skipped: 1,
      duplicates: 1
    });
    expect(broken.status).toBe(400);
    expect(broken.body.summary).toMatchObject({ invalid: 1 });
  });

  it("exports tracker CSV and daily brief through the API", async () => {
    await seedOpportunities([opportunity("opp_a", "A", "review_ready", "2026-05-10")]);

    const brief = await api("GET", "/api/daily-brief");
    const exportResult = await api("POST", "/api/export");

    expect(brief.status).toBe(200);
    expect(brief.body.markdown).toContain("Daily Opportunity Brief");
    expect(exportResult.status).toBe(200);
    expect(exportResult.body.csv).toContain("priorityBand");
    expect(exportResult.body.filePath).toContain("opportunity-tracker.csv");
  });
});

type LooseApiBody = Record<string, any>;

async function api<T extends LooseApiBody = LooseApiBody>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  return handleApiRequest({
    method,
    path,
    body,
    root: tempRoot,
    now: "2026-05-02T10:00:00.000Z"
  }) as Promise<ApiResponse<T>>;
}

async function seedOpportunities(opportunities: Opportunity[]): Promise<void> {
  await writeJsonFile(join(tempRoot, "data", "opportunities.json"), opportunities);
}

const profile: Profile = {
  name: "Kaze",
  positioning:
    "Automation consultant and implementation operator focused on practical systems.",
  strengths: [
    "automation",
    "project execution",
    "stakeholder coordination",
    "operations systems"
  ],
  targetLanes: ["automation", "implementation", "operations"],
  constraints: ["no fabricated claims", "manual application approval required"],
  languages: ["English", "French"]
};

function opportunity(
  id: string,
  priorityBand: Opportunity["priorityBand"],
  status: Opportunity["status"],
  deadline: string
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
      "Implementation role for automation, systems delivery, stakeholder coordination, and operating discipline.",
    deadline,
    contact: "",
    method: "web",
    notes: "",
    status,
    priorityBand,
    applicationRiskLevel: priorityBand === "D" ? "high" : "low",
    effortEstimate: priorityBand === "D" ? "high" : "medium",
    recommendedAction:
      priorityBand === "D" ? "Ignore unless fit changes" : "Review application pack",
    nextAction:
      status === "follow_up_due"
        ? "Follow up manually"
        : "Review application pack",
    score: priorityBand
      ? {
          strategicFitScore: priorityBand === "D" ? 42 : 82,
          sectorFit: 7,
          roleFit: 8,
          compensationPotential: 6,
          remoteGlobalFit: 7,
          networkValue: 5,
          effortLevel: priorityBand === "D" ? "high" : "medium",
          decision: priorityBand === "D" ? "Ignore" : "Pursue",
          rationale: "Test scoring rationale."
        }
      : undefined
  };
}
