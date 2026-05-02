import { formatLocalDate } from "../core/date.js";
import { compareRank } from "./shortlist.js";
import type { Opportunity } from "../types/index.js";

export function generateDailyBrief(
  opportunities: Opportunity[],
  date = formatLocalDate()
): string {
  const active = opportunities.filter((opportunity) => !isClosed(opportunity));
  const top = [...active]
    .filter((opportunity) => opportunity.priorityBand !== "D")
    .sort((a, b) => compareRank(a, b, date))
    .slice(0, 5);
  const urgentDeadlines = active
    .filter((opportunity) => isUrgentDeadline(opportunity.deadline, date))
    .sort((a, b) => compareDeadline(a.deadline, b.deadline));
  const reviewReady = active.filter(
    (opportunity) =>
      opportunity.status === "review_ready" ||
      opportunity.status === "pack_generated"
  );
  const followUpsDue = active.filter((opportunity) =>
    isFollowUpDue(opportunity, date)
  );
  const stale = active.filter((opportunity) => isStale(opportunity, date));
  const doNotTouch = opportunities.filter(
    (opportunity) =>
      opportunity.priorityBand === "D" || opportunity.status === "ignored"
  );

  return `# Daily Opportunity Brief

Date: ${date}

## Today's Top 5 Opportunities
${formatOpportunityList(top)}

## Urgent Deadlines
${formatOpportunityList(urgentDeadlines)}

## Review-Ready Packs
${formatOpportunityList(reviewReady)}

## Follow-ups Due
${formatOpportunityList(followUpsDue)}

## Stale Opportunities
${formatOpportunityList(stale)}

## 20-Minute Workflow
${formatTwentyMinuteWorkflow(opportunities, {
    top,
    followUpsDue,
    reviewReady,
    urgentDeadlines
  })}

## Do Not Touch Today
${formatOpportunityList(doNotTouch)}

## Recommended Next Actions
${formatNextActions(active)}
`;
}

function formatOpportunityList(opportunities: Opportunity[]): string {
  if (opportunities.length === 0) {
    return "- None";
  }

  return opportunities
    .map((opportunity) => {
      const score = opportunity.score
        ? `: ${opportunity.score.strategicFitScore} / ${opportunity.score.decision}`
        : "";
      const band = opportunity.priorityBand ? ` [${opportunity.priorityBand}]` : "";
      const risk = opportunity.applicationRiskLevel
        ? ` risk=${opportunity.applicationRiskLevel}`
        : "";
      const followUp = opportunity.followUpDate
        ? ` follow-up=${opportunity.followUpDate}`
        : "";

      return `- ${opportunity.company} - ${opportunity.role} (${opportunity.id})${band}${score}${risk}${followUp}`;
    })
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
          opportunity.nextAction ??
          opportunity.recommendedAction ??
          inferNextAction(opportunity)
        }`
    )
    .join("\n");
}

function inferNextAction(opportunity: Opportunity): string {
  if (!opportunity.score) {
    return "Score opportunity";
  }

  if (opportunity.priorityBand === "A") {
    return "Shortlist and prepare application pack";
  }

  if (opportunity.priorityBand === "B") {
    return "Review evidence gaps before generating a pack";
  }

  if (opportunity.score.decision === "Maybe") {
    return "Review fit manually before spending more time";
  }

  return "No action unless strategic context changes";
}

function formatTwentyMinuteWorkflow(
  opportunities: Opportunity[],
  groups: {
    top: Opportunity[];
    followUpsDue: Opportunity[];
    reviewReady: Opportunity[];
    urgentDeadlines: Opportunity[];
  }
): string {
  const focus =
    groups.followUpsDue[0] ??
    groups.reviewReady[0] ??
    groups.urgentDeadlines[0] ??
    groups.top[0] ??
    opportunities[0];

  if (!focus) {
    return [
      "- 0-5 min: Import or add one high-quality opportunity.",
      "- 5-15 min: Score it and decide whether it deserves attention.",
      "- 15-20 min: Write the next action or stop."
    ].join("\n");
  }

  const nextAction =
    focus.nextAction ?? focus.recommendedAction ?? inferNextAction(focus);
  const label = `${focus.company} - ${focus.role}`;

  return [
    `- 0-5 min: Open ${label} and confirm the current status.`,
    `- 5-15 min: ${label}: ${nextAction}.`,
    "- 15-20 min: Update status, nextAction, and any follow-up notes before stopping."
  ].join("\n");
}

function isClosed(opportunity: Opportunity): boolean {
  return ["closed", "rejected"].includes(opportunity.status);
}

function isFollowUpDue(opportunity: Opportunity, date: string): boolean {
  if (opportunity.followUpDate) {
    return opportunity.followUpDate <= date;
  }

  return opportunity.status === "follow_up_due" || opportunity.status === "follow_up";
}

function isUrgentDeadline(deadline: string, date: string): boolean {
  if (!deadline) {
    return false;
  }

  const days = daysUntil(deadline, date);

  return days >= 0 && days <= 7;
}

function isStale(opportunity: Opportunity, date: string): boolean {
  if (["ignored", "applied", "interview", "closed", "rejected"].includes(opportunity.status)) {
    return false;
  }

  const lastUpdatedDate = opportunity.lastUpdated.slice(0, 10);

  return daysUntil(date, lastUpdatedDate) >= 7;
}

function compareDeadline(a: string, b: string): number {
  if (!a && !b) {
    return 0;
  }

  if (!a) {
    return 1;
  }

  if (!b) {
    return -1;
  }

  return a.localeCompare(b);
}

function daysUntil(deadline: string, date: string): number {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  const end = Date.parse(`${deadline}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 999;
  }

  return Math.floor((end - start) / 86_400_000);
}
