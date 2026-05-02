export type PriorityBand = "A" | "B" | "C" | "D";
export type PipelineStatus =
  | "new"
  | "scored"
  | "shortlisted"
  | "pack_generated"
  | "review_ready"
  | "applied"
  | "follow_up_due"
  | "interview"
  | "rejected"
  | "closed"
  | "ignored";

export interface Opportunity {
  id: string;
  company: string;
  role: string;
  source: string;
  url: string;
  deadline: string;
  method: string;
  status: string;
  notes: string;
  jobDescription: string;
  remote?: string;
  priorityBand?: PriorityBand;
  applicationRiskLevel?: "low" | "medium" | "high";
  effortEstimate?: "low" | "medium" | "high";
  recommendedAction?: string;
  nextAction?: string;
  followUpDate?: string;
  packPath?: string;
  generatedPackDir?: string;
  score?: {
    strategicFitScore: number;
    decision: string;
    rationale: string;
  };
}

export interface OpportunitySummary {
  total: number;
  priorityBands: Record<PriorityBand, number>;
  urgentDeadlines: number;
  reviewReadyPacks: number;
  followUpsDue: number;
}

export interface OpportunityListResponse {
  opportunities: Opportunity[];
  summary: OpportunitySummary;
  recommendedActions: string[];
}

export interface ImportResult {
  opportunities: Opportunity[];
  summary: {
    imported: number;
    updated: number;
    skipped: number;
    duplicates: number;
    invalid: number;
  };
  errors: Array<{ rowNumber: number; reason: string }>;
}

export interface PackTab {
  key: string;
  label: string;
  fileName: string;
  content: string;
}

export interface PackView {
  opportunity: Opportunity;
  directory: string;
  tabs: PackTab[];
  reviewNotes?: {
    notes: string;
    claimReviews: Array<{
      claim: string;
      decision: "keep" | "edit" | "remove" | "evidence-needed";
      note?: string;
    }>;
  };
}

export interface ResumeVersion {
  id: string;
  title: string;
  targetLane: string;
  industries: string[];
  seniority: string;
  language: string;
  filePath: string;
  notes: string;
  isPreferred?: boolean;
}

export interface OperatorSettings {
  mode: "local";
  aiProviderMode: "mock" | "openrouter" | "gemini";
  featureFlags: Record<string, boolean>;
  costSafety: {
    maxRequestsPerBatch: number;
    maxOpportunitiesPerRun: number;
  };
  connectors: Record<
    string,
    {
      name: string;
      enabled: boolean;
      configured: boolean;
      privacyWarning: string;
      setupHint: string;
    }
  >;
  localConfigPlaceholders: Record<string, string>;
}

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  action: string;
  opportunityId?: string;
  details: Record<string, unknown>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

export async function apiPost<T>(path: string, body: unknown = {}): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(
      isErrorPayload(payload) ? payload.error : `API request failed: ${response.status}`
    );
  }

  return payload as T;
}

function isErrorPayload(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}
