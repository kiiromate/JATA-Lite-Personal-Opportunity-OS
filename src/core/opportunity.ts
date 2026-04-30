import { randomBytes } from "node:crypto";
import {
  applicationMethods,
  type ApplicationMethod,
  type Opportunity,
  type OpportunityInput
} from "../types/index.js";

interface CreateOpportunityOptions {
  id?: string;
  now?: string;
}

export function createOpportunity(
  input: OpportunityInput,
  options: CreateOpportunityOptions = {}
): Opportunity {
  const normalized = normalizeOpportunityInput(input);
  const errors = validateOpportunityInput(normalized);

  if (errors.length > 0) {
    throw new Error(`Invalid opportunity: ${errors.join("; ")}`);
  }

  const now = options.now ?? new Date().toISOString();

  return {
    id: options.id ?? createOpportunityId(),
    createdAt: now,
    lastUpdated: now,
    company: normalized.company,
    role: normalized.role,
    url: normalized.url,
    source: normalized.source,
    jobDescription: normalized.jobDescription,
    deadline: normalized.deadline,
    contact: normalized.contact,
    method: normalized.method as ApplicationMethod,
    notes: normalized.notes,
    status: "captured",
    nextAction: "Score opportunity"
  };
}

export function validateOpportunityInput(input: OpportunityInput): string[] {
  const errors: string[] = [];

  if (!input.company) {
    errors.push("company is required");
  }

  if (!input.role) {
    errors.push("role title is required");
  }

  if (!input.url) {
    errors.push("opportunity URL is required");
  } else if (!isValidUrl(input.url)) {
    errors.push("opportunity URL must be a valid URL");
  }

  if (!input.source) {
    errors.push("source is required");
  }

  if (!input.jobDescription) {
    errors.push("full job description is required");
  }

  if (input.deadline && !isIsoDate(input.deadline)) {
    errors.push("deadline must use YYYY-MM-DD format");
  }

  if (!applicationMethods.includes(input.method as ApplicationMethod)) {
    errors.push(
      `application method must be one of: ${applicationMethods.join(", ")}`
    );
  }

  return errors;
}

function normalizeOpportunityInput(input: OpportunityInput): OpportunityInput {
  return {
    company: clean(input.company),
    role: clean(input.role),
    url: clean(input.url),
    source: clean(input.source),
    jobDescription: clean(input.jobDescription),
    deadline: clean(input.deadline),
    contact: clean(input.contact),
    method: clean(input.method).toLowerCase(),
    notes: clean(input.notes)
  };
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function createOpportunityId(): string {
  return `opp_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}
