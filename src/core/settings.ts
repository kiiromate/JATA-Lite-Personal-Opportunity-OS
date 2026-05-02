import { aiProviderModes } from "../types/index.js";
import { readJsonFile, writeJsonFile } from "../storage/jsonStore.js";
import { getProjectPaths } from "../storage/paths.js";
import type {
  AIProviderMode,
  ConnectorReadiness,
  FeatureFlags,
  OperatorSettings
} from "../types/index.js";

const defaultFeatureFlags: FeatureFlags = {
  n8nBridge: false,
  googleDrive: false,
  googleSheets: false,
  externalAI: false,
  browserAssistant: false
};

const privacyWarnings = {
  n8n: "Only enable for local webhook intake you control. Review imported data before application work.",
  googleDrive:
    "Future sync may send generated packs to Google Drive. Keep disabled until credentials and folders are reviewed.",
  googleSheets:
    "Future sync may send tracker rows to Google Sheets. Keep disabled until columns and account access are reviewed.",
  externalAI:
    "External AI can send prompt context to a provider. Keep mock mode unless Kaze explicitly approves cost and privacy settings.",
  browserAssistant:
    "Browser assistance can interact with third-party forms. v0.4 never submits forms automatically."
} as const;

export async function loadOperatorSettings(
  root?: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<OperatorSettings> {
  const defaults = defaultOperatorSettings(env);
  const saved = await readJsonFile<Partial<OperatorSettings>>(
    getProjectPaths(root).operatorSettingsFile,
    {}
  );

  return normalizeSettings(saved, defaults);
}

export async function saveOperatorSettings(
  root: string | undefined,
  settings: Partial<OperatorSettings>,
  env: NodeJS.ProcessEnv = process.env
): Promise<OperatorSettings> {
  const normalized = normalizeSettings(settings, defaultOperatorSettings(env));

  await writeJsonFile(getProjectPaths(root).operatorSettingsFile, normalized);

  return normalized;
}

export function defaultOperatorSettings(
  env: NodeJS.ProcessEnv = process.env
): OperatorSettings {
  const featureFlags = { ...defaultFeatureFlags };
  const aiProviderMode = providerModeFromEnv(env);

  return {
    mode: "local",
    aiProviderMode,
    featureFlags,
    costSafety: {
      maxRequestsPerBatch: numberFromEnv(env.JATA_MAX_REQUESTS_PER_BATCH, 5),
      maxOpportunitiesPerRun: numberFromEnv(env.JATA_MAX_OPPORTUNITIES_PER_RUN, 20)
    },
    connectors: {
      n8n: connectorReadiness({
        name: "n8n",
        enabled: featureFlags.n8nBridge,
        configured: Boolean(env.JATA_N8N_WEBHOOK_SECRET)
      }),
      googleDrive: connectorReadiness({
        name: "googleDrive",
        enabled: featureFlags.googleDrive,
        configured: Boolean(env.GOOGLE_DRIVE_CLIENT_ID && env.GOOGLE_DRIVE_CLIENT_SECRET)
      }),
      googleSheets: connectorReadiness({
        name: "googleSheets",
        enabled: featureFlags.googleSheets,
        configured: Boolean(env.GOOGLE_SHEETS_CLIENT_ID && env.GOOGLE_SHEETS_CLIENT_SECRET)
      }),
      externalAI: connectorReadiness({
        name: "externalAI",
        enabled: featureFlags.externalAI,
        configured: Boolean(env.OPENROUTER_API_KEY || env.GEMINI_API_KEY)
      }),
      browserAssistant: connectorReadiness({
        name: "browserAssistant",
        enabled: featureFlags.browserAssistant,
        configured: false
      })
    },
    localConfigPlaceholders: {
      n8nWebhookApproval: "Set a local webhook approval value only when enabling n8n intake.",
      googleDriveOAuthClient: "Set local Google Drive OAuth values only after approving Drive sync.",
      googleSheetsOAuthClient: "Set local Google Sheets OAuth values only after approving Sheets sync.",
      openRouterCredential: "Set a local OpenRouter credential only when external AI is approved.",
      geminiCredential: "Set a local Gemini credential only when external AI is approved."
    }
  };
}

function normalizeSettings(
  input: Partial<OperatorSettings>,
  defaults: OperatorSettings
): OperatorSettings {
  const featureFlags = {
    ...defaults.featureFlags,
    ...(isRecord(input.featureFlags) ? input.featureFlags : {})
  };
  const aiProviderMode = normalizeProviderMode(
    typeof input.aiProviderMode === "string"
      ? input.aiProviderMode
      : defaults.aiProviderMode
  );
  const costSafety = {
    ...defaults.costSafety,
    ...(isRecord(input.costSafety) ? input.costSafety : {})
  };

  assertPositiveInteger(costSafety.maxRequestsPerBatch, "maxRequestsPerBatch");
  assertPositiveInteger(costSafety.maxOpportunitiesPerRun, "maxOpportunitiesPerRun");

  return {
    mode: "local",
    aiProviderMode,
    featureFlags,
    costSafety,
    connectors: {
      n8n: { ...defaults.connectors.n8n, enabled: featureFlags.n8nBridge },
      googleDrive: {
        ...defaults.connectors.googleDrive,
        enabled: featureFlags.googleDrive
      },
      googleSheets: {
        ...defaults.connectors.googleSheets,
        enabled: featureFlags.googleSheets
      },
      externalAI: {
        ...defaults.connectors.externalAI,
        enabled: featureFlags.externalAI
      },
      browserAssistant: {
        ...defaults.connectors.browserAssistant,
        enabled: featureFlags.browserAssistant
      }
    },
    localConfigPlaceholders: {
      ...defaults.localConfigPlaceholders,
      ...(isRecord(input.localConfigPlaceholders)
        ? stringRecord(input.localConfigPlaceholders)
        : {})
    }
  };
}

function connectorReadiness(input: {
  name: keyof typeof privacyWarnings;
  enabled: boolean;
  configured: boolean;
}): ConnectorReadiness {
  return {
    name: input.name,
    enabled: input.enabled,
    configured: input.configured,
    privacyWarning: privacyWarnings[input.name],
    setupHint: input.configured
      ? "Credentials detected through environment variables."
      : "Not configured. Add environment variables later if Kaze explicitly enables this connector."
  };
}

function providerModeFromEnv(env: NodeJS.ProcessEnv): AIProviderMode {
  const configured = env.JATA_AI_PROVIDER?.trim().toLowerCase();

  return normalizeProviderMode(configured || "mock");
}

function normalizeProviderMode(value: string): AIProviderMode {
  if (!aiProviderModes.includes(value as AIProviderMode)) {
    throw new Error(`AI provider mode must be one of: ${aiProviderModes.join(", ")}`);
  }

  return value as AIProviderMode;
}

function numberFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function assertPositiveInteger(value: unknown, field: string): void {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${field} must be a positive integer.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)])
  );
}
