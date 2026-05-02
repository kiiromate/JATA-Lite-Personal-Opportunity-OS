import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  importBulkOpportunityFile,
  importBulkOpportunities,
  parseBulkOpportunityContent
} from "../src/core/bulkImport.js";
import { createOpportunity } from "../src/core/opportunity.js";
import type { Opportunity } from "../src/types/index.js";

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("bulk opportunity import", () => {
  it("validates CSV required fields and reports invalid rows without saving them", async () => {
    const fixture = await readFile("fixtures/bulk-opportunities.csv", "utf8");
    const rows = parseBulkOpportunityContent(fixture, "csv");

    const result = importBulkOpportunities(rows, [], {
      now: "2026-05-02T00:00:00.000Z",
      idFactory: (rowNumber) => `opp_csv_${rowNumber}`
    });

    expect(result.summary).toMatchObject({
      imported: 7,
      skipped: 1,
      duplicates: 0,
      invalid: 1
    });
    expect(result.errors[0]).toMatchObject({
      rowNumber: 9,
      reason: "company is required"
    });
    expect(result.opportunities).toHaveLength(7);
    expect(result.opportunities[0]).toMatchObject({
      id: "opp_csv_2",
      company: "BlueOrbit Systems",
      role: "Remote Implementation Lead",
      status: "new",
      source: "Manual Test",
      location: "Remote",
      remote: "true"
    });
  });

  it("validates JSON required fields and supports rows with only company, role, and description", () => {
    const rows = parseBulkOpportunityContent(
      JSON.stringify([
        {
          company: "JsonWorks Studio",
          role: "Automation Consultant",
          description:
            "Automation consulting role for operations and implementation systems."
        },
        {
          company: "Broken Row",
          description: "Missing role should be invalid."
        }
      ]),
      "json"
    );

    const result = importBulkOpportunities(rows, [], {
      now: "2026-05-02T00:00:00.000Z",
      idFactory: (rowNumber) => `opp_json_${rowNumber}`
    });

    expect(result.summary).toMatchObject({
      imported: 1,
      skipped: 1,
      duplicates: 0,
      invalid: 1
    });
    expect(result.opportunities[0]).toMatchObject({
      id: "opp_json_1",
      company: "JsonWorks Studio",
      source: "Bulk Import",
      method: "web"
    });
  });

  it("skips duplicate opportunities by URL or normalized description unless update is passed", () => {
    const existing = [
      createOpportunity(
        {
          company: "BlueOrbit Systems",
          role: "Remote Implementation Lead",
          url: "https://example.com/blueorbit-implementation",
          source: "Manual",
          jobDescription: "Original description",
          method: "web"
        },
        {
          id: "opp_existing_url",
          now: "2026-05-01T00:00:00.000Z"
        }
      ),
      createOpportunity(
        {
          company: "NoUrl Works",
          role: "Operations Lead",
          source: "Manual",
          jobDescription: "Remote operations automation role.",
          method: "web"
        },
        {
          id: "opp_existing_description",
          now: "2026-05-01T00:00:00.000Z"
        }
      )
    ];
    const rows = [
      {
        company: "BlueOrbit Systems",
        role: "Remote Implementation Lead",
        description: "Updated description",
        url: "https://example.com/blueorbit-implementation"
      },
      {
        company: "NoUrl Works",
        role: "Operations Lead",
        description: " Remote   operations automation role. "
      }
    ];

    const skipped = importBulkOpportunities(rows, existing, {
      now: "2026-05-02T00:00:00.000Z"
    });
    const updated = importBulkOpportunities(rows, existing, {
      now: "2026-05-02T00:00:00.000Z",
      update: true
    });

    expect(skipped.summary).toMatchObject({
      imported: 0,
      skipped: 2,
      duplicates: 2,
      invalid: 0
    });
    expect(skipped.opportunities).toHaveLength(2);
    expect(updated.summary).toMatchObject({
      imported: 0,
      updated: 2,
      skipped: 0,
      duplicates: 0,
      invalid: 0
    });
    expect(updated.opportunities[0]).toMatchObject({
      id: "opp_existing_url",
      jobDescription: "Updated description",
      status: "new",
      nextAction: "Score opportunity"
    });
  });

  it("loads CSV and JSON files from disk", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "jata-bulk-import-"));
    const jsonPath = join(tempDir, "opportunities.json");
    await writeFile(
      jsonPath,
      JSON.stringify([
        {
          company: "Disk Import Labs",
          role: "Implementation Consultant",
          description: "Implementation and automation consulting role."
        }
      ]),
      "utf8"
    );

    const result = await importBulkOpportunityFile(jsonPath, [], {
      now: "2026-05-02T00:00:00.000Z",
      idFactory: (rowNumber) => `opp_disk_${rowNumber}`
    });

    expect(result.summary.imported).toBe(1);
    expect(result.opportunities[0].id).toBe("opp_disk_1");
  });
});
