import { analyzeEvidence } from "./evidenceAnalyzer.js";
import { scoreOpportunity } from "../scoring/scorer.js";
import type {
  ApplicationRiskLevel,
  EffortLevel,
  Opportunity,
  PriorityBand,
  Profile
} from "../types/index.js";

const terminalStatuses = new Set([
  "applied",
  "interview",
  "rejected",
  "closed",
  "ignored"
]);

export function enrichOpportunityWithScore(
  opportunity: Opportunity,
  profile: Profile,
  now = new Date().toISOString()
): Opportunity {
  const score = scoreOpportunity(opportunity, profile);
  const evidence = analyzeEvidence({
    opportunity,
    profile,
    score
  });
  const priorityBand = priorityBandFor({
    score: score.strategicFitScore,
    decision: score.decision,
    effort: score.effortLevel,
    risk: evidence.applicationRiskLevel
  });
  const recommendedAction = recommendedActionFor({
    priorityBand,
    risk: evidence.applicationRiskLevel
  });

  return {
    ...opportunity,
    score,
    priorityBand,
    effortEstimate: score.effortLevel,
    applicationRiskLevel: evidence.applicationRiskLevel,
    recommendedAction,
    nextAction: recommendedAction,
    status: terminalStatuses.has(opportunity.status) ? opportunity.status : "scored",
    lastUpdated: now
  };
}

export function priorityBandFor(input: {
  score: number;
  decision: string;
  effort: EffortLevel;
  risk: ApplicationRiskLevel;
}): PriorityBand {
  if (input.decision === "Ignore" || input.score < 50) {
    return "D";
  }

  if (input.score >= 75 && input.risk !== "high" && input.effort !== "high") {
    return "A";
  }

  if (input.score >= 65 || (input.score >= 60 && input.risk === "high")) {
    return "B";
  }

  return "C";
}

function recommendedActionFor(input: {
  priorityBand: PriorityBand;
  risk: ApplicationRiskLevel;
}): string {
  if (input.priorityBand === "A") {
    return "Shortlist and prepare application pack";
  }

  if (input.priorityBand === "B") {
    return input.risk === "high"
      ? "Review evidence gaps before generating a pack"
      : "Review fit, then generate pack if still strategically useful";
  }

  if (input.priorityBand === "C") {
    return "Park for later unless deadline or strategy changes";
  }

  return "Ignore unless new information changes fit";
}
