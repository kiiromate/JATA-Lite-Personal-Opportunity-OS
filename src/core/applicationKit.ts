import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeEvidence } from "./evidenceAnalyzer.js";
import { formatLocalDate } from "./date.js";
import { getProjectPaths } from "../storage/paths.js";
import type {
  ApplicationKitResult,
  Opportunity,
  Profile,
  ResumeVersion
} from "../types/index.js";

export interface CreateApplicationKitOptions {
  root?: string;
  opportunity: Opportunity;
  profile: Profile;
  resume?: ResumeVersion;
  applicationNotes?: string;
  date?: string;
}

export async function createApplicationKit(
  options: CreateApplicationKitOptions
): Promise<ApplicationKitResult> {
  const paths = getProjectPaths(options.root);
  const date = options.date ?? formatLocalDate();
  const directory = join(
    paths.applicationKitsDir,
    `${date}-${slugify(options.opportunity.company)}-${slugify(options.opportunity.role)}`
  );
  const copyFields = buildCopyFields(options.opportunity, options.profile);
  const coverDraft = await readPackFile(
    options.opportunity,
    "03-cover-email-draft.md",
    fallbackCoverDraft(options.opportunity, options.profile)
  );
  const claims = await readPackFile(
    options.opportunity,
    "05-application-checklist.md",
    fallbackClaims(options.opportunity, options.profile)
  );
  const files = new Map<string, string>([
    [
      "selected-resume.md",
      selectedResumeMarkdown(options.resume)
    ],
    [
      "cover-letter-draft.md",
      coverDraft
    ],
    [
      "application-notes.md",
      applicationNotesMarkdown(options.opportunity, options.applicationNotes)
    ],
    [
      "form-answer-cheat-sheet.md",
      formAnswerMarkdown(options.opportunity, copyFields)
    ],
    [
      "claims-to-verify.md",
      claims
    ],
    [
      "copy-fields.json",
      `${JSON.stringify(copyFields, null, 2)}\n`
    ]
  ]);

  await mkdir(directory, { recursive: true });

  for (const [fileName, content] of files) {
    await writeFile(join(directory, fileName), content, "utf8");
  }

  return {
    directory,
    files: [...files.keys()].map((fileName) => join(directory, fileName)),
    copyFields
  };
}

export function buildCopyFields(
  opportunity: Opportunity,
  profile: Profile
): Record<string, string> {
  const summary = [
    profile.positioning,
    profile.strengths.slice(0, 3).join(", ")
  ]
    .filter(Boolean)
    .join(" Strengths: ");
  const relevantExperience = profile.strengths.length > 0
    ? `Relevant verified strengths to draw from: ${profile.strengths.join(", ")}.`
    : "Add only verified experience from Kaze's real work history before submitting.";

  return {
    role: opportunity.role,
    company: opportunity.company,
    candidateSummary: summary,
    motivationParagraph: `I am interested in ${opportunity.company}'s ${opportunity.role} role because it appears to value practical delivery, structured execution, and useful operating systems.`,
    relevantExperienceParagraph: relevantExperience,
    salaryExpectation: "To be confirmed by Kaze before submission.",
    availability: "To be confirmed by Kaze before submission.",
    referralContactNotes:
      opportunity.contact && !["n/a", "na", "unknown"].includes(opportunity.contact.toLowerCase())
        ? opportunity.contact
        : "No verified referral or contact recorded."
  };
}

async function readPackFile(
  opportunity: Opportunity,
  fileName: string,
  fallback: string
): Promise<string> {
  const directory = opportunity.packPath ?? opportunity.generatedPackDir;

  if (!directory) {
    return fallback;
  }

  try {
    return await readFile(join(directory, fileName), "utf8");
  } catch {
    return fallback;
  }
}

function fallbackCoverDraft(opportunity: Opportunity, profile: Profile): string {
  return `# Cover Letter Draft: ${opportunity.company} - ${opportunity.role}

Dear Hiring Team,

I am interested in the ${opportunity.role} role at ${opportunity.company}. ${profile.positioning}

Before sending, Kaze must edit this draft, add verified examples, and remove any unsupported claims.
`;
}

function fallbackClaims(opportunity: Opportunity, profile: Profile): string {
  const evidence = analyzeEvidence({ opportunity, profile, score: opportunity.score });

  return `# Claims To Verify

## Evidence Needed Before Sending
${evidence.missingEvidence.map((item) => `- [ ] ${item}`).join("\n") || "- [ ] Review claims manually."}

## Claims To Remove Unless Verified
${evidence.riskyClaims.map((item) => `- [ ] ${item}`).join("\n") || "- [ ] Remove unsupported credentials, employers, years, or outcomes."}
`;
}

function selectedResumeMarkdown(resume: ResumeVersion | undefined): string {
  if (!resume) {
    return `# Selected Resume

No resume version selected yet.

Add a resume version in the local resume library before final submission.
`;
  }

  return `# Selected Resume

- Title: ${resume.title}
- Target lane: ${resume.targetLane || "Not specified"}
- Seniority: ${resume.seniority || "Not specified"}
- Language: ${resume.language}
- File path: ${resume.filePath}
- Notes: ${resume.notes || "None"}

JATA Lite stores only this local path reference. It does not parse or upload the resume in v0.4.
`;
}

function applicationNotesMarkdown(
  opportunity: Opportunity,
  applicationNotes: string | undefined
): string {
  return `# Application Notes: ${opportunity.company} - ${opportunity.role}

${applicationNotes?.trim() || "No manual application notes recorded yet."}

## Approval Gate
- [ ] Kaze reviewed the pack.
- [ ] Kaze selected the correct resume.
- [ ] Kaze verified every claim.
- [ ] Kaze manually submits outside JATA Lite.
`;
}

function formAnswerMarkdown(
  opportunity: Opportunity,
  fields: Record<string, string>
): string {
  return `# Form Answer Cheat Sheet: ${opportunity.company} - ${opportunity.role}

## Copy-Ready Fields
- Role: ${fields.role}
- Company: ${fields.company}
- Candidate summary: ${fields.candidateSummary}
- Motivation: ${fields.motivationParagraph}
- Relevant experience: ${fields.relevantExperienceParagraph}
- Salary expectation: ${fields.salaryExpectation}
- Availability: ${fields.availability}
- Referral/contact notes: ${fields.referralContactNotes}

These fields are drafts for manual copy/paste. JATA Lite does not submit application forms.
`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
