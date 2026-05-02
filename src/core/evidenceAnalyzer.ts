import type {
  ApplicationRiskLevel,
  Opportunity,
  OpportunityScore,
  Profile
} from "../types/index.js";

export interface EvidenceAnalysis {
  strongMatches: string[];
  transferableMatches: string[];
  missingEvidence: string[];
  riskyClaims: string[];
  recommendedPositioning: string;
  applicationRiskLevel: ApplicationRiskLevel;
  reviewWarnings: string[];
}

export interface AnalyzeEvidenceInput {
  profile: Profile;
  opportunity: Opportunity;
  score?: OpportunityScore;
}

interface RequirementRule {
  jdPatterns: RegExp[];
  profilePatterns: RegExp[];
  missingEvidence: string;
  riskyClaim: string;
}

const specializedRequirementRules: RequirementRule[] = [
  {
    jdPatterns: [
      /5\s*[–-]\s*7\s+years/i,
      /5\s+to\s+7\s+years/i,
      /years[^\n.]{0,80}(project|programme|program)/i
    ],
    profilePatterns: [/5\s*[–-]\s*7\s+years/i, /5\s+to\s+7\s+years/i],
    missingEvidence:
      "Verified 5-7 years of project or programme management evidence",
    riskyClaim: "5-7 years of programme management unless backed by CV"
  },
  {
    jdPatterns: [/donor[-\s]?funded/i, /\bdonor\b/i],
    profilePatterns: [/donor[-\s]?funded/i, /\bdonor\b/i],
    missingEvidence:
      "Donor-funded project delivery, budget, and reporting evidence",
    riskyClaim: "Donor-funded programme ownership or reporting"
  },
  {
    jdPatterns: [/public health/i, /eye health/i, /health programme/i, /health program/i],
    profilePatterns: [/public health/i, /eye health/i, /health programme/i, /health program/i],
    missingEvidence:
      "Direct public health or eye health programme delivery evidence",
    riskyClaim: "Direct public health or eye health programme delivery"
  },
  {
    jdPatterns: [
      /workforce development/i,
      /\bworkforce\b/i,
      /workforce strengthen/i,
      /capacity strengthening/i,
      /capacity development/i
    ],
    profilePatterns: [
      /workforce development/i,
      /\bworkforce\b/i,
      /workforce strengthen/i,
      /capacity strengthening/i,
      /capacity development/i
    ],
    missingEvidence:
      "Formal workforce development or capacity strengthening evidence",
    riskyClaim: "Formal workforce development or training systems leadership"
  },
  {
    jdPatterns: [
      /training systems/i,
      /pre[-\s]?service/i,
      /in[-\s]?service/i,
      /faculty development/i,
      /mentorship/i,
      /\bcpd\b/i,
      /continuous professional development/i
    ],
    profilePatterns: [
      /training systems/i,
      /pre[-\s]?service/i,
      /in[-\s]?service/i,
      /faculty development/i,
      /mentorship/i,
      /\bcpd\b/i,
      /continuous professional development/i
    ],
    missingEvidence:
      "Training systems, faculty development, mentorship, or CPD evidence",
    riskyClaim: "Formal workforce development or training systems leadership"
  },
  {
    jdPatterns: [/safeguarding/i, /child[-\s]?safe/i, /child protection/i],
    profilePatterns: [/safeguarding/i, /child[-\s]?safe/i, /child protection/i],
    missingEvidence: "Safeguarding or child-safe implementation evidence",
    riskyClaim: "Safeguarding or child-safe implementation responsibility"
  },
  {
    jdPatterns: [
      /\bbudget/i,
      /forecast/i,
      /finance/i,
      /value for money/i
    ],
    profilePatterns: [
      /\bbudget/i,
      /forecast/i,
      /finance/i,
      /value for money/i
    ],
    missingEvidence: "Activity-level budget management or forecasting evidence",
    riskyClaim: "Budget ownership or financial forecasting unless backed by CV"
  },
  {
    jdPatterns: [/reporting/i, /donor report/i, /management report/i],
    profilePatterns: [/reporting/i, /donor report/i, /management report/i],
    missingEvidence: "Donor or management reporting evidence",
    riskyClaim: "Donor or management reporting ownership"
  },
  {
    jdPatterns: [
      /ministry/i,
      /government/i,
      /\bngo\b/i,
      /academic/i,
      /training institution/i
    ],
    profilePatterns: [
      /ministry/i,
      /government/i,
      /\bngo\b/i,
      /academic/i,
      /training institution/i
    ],
    missingEvidence:
      "Ministry of Health, government, NGO, or academic institution coordination evidence",
    riskyClaim: "Ministry-level partnership management"
  }
];

