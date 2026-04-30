import { formatLocalDate } from "../core/date.js";
import type { Opportunity } from "../types/index.js";

export function generateDailyBrief(
  opportunities: Opportunity[],
  date = formatLocalDate()
): string {
  const pursue = opportunities
    .filter((opportunity) => opportunity.score?.decision === "Pursue")
    .sort(
      (a, b) =>
        (b.score?.strategicFitScore ?? 0) - (a.score?.strategicFitScore ?? 0)
    )
    .slice(0, 3);

  const overdueFollowUps = opportunities.filter(
    (opportunity) =>
      opportunity.status === "follow_up" &&
      opportunity.deadline &&
      opportunity.deadline < date
  );

  const waitingForReview = opportunities.filter(
    (opportunity) => opportunity.status === "review_ready"
  );

  return `# Daily Opportunity Brief

Date: ${date}

## Top 3 Pursue Opportunities
${formatOpportunityList(pursue)}

## Overdue Follow-ups
${formatOpportunityList(overdueFollowUps)}

## Applications Waiting for Review
${formatOpportunityList(waitingForReview)}

## 20-Minute Workflow
${formatTwentyMinuteWorkflow(opportunities, {
  pursue,
  overdueFollowUps,
  waitingForReview
})}

## Recommended Next Actions
${formatNextActions(opportunities)}
`;
}

function formatOpportunityList(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) {
    return "- None";
  }

  return opportunities
    .map(
      (opportunity) =>
        `- ${opportunity.company} - ${opportunity.role} (${opportunity.id})${
          opportunity.score
            ? `: ${opportunity.score.strategicFitScore} / ${opportunity.score.decision}`
            : ""
        }`
    )
    .join("\n");
}

function formatNextActions(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) {
    return "- No opportunities captured yet. Add one high-quality opportunity.";
  }

  return opportunities
    .map(
      (opportunity) =>
        `- ${opportunity.company} - ${opportunity.role}: ${
          opportunity.nextAction ?? inferNextAction(opportunity)
        }`
    )
    .join("\n");
}

function inferNextAction(opportunity: Opportunity): string {
  if (!opportunity.score) {
    return "Score opportunity";
  }

  if (opportunity.score.decision === "Pursue") {
    return "Generate and review application pack";
  }

  if (opportunity.score.decision === "Maybe") {
    return "Review fit manually before spending more time";
  }

  return "No action unless strategic context changes";
}

function formatTwentyMinuteWorkflow(
  opportunities: Opportunity[],
  groups: {
    pursue: Opportunity[];
    overdueFollowUps: Opportunity[];
    waitingForReview: Opportunity[];
  }
): string {
  const focus =
    groups.overdueFollowUps[0] ??
    groups.waitingForReview[0] ??
    groups.pursue[0] ??
    opportunities[0];

  if (!focus) {
    return [
      "- 0-5 min: Add one high-quality opportunity.",
      "- 5-15 min: Score it and decide whether it deserves attention.",
      "- 15-20 min: Write the next action or stop."
    ].join("\n");
  }

  const nextAction = focus.nextAction ?? inferNextAction(focus);
  const label = `${focus.company} - ${focus.role}`;

  return [
    `- 0-5 min: Open ${label} and confirm the current status.`,
    `- 5-15 min: ${label}: ${nextAction}.`,
    "- 15-20 min: Update status, nextAction, and any follow-up notes before stopping."
  ].join("\n");
}
