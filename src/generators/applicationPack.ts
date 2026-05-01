import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { analyzeEvidence, type EvidenceAnalysis } from "../core/evidenceAnalyzer.js";
import { formatLocalDate } from "../core/date.js";
import { redactBeforeAI } from "../security/piiRedactor.js";
import type {
  ApplicationPackResult,
  Opportunity,
  Profile
} from "../types/index.js";
import type { AIProvider } from "./aiProvider.js";
import { MockProvider } from "./aiProvider.js";
import { generateReviewReport } from "./reviewReport.js";

interface GenerateApplicationPackOptions {
  opportunity: Opportunity;
  profile: Profile;
  outputRoot: string;
  date?: string;
  aiProvider?: AIProvider;
  useAI?: boolean;
}

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
  const evidenceAnalysis = analyzeEvidence({
    opportunity: options.opportunity,
    profile: options.profile,
    score: options.opportunity.score
  });
  const aiAppendix = useAI
    ? await createAIAppendix(options.opportunity, options.profile, aiProvider)
    : "";

  const files = new Map<string, string>();

  if (options.opportunity.jobDescriptionCleaning) {
    files.set(
      "00-review-report.md",
      generateReviewReport(options.opportunity, options.profile, evidenceAnalysis)
    );
  }

  files.set(
    "01-fit-analysis.md",
    fitAnalysis(
      options.opportunity,
      options.profile,
      evidenceAnalysis,
      useAI,
      aiAppendix
    )
  );
  files.set(
    "02-resume-tailoring-notes.md",
    resumeTailoringNotes(
      options.opportunity,
      options.profile,
      evidenceAnalysis,
      useAI,
      aiAppendix
    )
  );
  files.set(
    "03-cover-email-draft.md",
    coverEmailDraft(
      options.opportunity,
      options.profile,
      evidenceAnalysis,
      useAI,
      aiAppendix
    )
  );
  files.set(
    "04-referral-message.md",
    referralMessage(
      options.opportunity,
      options.profile,
      evidenceAnalysis,
      useAI,
      aiAppendix
    )
  );
  files.set(
    "05-application-checklist.md",
    applicationChecklist(
      options.opportunity,
      evidenceAnalysis,
      useAI,
      aiAppendix
    )
  );

  await mkdir(directory, { recursive: true });

  for (const [fileName, content] of files) {
    await writeFile(join(directory, fileName), content, "utf8");
  }

  return {
    directory,
    files: [...files.keys()].map((fileName) => join(directory, fileName))
  };
}

function fitAnalysis(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceAnalysis,
  useAI: boolean,
  aiAppendix: string
): string {
  const score = opportunity.score;
  const verdict =
    evidence.applicationRiskLevel === "high"
      ? "This is a possible strategic application only if Kaze can add verified evidence for the specialized health, workforce, donor, safeguarding, and institutional requirements. The score may justify review, but the current profile does not support claiming direct specialized programme experience."
      : "This is a reviewable fit if Kaze can keep claims grounded in verified profile evidence and avoid inflating specialized experience.";

  return withReviewSections(
    `# Fit Analysis: ${opportunity.company} - ${opportunity.role}

## Executive Fit Verdict
- Score: ${formatScore(score?.strategicFitScore)}
- Decision: ${score?.decision ?? "Not scored"}
- Risk level: ${evidence.applicationRiskLevel}
- Verdict: ${verdict}

## Opportunity Snapshot
- Company: ${opportunity.company}
- Role: ${opportunity.role}
- Source: ${opportunity.source}
- Method: ${opportunity.method}
- Deadline: ${opportunity.deadline || "Not provided"}
- URL: ${opportunity.url}

## Profile Positioning
${profile.positioning}

## Strong Evidence
${bulletList(evidence.strongMatches, "No direct evidence found in the starter profile.")}

## Transferable Evidence
${bulletList(
  evidence.transferableMatches,
  "No transferable evidence found from the starter profile."
)}

## Missing or Weak Evidence
Missing Evidence is treated conservatively: a JD requirement only counts as covered when the starter profile directly supports it.
${bulletList(
  evidence.missingEvidence,
  "No specialized missing evidence detected by the local scanner. Review manually anyway."
)}

## Claims Not To Make Yet
${bulletList(
  evidence.riskyClaims,
  "No specific risky claims detected. Still verify every claim manually."
)}

## Recommended Positioning
${evidence.recommendedPositioning}

## Notes
This analysis uses only the profile file, the supplied job description, and the local scoring result. It does not infer credentials, years of experience, employers, degrees, certifications, or results that are not present in the data.`,
    evidence,
    useAI,
    aiAppendix
  );
}