export function analyzeEvidence(input: AnalyzeEvidenceInput): EvidenceAnalysis {
  const opportunity = input.opportunity;
  const profile = input.profile;
  const score = input.score ?? opportunity.score;
  const jobText = normalizeText(
    [
      opportunity.company,
      opportunity.role,
      opportunity.source,
      opportunity.jobDescription,
      opportunity.notes
    ].join(" ")
  );
  const profileText = normalizeText(
    [
      profile.positioning,
      ...profile.strengths,
      ...profile.targetLanes,
      ...profile.constraints,
      ...profile.languages
    ].join(" ")
  );

  const strongMatches = directMatches(jobText, profileText, profile);
  const transferableMatches = transferableEvidence(jobText, profileText);
  const missingEvidence: string[] = [];
  const riskyClaims: string[] = [];

  for (const rule of specializedRequirementRules) {
    if (
      matchesAny(jobText, rule.jdPatterns) &&
      !matchesAny(profileText, rule.profilePatterns)
    ) {
      missingEvidence.push(rule.missingEvidence);
      riskyClaims.push(rule.riskyClaim);
    }
  }

  if (/\bsql\b/i.test(jobText) && !/\bsql\b/i.test(profileText)) {
    missingEvidence.push("SQL evidence");
    riskyClaims.push("SQL competency unless backed by CV");
  }

  if (
    /enterprise onboarding/i.test(jobText) &&
    !/enterprise onboarding/i.test(profileText)
  ) {
    missingEvidence.push("Enterprise onboarding evidence");
    riskyClaims.push("Enterprise onboarding ownership unless backed by CV");
  }

  const applicationRiskLevel = riskLevel(missingEvidence, riskyClaims);
  const reviewWarnings = reviewWarningsFor({
    applicationRiskLevel,
    missingEvidence,
    riskyClaims,
    opportunity
  });
  const recommendedPositioning = recommendedPositioningFor({
    opportunity,
    profile,
    score,
    applicationRiskLevel,
    missingEvidence
  });

  return {
    strongMatches: unique(strongMatches),
    transferableMatches: unique(transferableMatches),
    missingEvidence: unique(missingEvidence),
    riskyClaims: unique(riskyClaims),
    recommendedPositioning,
    applicationRiskLevel,
    reviewWarnings
  };
}

function directMatches(
  jobText: string,
  profileText: string,
  profile: Profile
): string[] {
  const matches: string[] = [];

  if (
    containsAny(jobText, [
      "project",
      "programme",
      "program",
      "coordination",
      "implementation",
      "workplan"
    ]) &&
    containsAny(profileText, [
      "project/program coordination",
      "project execution",
      "infrastructure project coordination",
      "implementation specialist"
    ])
  ) {
    matches.push("Project/program coordination and implementation execution");
  }

  if (
    containsAny(jobText, ["stakeholder", "partner", "coordination"]) &&
    containsAny(profileText, [
      "business development",
      "customer success",
      "project coordination"
    ])
  ) {
    matches.push("Stakeholder-facing coordination and delivery discipline");
  }

  if (
    containsAny(jobText, ["communication", "cultures", "international", "partners"]) &&
    containsAny(profileText, ["multilingual", "bilingual", "english", "french"])
  ) {
    matches.push(`Multilingual communication: ${profile.languages.join(", ")}`);
  }

  if (
    containsAny(jobText, ["systems", "implementation", "operations"]) &&
    containsAny(profileText, ["technology", "business", "operations", "automation"])
  ) {
    matches.push(
      "Systems-oriented execution across technology, business, operations, and sustainability"
    );
  }

  return matches;
}

