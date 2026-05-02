export const applicationMethods = [
  "email",
  "web",
  "referral",
  "recruiter",
  "other"
] as const;

export type ApplicationMethod = (typeof applicationMethods)[number];

export const pipelineStatuses = [
  "new",
  "scored",
  "shortlisted",
  "pack_generated",
  "review_ready",
  "applied",
  "follow_up_due",
  "interview",
  "rejected",
  "closed",
  "ignored"
] as const;

export type PipelineStatus = (typeof pipelineStatuses)[number];

export type OpportunityStatus =
  | PipelineStatus
  | "captured"
  | "scored"
  | "needs_regeneration"
  | "follow_up";

export type EffortLevel = "low" | "medium" | "high";

export type Decision = "Pursue" | "Maybe" | "Ignore";

export type PriorityBand = "A" | "B" | "C" | "D";

export type ApplicationRiskLevel = "low" | "medium" | "high";

export interface OpportunityInput {
  company: string;
  role: string;
  url?: string;
  source?: string;
  jobDescription?: string;
  description?: string;
  deadline?: string;
  contact?: string;
  method?: string;
  notes?: string;
  salary?: string;
  location?: string;
  remote?: string | boolean;
}

export interface Opportunity {
  id: string;
  createdAt: string;
  lastUpdated: string;
  company: string;
  role: string;
  url: string;
  source: string;
  jobDescription: string;
  jobDescriptionOriginal?: string;
  jobDescriptionCleaning?: JobDescriptionCleaningMetadata;
  deadline: string;
  contact: string;
  method: ApplicationMethod;
  notes: string;
  salary?: string;
  location?: string;
  remote?: string;
  status: OpportunityStatus;
  score?: OpportunityScore;
  priorityBand?: PriorityBand;
  effortEstimate?: EffortLevel;
  applicationRiskLevel?: ApplicationRiskLevel;
  recommendedAction?: string;
  nextAction?: string;
  generatedPackDir?: string;
  packPath?: string;
  lastGeneratedAt?: string;
  appliedAt?: string;
  followUpDate?: string;
}

export interface JobDescriptionCleaningMetadata {
  cleanedAt: string;
  originalLength: number;
  cleanedLength: number;
  summary: string[];
  previousScore?: OpportunityScore;
}

export interface OpportunityScore {
  strategicFitScore: number;
  sectorFit: number;
  roleFit: number;
  compensationPotential: number;
  remoteGlobalFit: number;
  networkValue: number;
  effortLevel: EffortLevel;
  decision: Decision;
  rationale: string;
}

export interface Profile {
  name: string;
  positioning: string;
  strengths: string[];
  targetLanes: string[];
  constraints: string[];
  languages: string[];
}

export interface ApplicationPackResult {
  directory: string;
  files: string[];
}