function resumeTailoringNotes(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceAnalysis,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Resume Tailoring Notes: ${opportunity.company} - ${opportunity.role}

## Safe Emphasis Areas
${bulletList(
  [profile.positioning, ...evidence.strongMatches, ...evidence.transferableMatches],
  "No direct or transferable profile match found. Add only verified experience before tailoring."
)}

## Evidence Gaps To Resolve
${bulletList(
  evidence.missingEvidence,
  "No specific evidence gaps detected. Still verify all claims before sending."
)}

## Claims To Avoid Unless Verified
${bulletList(
  evidence.riskyClaims,
  "No risky claim category detected. Still avoid unsupported credentials, years, sectors, or outcomes."
)}

## Suggested Resume Review
- Align summary language with the role only where the profile already supports it.
- Add measurable outcomes only if Kaze can verify them from real work.
- Keep all credentials, employers, dates, and tools factual.
- Soften specialized health, donor, workforce, safeguarding, or ministry claims unless the CV directly supports them.`,
    evidence,
    useAI,
    aiAppendix
  );
}

function coverEmailDraft(
  opportunity: Opportunity,
  profile: Profile,
  evidence: EvidenceAnalysis,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Cover Email Draft: ${opportunity.company} - ${opportunity.role}

Subject: Application for ${opportunity.role} - Kaze

${coverGreeting(opportunity.contact)}

I am writing to express my interest in the ${opportunity.role} role at ${opportunity.company}. I am drawn to roles where structured implementation, partner coordination, and practical systems thinking can help move important work from plan to delivery.

My strongest transferable fit is in project coordination, implementation execution, stakeholder-facing work, multilingual communication, and systems-oriented delivery across technology, business, operations, and sustainability contexts. My profile is best positioned around verified examples of infrastructure project coordination, fintech/customer success discipline, business development, automation, and conservation technology work.

I understand this role also sits in a specialized health, workforce, donor, safeguarding, and institutional partnership context. Before sending this application, I would carefully add only verified examples for those areas and remove or soften anything that could imply direct public health, eye health, donor-funded, safeguarding, or workforce-development experience that I cannot support.

Thank you for considering my application. I would welcome the opportunity to discuss how my implementation and coordination background could support the team while remaining clear about the experience I can verify.

Regards,
Kaze

## Adaptation Notes Before Sending
- Add one verified project example.
- Add one verified stakeholder coordination example.
- Add one verified budget/reporting example if true.
- Add one verified compliance, safeguarding, or risk example if true.
- Remove any unsupported claim.

## Evidence Basis For This Draft
- Direct evidence used: ${inlineList(evidence.strongMatches, "none found")}
- Transferable evidence used: ${inlineList(
      evidence.transferableMatches,
      "none found"
    )}
- Risk level: ${evidence.applicationRiskLevel}`,
    evidence,
    useAI,
    aiAppendix
  );
}

function referralMessage(
  opportunity: Opportunity,
  _profile: Profile,
  evidence: EvidenceAnalysis,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Referral Message: ${opportunity.company} - ${opportunity.role}

${referralGreeting(opportunity.contact)}

I am reviewing the ${opportunity.role} role at ${opportunity.company}. Based on the job description, my clearest fit is around:
${bulletList(evidence.strongMatches, "No direct matched evidence found. Add verified context before asking for a referral.")}

The areas I would frame as transferable rather than direct are:
${bulletList(evidence.transferableMatches, "No transferable evidence found from the starter profile.")}

Would you be open to sharing context on the team, priorities, and whether this background appears relevant before I decide whether to apply?

Thanks,
Kaze`,
    evidence,
    useAI,
    aiAppendix
  );
}

function applicationChecklist(
  opportunity: Opportunity,
  evidence: EvidenceAnalysis,
  useAI: boolean,
  aiAppendix: string
): string {
  return withReviewSections(
    `# Application Checklist: ${opportunity.company} - ${opportunity.role}

## Must Verify Before Applying
- [ ] Deadline: ${opportunity.deadline || "Not provided"}
- [ ] Application method: ${opportunity.method}
- [ ] Clean source JD checked against source page.
- [ ] CV tailored.
- [ ] Cover message edited.
- [ ] No unsupported claims.
- [ ] All evidence gaps resolved, softened, or removed.

## Evidence To Add If True
${checklistItems([
  "project or programme management years",
  "donor-funded delivery",
  "budget management",
  "reporting",
  "stakeholder coordination",
  "workforce development",
  "training or capacity strengthening",
  "safeguarding",
  "compliance",
  "risk management",
  "health, public health, or eye health exposure",
  ...evidence.missingEvidence
])}

## Claims To Remove Unless Verified
${checklistItems([
  "direct health workforce project management",
  "eye health programme delivery",
  "donor-funded programme ownership",
  "safeguarding implementation",
  "formal workforce development leadership",
  "ministry-level partnership management",
  "specific years of programme management unless backed by CV",
  ...evidence.riskyClaims
])}

## Review Warnings
${checklistItems(evidence.reviewWarnings)}

## Final Human Approval Gate
- [ ] Kaze reviewed the full pack.
- [ ] Kaze approved the CV version.
- [ ] Kaze approved the final cover message.
- [ ] Kaze confirmed no automatic submission occurred.`,
    evidence,
    useAI,
    aiAppendix
  );
}

function withReviewSections(
  body: string,
  evidence: EvidenceAnalysis,
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

## Claims to Verify Before Sending
${bulletList(
  evidence.riskyClaims,
  "No risky claim category detected by the local scanner. Still verify all claims manually."
)}

## Evidence Needed Before Sending
${bulletList(
  evidence.missingEvidence,
  "No specific evidence gaps were found by the local scanner. Confirm all claims against real source material before sending."
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

function coverGreeting(contact: string): string {
  if (isMissingContact(contact)) {
    return "Dear Hiring Team,";
  }

  return `Dear ${contact.trim()},`;
}

function referralGreeting(contact: string): string {
  if (isMissingContact(contact)) {
    return "Hi,";
  }

  return `Hi ${contact.trim()},`;
}

function isMissingContact(contact: string): boolean {
  const normalized = contact.trim().toLowerCase();

  return (
    normalized.length === 0 ||
    ["n/a", "na", "none", "unknown", "not available"].includes(normalized)
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function formatScore(score: number | undefined): string {
  return typeof score === "number" ? String(score) : "Not scored";
}

function inlineList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join("; ") : fallback;
}

function bulletList(values: string[], fallback: string): string {
  if (values.length === 0) {
    return `- ${fallback}`;
  }

  return unique(values).map((value) => `- ${value}`).join("\n");
}

function checklistItems(values: string[]): string {
  if (values.length === 0) {
    return "- [ ] No specific items detected. Review manually anyway.";
  }

  return unique(values).map((value) => `- [ ] ${value}`).join("\n");
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