function transferableEvidence(jobText: string, profileText: string): string[] {
  const matches: string[] = [];

  if (
    containsAny(jobText, ["workplan", "project", "programme", "implementation"]) &&
    profileText.includes("infrastructure project coordination")
  ) {
    matches.push(
      "Infrastructure project coordination can transfer to structured workplan delivery and partner follow-through."
    );
  }

  if (
    containsAny(jobText, ["stakeholder", "partner", "delivery", "coordination"]) &&
    profileText.includes("fintech sales and customer success")
  ) {
    matches.push(
      "Fintech sales and customer success can transfer to stakeholder communication and service delivery discipline."
    );
  }

  if (
    containsAny(jobText, ["foundation", "mission", "sustainable", "community", "health"]) &&
    profileText.includes("conservation technology")
  ) {
    matches.push(
      "Conservation technology can transfer to mission-driven sustainable impact contexts."
    );
  }

  if (
    containsAny(jobText, ["partner", "stakeholder", "ministry", "institution"]) &&
    profileText.includes("business development")
  ) {
    matches.push(
      "Business development can transfer to partner engagement and coordination."
    );
  }

  if (
    containsAny(jobText, ["international", "cultures", "partners", "rwanda"]) &&
    containsAny(profileText, ["multilingual", "kinyarwanda", "swahili"])
  ) {
    matches.push(
      "Multilingual communication can transfer to cross-institution and cross-cultural collaboration."
    );
  }

  return matches;
}

function riskLevel(
  missingEvidence: string[],
  riskyClaims: string[]
): ApplicationRiskLevel {
  if (
    missingEvidence.length >= 5 ||
    riskyClaims.some((claim) =>
      /public health|eye health|donor-funded|safeguarding|workforce/i.test(
        claim
      )
    )
  ) {
    return "high";
  }

  if (missingEvidence.length >= 2 || riskyClaims.length >= 2) {
    return "medium";
  }

  return "low";
}

function reviewWarningsFor(input: {
  applicationRiskLevel: ApplicationRiskLevel;
  missingEvidence: string[];
  riskyClaims: string[];
  opportunity: Opportunity;
}): string[] {
  const warnings: string[] = [];

  if (input.applicationRiskLevel === "high") {
    warnings.push(
      "High review risk: specialized role requirements are present but not directly supported by the starter profile."
    );
  }

  if (input.missingEvidence.length > 0) {
    warnings.push(
      "Resolve, soften, or remove every missing-evidence item before sending any application material."
    );
  }

  if (input.riskyClaims.length > 0) {
    warnings.push(
      "Do not make risky claims unless Kaze can verify them from the CV or source material."
    );
  }

  if (input.opportunity.jobDescriptionCleaning) {
    warnings.push(
      "The job description was cleaned locally; compare it with the source page before final use."
    );
  }

  return unique(warnings);
}

function recommendedPositioningFor(input: {
  opportunity: Opportunity;
  profile: Profile;
  score?: OpportunityScore;
  applicationRiskLevel: ApplicationRiskLevel;
  missingEvidence: string[];
}): string {
  const scoreText = input.score
    ? `The local score is ${input.score.strategicFitScore} with decision ${input.score.decision}.`
    : "No local score is available yet.";
  const gapText =
    input.missingEvidence.length > 0
      ? "Specialized health, workforce, donor, safeguarding, and institutional requirements should be handled as gaps unless verified separately."
      : "No specialized gaps were detected, but all claims still require human review.";

  return [
    `${scoreText} Position Kaze as ${input.profile.positioning.toLowerCase()}`,
    `For ${input.opportunity.role}, lead with verified project coordination, implementation, stakeholder communication, multilingual, and systems-oriented execution.`,
    gapText,
    `Application risk level: ${input.applicationRiskLevel}.`
  ].join(" ");
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
