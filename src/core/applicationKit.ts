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
  const baseCopyFields = buildCopyFields(options.opportunity, options.profile);
  const coverDraft = await readPackFile(
    options.opportunity,
    "03-cover-email-draft.md",
    fallbackCoverDraft(options.opportunity, options.profile)
  );
  const referralMessage = await readPackFile(
    options.opportunity,
    "04-referral-message.md",
    fallbackReferralMessage(options.opportunity, options.profile)
  );
  const claims = await readPackFile(
    options.opportunity,
    "05-application-checklist.md",
    fallbackClaims(options.opportunity, options.profile)
  );
  const formAnswerCheatSheet = formAnswerMarkdown(
    options.opportunity,
    baseCopyFields
  );
  const finalChecklist = finalChecklistItems();
  const copyFields = {
    ...baseCopyFields,
    coverEmail: coverDraft.trim(),
    referralMessage: referralMessage.trim(),
    formAnswerCheatSheet: formAnswerCheatSheet.trim()
  };
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
      formAnswerCheatSheet
    ],
    [
      "claims-to-verify.md",
      claims
    ],
    [
      "final-application-checklist.md",
      finalChecklistMarkdown(finalChecklist)
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
    copyFields,
    ...(options.resume ? { selectedResume: options.resume } : {}),
    claimsToVerify: extractClaimsToVerify(claims),
    finalChecklist
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

function fallbackReferralMessage(opportunity: Opportunity, profile: Profile): string {
  return `# Referral Message: ${opportunity.company} - ${opportunity.role}

Hi,

I am exploring the ${opportunity.role} role at ${opportunity.company}. ${profile.positioning}

Before sending, Kaze must tailor this note to the real relationship and remove any unsupported claims.
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

function finalChecklistItems(): string[] {
  return [
    "resume selected",
    "cover letter reviewed",
    "claims verified",
    "application URL opened",
    "status updated after submission"
  ];
}

function finalChecklistMarkdown(items: string[]): string {
  return `# Final Application Checklist

${items.map((item) => `- [ ] ${item}`).join("\n")}

JATA Lite prepares local material only. Kaze must submit manually outside the app.
`;
}

function extractClaimsToVerify(markdown: string): string[] {
  const claims = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => line.match(/^- \[[ x]\]\s+(.+)$/i)?.[1] ?? "")
    .map((line) => line.trim())
    .filter(Boolean);

  return claims.length > 0
    ? claims
    : ["Review generated pack claims manually before submitting."];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
