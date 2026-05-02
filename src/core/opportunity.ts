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

interface NormalizedOpportunityInput {
  company: string;
  role: string;
  url: string;
  source: string;
  jobDescription: string;
  deadline: string;
  contact: string;
  method: string;
  notes: string;
  salary: string;
  location: string;
  remote: string;
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
    ...(normalized.salary ? { salary: normalized.salary } : {}),
    ...(normalized.location ? { location: normalized.location } : {}),
    ...(normalized.remote ? { remote: normalized.remote } : {}),
    status: "new",
    nextAction: "Score opportunity"
  };
}

export function validateOpportunityInput(input: OpportunityInput): string[] {
  const errors: string[] = [];
  const company = clean(input.company ?? "");
  const role = clean(input.role ?? "");
  const url = clean(input.url ?? "");
  const jobDescription = clean(input.jobDescription ?? input.description ?? "");
  const deadline = clean(input.deadline ?? "");
  const method = clean(input.method ?? "web").toLowerCase();

  if (!company) {
    errors.push("company is required");
  }

  if (!role) {
    errors.push("role title is required");
  }

  if (url && !isValidUrl(url)) {
    errors.push("opportunity URL must be a valid URL");
  }

  if (!jobDescription) {
    errors.push("full job description is required");
  }

  if (deadline && !isIsoDate(deadline)) {
    errors.push("deadline must use YYYY-MM-DD format");
  }

  if (!applicationMethods.includes(method as ApplicationMethod)) {
    errors.push(
      `application method must be one of: ${applicationMethods.join(", ")}`
    );
  }

  return errors;
}

function normalizeOpportunityInput(
  input: OpportunityInput
): NormalizedOpportunityInput {
  return {
    company: clean(input.company ?? ""),
    role: clean(input.role ?? ""),
    url: clean(input.url ?? ""),
    source: clean(input.source ?? "") || "Manual",
    jobDescription: clean(input.jobDescription ?? input.description ?? ""),
    deadline: clean(input.deadline ?? ""),
    contact: clean(input.contact ?? ""),
    method: clean(input.method ?? "web").toLowerCase() || "web",
    notes: clean(input.notes ?? ""),
    salary: clean(input.salary ?? ""),
    location: clean(input.location ?? ""),
    remote: normalizeRemote(input.remote)
  };
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRemote(value: string | boolean | undefined): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return clean(value ?? "");
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
