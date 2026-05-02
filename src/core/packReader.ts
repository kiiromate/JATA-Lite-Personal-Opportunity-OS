import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { claimReviewDecisions } from "../types/index.js";
import { readJsonFile, writeJsonFile } from "../storage/jsonStore.js";
import { getProjectPaths } from "../storage/paths.js";
import type { ClaimReview, Opportunity, PackReviewNotes } from "../types/index.js";

export interface PackTab {
  key: string;
  label: string;
  fileName: string;
  content: string;
}

export interface PackView {
  opportunity: Opportunity;
  directory: string;
  tabs: PackTab[];
  reviewNotes?: PackReviewNotes;
}

const packFiles = [
  ["review-report", "Review Report", "00-review-report.md"],
  ["fit-analysis", "Fit Analysis", "01-fit-analysis.md"],
  ["resume-notes", "Resume Notes", "02-resume-tailoring-notes.md"],
  ["cover-email", "Cover Email", "03-cover-email-draft.md"],
  ["referral-message", "Referral Message", "04-referral-message.md"],
  ["checklist", "Checklist", "05-application-checklist.md"]
] as const;

export async function loadPackView(
  root: string | undefined,
  opportunity: Opportunity
): Promise<PackView> {
  const directory = opportunity.packPath ?? opportunity.generatedPackDir;

  if (!directory) {
    throw new Error(`No generated pack directory is recorded for ${opportunity.id}.`);
  }

  const tabs: PackTab[] = [];

  for (const [key, label, fileName] of packFiles) {
    try {
      const content = await readFile(join(directory, fileName), "utf8");
      tabs.push({ key, label, fileName, content });
    } catch (error) {
      if (!isMissingFile(error)) {
        throw error;
      }
    }
  }

  return {
    opportunity,
    directory,
    tabs,
    reviewNotes: await getPackReviewNotes(root, opportunity.id)
  };
}

export async function savePackReviewNotes(
  root: string | undefined,
  opportunityId: string,
  input: {
    notes?: string;
    claimReviews?: ClaimReview[];
  },
  now = new Date().toISOString()
): Promise<PackReviewNotes> {
  const allNotes = await readAllPackReviewNotes(root);
  const reviewNotes: PackReviewNotes = {
    opportunityId,
    updatedAt: now,
    notes: clean(input.notes ?? ""),
    claimReviews: normalizeClaimReviews(input.claimReviews ?? [])
  };

  allNotes[opportunityId] = reviewNotes;
  await writeJsonFile(getProjectPaths(root).packReviewNotesFile, allNotes);

  return reviewNotes;
}

export async function getPackReviewNotes(
  root: string | undefined,
  opportunityId: string
): Promise<PackReviewNotes | undefined> {
  const allNotes = await readAllPackReviewNotes(root);

  return allNotes[opportunityId];
}

export function packTabLabel(filePath: string): string {
  const name = basename(filePath);
  const found = packFiles.find(([, , fileName]) => fileName === name);

  return found?.[1] ?? name;
}

async function readAllPackReviewNotes(
  root?: string
): Promise<Record<string, PackReviewNotes>> {
  return readJsonFile<Record<string, PackReviewNotes>>(
    getProjectPaths(root).packReviewNotesFile,
    {}
  );
}

function normalizeClaimReviews(claimReviews: ClaimReview[]): ClaimReview[] {
  return claimReviews.map((item) => {
    const claim = clean(item.claim);
    const decision = item.decision;

    if (!claim) {
      throw new Error("Claim review text is required.");
    }

    if (!claimReviewDecisions.includes(decision)) {
      throw new Error(
        `Claim review decision must be one of: ${claimReviewDecisions.join(", ")}`
      );
    }

    return {
      claim,
      decision,
      ...(item.note ? { note: clean(item.note) } : {})
    };
  });
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
