import { pipelineStatuses } from "../types/index.js";
import type { Opportunity, PipelineStatus } from "../types/index.js";

interface TrackingOptions {
  now?: string;
}

export function updatePipelineStatus(
  opportunities: Opportunity[],
  opportunityId: string,
  status: PipelineStatus,
  options: TrackingOptions = {}
): Opportunity[] {
  assertPipelineStatus(status);
  const now = options.now ?? new Date().toISOString();

  return updateOpportunity(opportunities, opportunityId, (opportunity) => {
    const updated: Opportunity = {
      ...opportunity,
      status,
      lastUpdated: now
    };

    if (status === "applied") {
      updated.appliedAt = opportunity.appliedAt ?? now;
      updated.nextAction =
        "Record follow-up date after manual application outside JATA Lite";
    } else if (status === "ignored") {
      updated.nextAction = "Do not pursue unless new information changes fit";
    }

    return updated;
  });
}

export function updateNextAction(
  opportunities: Opportunity[],
  opportunityId: string,
  nextAction: string,
  options: TrackingOptions = {}
): Opportunity[] {
  const now = options.now ?? new Date().toISOString();
  const cleanAction = nextAction.trim();

  if (!cleanAction) {
    throw new Error("Next action cannot be blank.");
  }

  return updateOpportunity(opportunities, opportunityId, (opportunity) => ({
    ...opportunity,
    nextAction: cleanAction,
    lastUpdated: now
  }));
}

export function markApplied(
  opportunities: Opportunity[],
  opportunityId: string,
  options: TrackingOptions = {}
): Opportunity[] {
  return updatePipelineStatus(opportunities, opportunityId, "applied", options);
}

export function scheduleFollowUp(
  opportunities: Opportunity[],
  opportunityId: string,
  followUpDate: string,
  options: TrackingOptions = {}
): Opportunity[] {
  if (!isIsoDate(followUpDate)) {
    throw new Error("Follow-up date must use YYYY-MM-DD format.");
  }

  const now = options.now ?? new Date().toISOString();

  return updateOpportunity(opportunities, opportunityId, (opportunity) => ({
    ...opportunity,
    status: "follow_up_due",
    followUpDate,
    nextAction: `Follow up manually on ${followUpDate}`,
    lastUpdated: now
  }));
}

export function ignoreOpportunity(
  opportunities: Opportunity[],
  opportunityId: string,
  options: TrackingOptions = {}
): Opportunity[] {
  return updatePipelineStatus(opportunities, opportunityId, "ignored", options);
}

function updateOpportunity(
  opportunities: Opportunity[],
  opportunityId: string,
  updater: (opportunity: Opportunity) => Opportunity
): Opportunity[] {
  let found = false;
  const updated = opportunities.map((opportunity) => {
    if (opportunity.id !== opportunityId) {
      return opportunity;
    }

    found = true;
    return updater(opportunity);
  });

  if (!found) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  return updated;
}

function assertPipelineStatus(status: string): asserts status is PipelineStatus {
  if (!pipelineStatuses.includes(status as PipelineStatus)) {
    throw new Error(
      `Status must be one of: ${pipelineStatuses.join(", ")}`
    );
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
