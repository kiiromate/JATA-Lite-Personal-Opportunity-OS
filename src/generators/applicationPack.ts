import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatLocalDate } from "../core/date.js";
import { redactBeforeAI } from "../security/piiRedactor.js";
import type {
  ApplicationPackResult,
  Opportunity,
  Profile
} from "../types/index.js";
import type { AIProvider } from "./aiProvider.js";
import { MockProvider } from "./aiProvider.js";

interface GenerateApplicationPackOptions {
  opportunity: Opportunity;
  profile: Profile;
  outputRoot: string;
  date?: string;
  aiProvider?: AIProvider;
  useAI?: boolean;
}

interface EvidenceSummary {
  matched: string[];
  missing: string[];
}

const expectedRequirementKeywords = [
  "implementation",
  "customer success",
  "automation",
  "project coordination",
  "business development",
  "fintech",
  "climate",
  "agri",
  "sustainable",
  "enterprise onboarding",
  "sql",
  "crm",
  "sales",
  "english",
  "french"
];

export async function generateApplicationPack(
  options: GenerateApplicationPackOptions
): Promise<ApplicationPackResult> {
  const date = options.date ?? formatLocalDate();
  const directory = join(
    options.outputRoot,
    `${date}-${slugify(options.opportunity.company)}-${slugify(
      options.opportunity.role
    )}`
  );
  const aiProvider = options.aiProvider ?? new MockProvider();
  const useAI = options.useAI ?? false;
  const evidence = summarizeEvidence(options.opportunity, options.profile);
  const aiAppendix = useAI
    ? await createAIAppendix(options.opportunity, options.profile, aiProvider)
    : "";

  const files = new Map<string, string>([
    [
      "01-fit-analysis.md",
      fitAnalysis(options.opportunity, options.profile, evidence, useAI, aiAppendix)
    ],
    [
      "02-resume-tailoring-notes.md",
      resumeTailoringNotes(
        options.opportunity,
        options.profile,
        evidence,
        useAI,
        aiAppendix
      )
    ],
    [
      "03-cover-email-draft.md",
      coverEmailDraft(options.opportunity, options.profile, evidence, useAI, aiAppendix)
    ],
    [
      "04-referral-message.md",
      referralMessage(options.opportunity, options.profile, evidence, useAI, aiAppendix)
    ],
    [
      "05-application-checklist.md",
      applicationChecklist(
        options.opportunity,
        options.profile,
        evidence,
        useAI,
        aiAppendix
      )
    ]
  ]);

  await mkdir(directory, { recursive: true });

  for (const [fileName, content] of files) {
    await writeFile(join(directory, fileName), content, "utf8");
  }

  return {
    directory,
    files: [...files.keys()].map((fileName) => join(directory, fileName))
  };
}

function summarizeEvidence(
  opportunity: Opportunity,
  profile: Profile
): EvidenceSummary {
  const jobText = opportunity.jobDescription.toLowerCase();
  const profileText = [
    profile.positioning,
    ...profile.strengths,
    ...profile.targetLanes,
    ...profile.constraints,
    ...profile.languages
  ]
    .join(" ")
    .toLowerCase();
  const requirements = expectedRequirementKeywords.filter((keyword) =>
    jobText.includes(keyword)
  );

  const matched = requirements.filter((keyword) => profileText.includes(keyword));
  const missing = requirements.filter((keyword) => !profileText.includes(keyword));

  return {
    matched: uniqueReadable(matched),
    missing: uniqueReadable(missing)
  };
}

function fitAnalysis(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceSummary,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Fit Analysis: ${opportunity.company} - ${opportunity.role}

## Opportunity Snapshot
- Company: ${opportunity.company}
- Role: ${opportunity.role}
- Source: ${opportunity.source}
- Method: ${opportunity.method}
- Deadline: ${opportunity.deadline || "Not provided"}
- URL: ${opportunity.url}

## Profile Positioning
${profile.positioning}

## Evidence-Based Fit
- Matched evidence: ${listOrFallback(evidence.matched, "No direct evidence found in profile.")}
- Missing evidence: ${listOrFallback(evidence.missing, "No obvious missing evidence detected from keyword scan.")}

## Missing Evidence
${bulletList(evidence.missing, "No obvious missing evidence detected from keyword scan.")}

## Notes
This analysis uses only the profile file and the supplied job description. It does not infer credentials, years of experience, employers, degrees, certifications, or results that are not present in the data.`,
    evidence,
    useAI,
    aiAppendix
  );
}

function resumeTailoringNotes(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceSummary,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Resume Tailoring Notes: ${opportunity.company} - ${opportunity.role}

## Safe Emphasis Areas
${bulletList(
  [
    profile.positioning,
    ...profile.strengths.filter((strength) =>
      opportunity.jobDescription.toLowerCase().includes(strength.toLowerCase())
    ),
    ...evidence.matched
  ],
  "No direct profile match found. Add only verified experience before tailoring."
)}

## Do Not Claim Without Evidence
${bulletList(
  evidence.missing,
  "No missing keyword evidence detected. Still verify all claims before sending."
)}

## Suggested Resume Review
- Align summary language with the role only where the profile already supports it.
- Add measurable outcomes only if Kaze can verify them from real work.
- Keep all credentials, employers, dates, and tools factual.`,
    evidence,
    useAI,
    aiAppendix
  );
}

