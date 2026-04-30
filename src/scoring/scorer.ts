import type {
  Decision,
  EffortLevel,
  Opportunity,
  OpportunityScore,
  Profile
} from "../types/index.js";

const sectorKeywords = [
  "fintech",
  "finance",
  "climate",
  "agri",
  "agriculture",
  "sustainable",
  "sustainability",
  "infrastructure",
  "conservation",
  "automation",
  "operations",
  "technology"
];

const roleKeywords = [
  "implementation",
  "customer success",
  "operations",
  "project",
  "program",
  "coordination",
  "business development",
  "automation",
  "consultant",
  "specialist"
];

const compensationPositive = [
  "senior",
  "lead",
  "manager",
  "consultant",
  "global",
  "remote",
  "equity",
  "salary",
  "commission"
];

const compensationNegative = ["intern", "unpaid", "volunteer", "stipend"];

export function scoreOpportunity(
  opportunity: Opportunity,
  profile: Profile
): OpportunityScore {
  const text = searchableText(opportunity);
  const profileText = [
    profile.positioning,
    ...profile.strengths,
    ...profile.targetLanes,
    ...profile.constraints,
    ...profile.languages
  ]
    .join(" ")
    .toLowerCase();

  const sectorFit = fitFromKeywordHits(text, sectorKeywords);
  const roleFit = fitFromKeywordHits(text, [
    ...roleKeywords,
    ...profile.targetLanes,
    ...profile.strengths
  ]);
  const compensationPotential = compensationScore(text);
  const remoteGlobalFit = remoteScore(text);
  const networkValue = networkScore(opportunity);
  const effortLevel = effortScore(opportunity);
  const effortValue = effortLevel === "low" ? 8 : effortLevel === "medium" ? 6 : 3;

  const strategicFitScore = clamp(
    Math.round(
      (sectorFit * 0.22 +
        roleFit * 0.26 +
        compensationPotential * 0.15 +
        remoteGlobalFit * 0.18 +
        networkValue * 0.12 +
        effortValue * 0.07) *
        10
    ),
    0,
    100
  );

  const decision = decisionFromScore(strategicFitScore);

  return {
    strategicFitScore,
    sectorFit,
    roleFit,
    compensationPotential,
    remoteGlobalFit,
    networkValue,
    effortLevel,
    decision,
    rationale: buildRationale({
      decision,
      sectorFit,
      roleFit,
      remoteGlobalFit,
      networkValue,
      text,
      profileText
    })
  };
}

function searchableText(opportunity: Opportunity): string {
  return [
    opportunity.company,
    opportunity.role,
    opportunity.source,
    opportunity.jobDescription,
    opportunity.notes,
    opportunity.method
  ]
    .join(" ")
    .toLowerCase();
}

function fitFromKeywordHits(text: string, keywords: string[]): number {
  const uniqueHits = new Set(
    keywords
      .map((keyword) => keyword.toLowerCase())
      .filter((keyword) => keyword.length > 2 && text.includes(keyword))
  );

  if (uniqueHits.size === 0) {
    return 1;
  }

  return clamp(3 + uniqueHits.size * 2, 0, 10);
}

function compensationScore(text: string): number {
  const negativeHits = compensationNegative.filter((keyword) =>
    text.includes(keyword)
  ).length;
  const positiveHits = compensationPositive.filter((keyword) =>
    text.includes(keyword)
  ).length;

  return clamp(5 + positiveHits - negativeHits * 2, 1, 10);
}

function remoteScore(text: string): number {
  if (
    text.includes("no remote") ||
    text.includes("onsite") ||
    text.includes("on-site") ||
    text.includes("local presence required")
  ) {
    return 2;
  }

  const hits = ["remote", "global", "international", "distributed"].filter(
    (keyword) => text.includes(keyword)
  ).length;

  return clamp(4 + hits * 4, 1, 10);
}

function networkScore(opportunity: Opportunity): number {
  let score = 3;

  if (opportunity.contact) {
    score += 2;
  }

  if (opportunity.method === "referral") {
    score += 3;
  } else if (opportunity.method === "recruiter") {
    score += 2;
  } else if (opportunity.method === "email") {
    score += 1;
  }

  if (opportunity.source.toLowerCase().includes("referral")) {
    score += 1;
  }

  return clamp(score, 0, 10);
}

function effortScore(opportunity: Opportunity): EffortLevel {
  if (opportunity.method === "referral" || opportunity.method === "recruiter") {
    return "low";
  }

  if (opportunity.jobDescription.length > 4500) {
    return "high";
  }

  return "medium";
}

function decisionFromScore(score: number): Decision {
  if (score >= 70) {
    return "Pursue";
  }

  if (score >= 50) {
    return "Maybe";
  }

  return "Ignore";
}

function buildRationale(input: {
  decision: Decision;
  sectorFit: number;
  roleFit: number;
  remoteGlobalFit: number;
  networkValue: number;
  text: string;
  profileText: string;
}): string {
  const reasons: string[] = [];

  if (input.roleFit >= 7) {
    reasons.push("strong target lane and role fit");
  } else if (input.roleFit <= 3) {
    reasons.push("weak target lane and role fit");
  }

  if (input.sectorFit >= 7) {
    reasons.push("sector aligns with preferred lanes");
  } else if (input.sectorFit <= 3) {
    reasons.push("sector alignment is limited");
  }

  if (input.remoteGlobalFit >= 7) {
    reasons.push("remote/global fit is favorable");
  } else if (input.remoteGlobalFit <= 3) {
    reasons.push("remote/global fit is weak");
  }

  if (input.networkValue >= 7) {
    reasons.push("network path is useful");
  }

  return `${input.decision}: ${reasons.join("; ") || "mixed fit signals"}.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
