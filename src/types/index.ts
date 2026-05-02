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

export const aiProviderModes = ["mock", "openrouter", "gemini"] as const;

export type AIProviderMode = (typeof aiProviderModes)[number];

export const claimReviewDecisions = [
  "keep",
  "edit",
  "remove",
  "evidence-needed"
] as const;

export type ClaimReviewDecision = (typeof claimReviewDecisions)[number];

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
  applicationKitDir?: string;
  lastKitBuiltAt?: string;
  appliedAt?: string;
  followUpDate?: string;
  preferredResumeVersionId?: string;
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

export interface CostSafetySettings {
  maxRequestsPerBatch: number;
  maxOpportunitiesPerRun: number;
}

export interface FeatureFlags {
  n8nBridge: boolean;
  googleDrive: boolean;
  googleSheets: boolean;
  externalAI: boolean;
  browserAssistant: boolean;
}

export interface ConnectorReadiness {
  name: string;
  enabled: boolean;
  configured: boolean;
  privacyWarning: string;
  setupHint: string;
}

export interface OperatorSettings {
  mode: "local";
  aiProviderMode: AIProviderMode;
  featureFlags: FeatureFlags;
  costSafety: CostSafetySettings;
  connectors: {
    n8n: ConnectorReadiness;
    googleDrive: ConnectorReadiness;
    googleSheets: ConnectorReadiness;
    externalAI: ConnectorReadiness;
    browserAssistant: ConnectorReadiness;
  };
  localConfigPlaceholders: Record<string, string>;
}

export interface ActionLogEntry {
  id: string;
  timestamp: string;
  action:
    | "import.preview"
    | "import.commit"
    | "ingest.opportunity"
    | "score.single"
    | "score.bulk"
    | "shortlist"
    | "generate.single"
    | "generate.batch"
    | "pipeline.status"
    | "pipeline.next"
    | "pipeline.followup"
    | "pack.review_notes"
    | "application_kit.export"
    | "daily_brief.view"
    | "tracker.export"
    | "resume.register"
    | "settings.update";
  opportunityId?: string;
  details: Record<string, unknown>;
}

export interface ClaimReview {
  claim: string;
  decision: ClaimReviewDecision;
  note?: string;
}

export interface PackReviewNotes {
  opportunityId: string;
  updatedAt: string;
  notes: string;
  claimReviews: ClaimReview[];
}

export interface ResumeVersion {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  targetLane: string;
  industries: string[];
  seniority: string;
  language: string;
  filePath: string;
  notes: string;
  isPreferred?: boolean;
}

export interface RegisterResumeInput {
  title: string;
  targetLane: string;
  industries?: string[];
  seniority: string;
  language: string;
  filePath: string;
  notes?: string;
  isPreferred?: boolean;
}

export interface ApplicationKitResult {
  directory: string;
  files: string[];
  copyFields: Record<string, string>;
  selectedResume?: ResumeVersion;
  claimsToVerify: string[];
  finalChecklist: string[];
}