function coverEmailDraft(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceSummary,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Cover Email Draft: ${opportunity.company} - ${opportunity.role}

Subject: ${opportunity.role} application - Kaze

Hello${opportunity.contact ? ` ${opportunity.contact}` : ""},

I am interested in the ${opportunity.role} opportunity at ${opportunity.company}. My positioning is as a ${profile.positioning.charAt(0).toLowerCase()}${profile.positioning.slice(1)}

The strongest evidence available in my profile for this role is:
${bulletList(evidence.matched, "No direct matched evidence found. Add verified examples before sending.")}

Before sending, I would tailor this message with specific verified examples that address the role description.

Regards,
Kaze`,
    evidence,
    useAI,
    aiAppendix
  );
}

function referralMessage(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceSummary,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Referral Message: ${opportunity.company} - ${opportunity.role}

Hi${opportunity.contact ? ` ${opportunity.contact}` : ""},

I am exploring the ${opportunity.role} role at ${opportunity.company}. Based on the job description, the relevant verified areas from my profile are:
${bulletList(evidence.matched, "No direct matched evidence found. Add verified context before asking for a referral.")}

Would you be open to sharing context on the team, priorities, and whether my background appears relevant?

Thanks,
Kaze`,
    evidence,
    useAI,
    aiAppendix
  );
}

function applicationChecklist(
  opportunity: Opportunity,
  _profile: Profile,
  evidence: EvidenceSummary,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Application Checklist: ${opportunity.company} - ${opportunity.role}

## Before Applying
- [ ] Confirm the role, company, URL, and deadline.
- [ ] Verify every claim in the resume and message.
- [ ] Fill evidence gaps or remove unsupported claims.
- [ ] Confirm the correct application method: ${opportunity.method}.
- [ ] Save final reviewed artifacts outside the generated draft folder if needed.

## Evidence Gaps to Resolve
${bulletList(evidence.missing, "No missing keyword evidence detected. Review manually anyway.")}

## Human Approval Gate
- [ ] Kaze has reviewed the application pack.
- [ ] Kaze has approved the resume version.
- [ ] Kaze has approved the cover/referral message.
- [ ] No automatic submission has occurred.`,
    evidence,
    useAI,
    aiAppendix
  );
}

function withReviewSections(
  body: string,
  evidence: EvidenceSummary,
  useAI: boolean,
  aiAppendix: string
): string {
  const aiWarning = useAI
    ? "\n## AI Mode Warning\nAn AI provider was used to assist this draft. Text sent to the provider was passed through the PII redactor first. Review all output before use.\n"
    : "";

  const appendix = aiAppendix ? `\n## AI Provider Appendix\n${aiAppendix}\n` : "";

  return `${body}
${aiWarning}
## Human Review Required
This is a draft for review only. Do not send, upload, or submit anything until Kaze manually approves the final artifact.

## Claims to verify before sending
${bulletList(
  evidence.missing,
  "No missing keyword evidence detected by the local scanner. Still verify all claims manually."
)}
${appendix}`;
}

async function createAIAppendix(
  opportunity: Opportunity,
  profile: Profile,
  provider: AIProvider
): Promise<string> {
  const aiSafeOpportunityContext = {
    company: opportunity.company,
    role: opportunity.role,
    jobDescription: opportunity.jobDescription
  };
  const prompt = redactBeforeAI(
    [
      "Create review-only opportunity preparation notes.",
      `Profile: ${JSON.stringify(profile)}`,
      `Opportunity: ${JSON.stringify(aiSafeOpportunityContext)}`
    ].join("\n")
  );

  return provider.generate(prompt);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueReadable(values: string[]): string[] {
  return [...new Set(values.map((value) => toReadableKeyword(value)))];
}

function toReadableKeyword(value: string): string {
  if (value === "sql") {
    return "SQL";
  }

  if (value === "crm") {
    return "CRM";
  }

  return value;
}

function listOrFallback(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function bulletList(values: string[], fallback: string): string {
  if (values.length === 0) {
    return `- ${fallback}`;
  }

  return values.map((value) => `- ${value}`).join("\n");
}
