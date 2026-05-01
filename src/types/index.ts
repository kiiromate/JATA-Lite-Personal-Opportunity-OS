export const applicationMethods = [
  "email",
  "web",
  "referral",
  "recruiter",
  "other"
] as const;

export type ApplicationMethod = (typeof applicationMethods)[number];

export type OpportunityStatus =
  | "captured"
  | "scored"
  | "needs_regeneration"
  | "review_ready"
  | "applied"
  | "follow_up"
  | "closed";

export type EffortLevel = "low" | "medium" | "high";

export type Decision = "Pursue" | "Maybe" | "Ignore";

export interface OpportunityInput {
  company: string;
  role: string;
  url: string;
  source: string;
  jobDescription: string;
  deadline: string;
  contact: string;
  method: string;
  notes: string;
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
  status: OpportunityStatus;
  score?: OpportunityScore;
  nextAction?: string;
  generatedPackDir?: string;
  lastGeneratedAt?: string;
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
