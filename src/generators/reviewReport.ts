import type { EvidenceAnalysis } from "../core/evidenceAnalyzer.js";
import type { Opportunity, Profile } from "../types/index.js";

export function generateReviewReport(
  opportunity: Opportunity,
  _profile: Profile,
  evidence: EvidenceAnalysis
): string {
  const cleaning = opportunity.jobDescriptionCleaning;
  const originalScore = cleaning?.previousScore;
  const newScore = opportunity.score;
  const decisionChanged =
    originalScore && newScore
      ? originalScore.decision !== newScore.decision
      : false;

  return `# Review Report: ${opportunity.company} - ${opportunity.role}

## Score Comparison
- Original Score: ${formatScore(originalScore?.strategicFitScore)}
- New Score: ${formatScore(newScore?.strategicFitScore)}
- Original Decision: ${originalScore?.decision ?? "Not available"}
- New Decision: ${newScore?.decision ?? "Not available"}
- Decision Changed: ${decisionChanged ? "Yes" : "No"}
- Application Risk Level: ${evidence.applicationRiskLevel}
- Regeneration Status: review_ready after local pack generation completes

## Evidence Analysis Consistency
- Review report, fit analysis, cover email, and checklist were generated from the same EvidenceAnalysis object in the same generation call.

## What Changed After JD Cleaning
${bulletList(cleaning?.summary ?? [], "No cleaning metadata found.")}
- Original JD length: ${cleaning?.originalLength ?? "Not available"}
- Cleaned JD length: ${cleaning?.cleanedLength ?? "Not available"}
- The cleaner only removed obvious duplication, repeated fragments, and whitespace artifacts. It did not add missing job details.

## Top Missing Evidence
${bulletList(
  evidence.missingEvidence.slice(0, 8),
  "No specific missing evidence categories detected by the local scanner. Confirm fit against real CV evidence anyway."
)}

## Top Risky Claims
${bulletList(
  evidence.riskyClaims.slice(0, 8),
  "No specific risky claim categories detected by the local scanner. Review all claims manually anyway."
)}

## Review Warnings
${bulletList(evidence.reviewWarnings, "No specific review warnings detected.")}

## Final Human-Review Checklist
- [ ] Compare the cleaned job description against the original source page.
- [ ] Verify every claim in the cover email, referral message, and resume notes.
- [ ] Remove unsupported claims about years of experience, health sector work, donor-funded delivery, safeguarding, or workforce development.
- [ ] Confirm the application method is still ${opportunity.method}.
- [ ] Confirm nothing has been submitted or sent automatically.
`;
}

function formatScore(score: number | undefined): string {
  return typeof score === "number" ? String(score) : "Not available";
}

function bulletList(values: string[], fallback: string): string {
  if (values.length === 0) {
    return `- ${fallback}`;
  }

  return values.map((value) => `- ${value}`).join("\n");
}
