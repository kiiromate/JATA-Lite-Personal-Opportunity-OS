import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { appendActionLog, readActionLog } from "../core/actionLog.js";
import { createApplicationKit } from "../core/applicationKit.js";
import { enrichOpportunityWithScore } from "../core/bulkScoring.js";
import {
  importBulkOpportunities,
  parseBulkOpportunityContent,
  type BulkImportFormat,
  type BulkOpportunityRow
} from "../core/bulkImport.js";
import { loadPackView, savePackReviewNotes } from "../core/packReader.js";
import {
  findResumeVersion,
  listResumeVersions,
  registerResumeVersion
} from "../core/resumeLibrary.js";
import {
  loadOperatorSettings,
  saveOperatorSettings
} from "../core/settings.js";
import {
  scheduleFollowUp,
  updateNextAction,
  updatePipelineStatus
} from "../core/pipeline.js";
import { generateApplicationPack } from "../generators/applicationPack.js";
import { generateBatchApplicationPacks } from "../generators/batchGenerator.js";
import { opportunitiesToCsv } from "../generators/csvExporter.js";
import { generateDailyBrief } from "../generators/dailyBrief.js";
import { MockProvider } from "../generators/aiProvider.js";
import { selectShortlist } from "../generators/shortlist.js";
import {
  loadOpportunities,
  loadProfile,
  saveOpportunities
} from "../storage/jsonStore.js";
import { getProjectPaths } from "../storage/paths.js";
import {
  pipelineStatuses,
  type ActionLogEntry,
  type Opportunity,
  type PipelineStatus,
  type PriorityBand,
  type RegisterResumeInput
} from "../types/index.js";

export interface ApiRequest {
  method: string;
  path: string;
  body?: unknown;
  root?: string;
  now?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
  headers?: Record<string, string>;
}

export async function handleApiRequest(
  request: ApiRequest
): Promise<ApiResponse> {
  try {
    return await routeApiRequest(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = isNotFound(message) ? 404 : 400;

    return json(status, {
      error: message
    });
  }
}

async function routeApiRequest(request: ApiRequest): Promise<ApiResponse> {
  const method = request.method.toUpperCase();
  const url = new URL(request.path, "http://localhost");
  const path = url.pathname;
  const root = request.root;
  const now = request.now ?? new Date().toISOString();

  if (method === "GET" && path === "/api/health") {
    const settings = await loadOperatorSettings(root, request.env);

    return json(200, {
      ok: true,
      mode: settings.mode,
      aiProviderMode: settings.aiProviderMode,
      storage: "local-json"
    });
  }

  if (method === "GET" && path === "/api/settings") {
    return json(200, await loadOperatorSettings(root, request.env));
  }

  if (method === "POST" && path === "/api/settings") {
    const settings = await saveOperatorSettings(
      root,
      assertRecord(request.body),
      request.env
    );
    await log(root, "settings.update", { fields: Object.keys(assertRecord(request.body)) }, now);

    return json(200, settings);
  }

  if (method === "GET" && path === "/api/action-log") {
    return json(200, {
      entries: await readActionLog(root)
    });
  }

  if (method === "GET" && path === "/api/opportunities") {
    const opportunities = await loadOpportunities(root);

    return json(200, opportunityListView(opportunities, today(now)));
  }

  const opportunityMatch = path.match(/^\/api\/opportunities\/([^/]+)$/);
  if (method === "GET" && opportunityMatch) {
    const opportunity = await findOpportunity(root, opportunityMatch[1]);

    return json(200, { opportunity });
  }

  const scoreMatch = path.match(/^\/api\/opportunities\/([^/]+)\/score$/);
  if (method === "POST" && scoreMatch) {
    const opportunity = await scoreOne(root, scoreMatch[1], now);
    await log(root, "score.single", { score: opportunity.score }, now, opportunity.id);

    return json(200, { opportunity });
  }

  if (method === "POST" && path === "/api/score/bulk") {
    const body = assertRecord(request.body);
    const result = await scoreBulk(root, stringArray(body.ids), now);
    await log(root, "score.bulk", { scored: result.scored }, now);

    return json(200, result);
  }

  if (method === "POST" && path === "/api/import/preview") {
    const result = await importFromBody(root, request.body, false, now);
    await log(root, "import.preview", { summary: result.summary }, now);

    return json(200, result);
  }

  if (method === "POST" && path === "/api/import/commit") {
    const result = await importFromBody(root, request.body, true, now);
    await log(root, "import.commit", { summary: result.summary }, now);

    return json(200, result);
  }

  if (method === "POST" && path === "/api/ingest/opportunity") {
    const result = await ingestOpportunity(root, request.body, now);
    await log(root, "ingest.opportunity", { summary: result.summary }, now);

    return json(result.summary.invalid > 0 ? 400 : 200, result);
  }

  if (method === "POST" && path === "/api/shortlist") {
    const body = assertRecord(request.body ?? {});
    const result = await shortlist(root, body, now);
    await log(root, "shortlist", { count: result.shortlist.length }, now);

    return json(200, result);
  }

  const generateMatch = path.match(/^\/api\/generate\/([^/]+)$/);
  if (method === "POST" && generateMatch) {
    const opportunity = await generateOne(root, generateMatch[1], now);
    await log(root, "generate.single", { packPath: opportunity.packPath }, now, opportunity.id);

    return json(200, { opportunity });
  }

  if (method === "POST" && path === "/api/generate-batch") {
    const body = assertRecord(request.body ?? {});
    const result = await generateBatch(root, body, now);
    await log(root, "generate.batch", { generated: result.generated.length }, now);

    return json(200, result);
  }

  if (method === "POST" && path === "/api/pipeline/status") {
    const body = assertRecord(request.body);
    const id = requiredString(body.id, "id");
    const status = pipelineStatus(requiredString(body.status, "status"));
    const opportunities = updatePipelineStatus(
      await loadOpportunities(root),
      id,
      status,
      { now }
    );

    await saveOpportunities(opportunities, root);
    await log(root, "pipeline.status", { status }, now, id);

    return json(200, { opportunity: getById(opportunities, id) });
  }

  if (method === "POST" && path === "/api/pipeline/next") {
    const body = assertRecord(request.body);
    const id = requiredString(body.id, "id");
    const nextAction = requiredString(body.nextAction, "nextAction");
    const opportunities = updateNextAction(
      await loadOpportunities(root),
      id,
      nextAction,
      { now }
    );

    await saveOpportunities(opportunities, root);
    await log(root, "pipeline.next", { nextAction }, now, id);

    return json(200, { opportunity: getById(opportunities, id) });
  }

  if (method === "POST" && path === "/api/pipeline/followup") {
    const body = assertRecord(request.body);
    const id = requiredString(body.id, "id");
    const followUpDate = requiredString(body.followUpDate, "followUpDate");
    const opportunities = scheduleFollowUp(
      await loadOpportunities(root),
      id,
      followUpDate,
      { now }
    );

    await saveOpportunities(opportunities, root);
    await log(root, "pipeline.followup", { followUpDate }, now, id);

    return json(200, { opportunity: getById(opportunities, id) });
  }

  const packMatch = path.match(/^\/api\/packs\/([^/]+)$/);
  if (method === "GET" && packMatch) {
    const opportunity = await findOpportunity(root, packMatch[1]);

    return json(200, await loadPackView(root, opportunity));
  }

  const reviewNotesMatch = path.match(/^\/api\/packs\/([^/]+)\/review-notes$/);
  if (method === "POST" && reviewNotesMatch) {
    const reviewNotes = await savePackReviewNotes(
      root,
      reviewNotesMatch[1],
      assertRecord(request.body),
      now
    );
    await log(root, "pack.review_notes", { claimReviews: reviewNotes.claimReviews.length }, now, reviewNotes.opportunityId);

    return json(200, { reviewNotes });
  }

  const kitMatch = path.match(/^\/api\/application-kit\/([^/]+)$/);
  if (method === "POST" && kitMatch) {
    const body = assertRecord(request.body ?? {});
    const opportunity = await findOpportunity(root, kitMatch[1]);
    const profile = await loadProfile(root);
    const resume = await findResumeVersion(
      root,
      optionalString(body.resumeVersionId)
    );
    const result = await createApplicationKit({
      root,
      opportunity,
      profile,
      resume,
      applicationNotes: optionalString(body.applicationNotes),
      date: today(now)
    });

    await log(root, "application_kit.export", { directory: result.directory }, now, opportunity.id);

    return json(200, result);
  }

  if (method === "GET" && path === "/api/resumes") {
    return json(200, { resumes: await listResumeVersions(root) });
  }

  if (method === "POST" && path === "/api/resumes") {
    const resume = await registerResumeVersion(
      assertRecord(request.body) as unknown as RegisterResumeInput,
      { root, now }
    );
    await log(root, "resume.register", { title: resume.title }, now);

    return json(200, { resume });
  }

  if (method === "GET" && path === "/api/daily-brief") {
    const opportunities = await loadOpportunities(root);
    const markdown = generateDailyBrief(opportunities, today(now));
    await log(root, "daily_brief.view", { opportunities: opportunities.length }, now);

    return json(200, { markdown });
  }

  if (method === "POST" && path === "/api/export") {
    const paths = getProjectPaths(root);
    const opportunities = await loadOpportunities(root);
    const csv = opportunitiesToCsv(opportunities);
    const filePath = join(paths.outputsDir, "opportunity-tracker.csv");

    await mkdir(paths.outputsDir, { recursive: true });
    await writeFile(filePath, `${csv}\n`, "utf8");
    await log(root, "tracker.export", { filePath }, now);

    return json(200, { csv, filePath });
  }

  return json(404, { error: `Route not found: ${method} ${path}` });
}

async function importFromBody(
  root: string | undefined,
  body: unknown,
  commit: boolean,
  now: string
) {
  const parsed = assertRecord(body);
  const rows = rowsFromImportBody(parsed);
  const existing = await loadOpportunities(root);
  const result = importBulkOpportunities(rows, existing, {
    update: parsed.update === true,
    now
  });

  if (commit) {
    await saveOpportunities(result.opportunities, root);
  }

  return result;
}

async function ingestOpportunity(
  root: string | undefined,
  body: unknown,
  now: string
) {
  const existing = await loadOpportunities(root);
  const row = {
    ...assertRecord(body),
    rowNumber: 1
  };
  const result = importBulkOpportunities([row], existing, { now });

  if (result.summary.invalid === 0) {
    await saveOpportunities(result.opportunities, root);
  }

  return result;
}

async function scoreOne(
  root: string | undefined,
  id: string,
  now: string
): Promise<Opportunity> {
  const profile = await loadProfile(root);
  const opportunities = await loadOpportunities(root);
  const updated = opportunities.map((opportunity) =>
    opportunity.id === id
      ? enrichOpportunityWithScore(opportunity, profile, now)
      : opportunity
  );
  const opportunity = getById(updated, id);

  await saveOpportunities(updated, root);

  return opportunity;
}

async function scoreBulk(
  root: string | undefined,
  ids: string[] | undefined,
  now: string
) {
  const profile = await loadProfile(root);
  const opportunities = await loadOpportunities(root);
  const idSet = ids ? new Set(ids) : undefined;
  let scored = 0;
  const updated = opportunities.map((opportunity) => {
    if (idSet && !idSet.has(opportunity.id)) {
      return opportunity;
    }

    if (!idSet && ["applied", "interview", "closed", "rejected", "ignored"].includes(opportunity.status)) {
      return opportunity;
    }

    scored += 1;
    return enrichOpportunityWithScore(opportunity, profile, now);
  });

  await saveOpportunities(updated, root);

  return {
    scored,
    opportunities: updated,
    summary: opportunityListView(updated, today(now)).summary
  };
}

async function shortlist(
  root: string | undefined,
  body: Record<string, unknown>,
  now: string
) {
  const profile = await loadProfile(root);
  const opportunities = await loadOpportunities(root);
  const scored = opportunities.map((opportunity) =>
    opportunity.score && opportunity.priorityBand
      ? opportunity
      : enrichOpportunityWithScore(opportunity, profile, now)
  );
  await saveOpportunities(scored, root);

  const shortlistItems = selectShortlist(scored, {
    top: numberValue(body.top),
    band: priorityBandValue(body.band)
  });
  const groups = groupByBand(shortlistItems);
  const notWorthTouchingToday = scored.filter(
    (opportunity) =>
      opportunity.priorityBand === "D" ||
      opportunity.status === "ignored" ||
      opportunity.score?.decision === "Ignore" ||
      opportunity.applicationRiskLevel === "high"
  );

  return {
    shortlist: shortlistItems.filter(
      (opportunity) => !notWorthTouchingToday.some((item) => item.id === opportunity.id)
    ),
    groups,
    notWorthTouchingToday
  };
}

async function generateOne(
  root: string | undefined,
  id: string,
  now: string
): Promise<Opportunity> {
  const paths = getProjectPaths(root);
  const profile = await loadProfile(root);
  const opportunities = await loadOpportunities(root);
  const index = opportunities.findIndex((opportunity) => opportunity.id === id);

  if (index === -1) {
    throw new Error(`Opportunity not found: ${id}`);
  }

  const result = await generateApplicationPack({
    opportunity: opportunities[index],
    profile,
    outputRoot: paths.outputsDir,
    aiProvider: new MockProvider(),
    useAI: false
  });

  opportunities[index] = {
    ...opportunities[index],
    status: "review_ready",
    generatedPackDir: result.directory,
    packPath: result.directory,
    lastGeneratedAt: now,
    lastUpdated: now,
    nextAction: "Human review application pack"
  };

  await saveOpportunities(opportunities, root);

  return opportunities[index];
}

async function generateBatch(
  root: string | undefined,
  body: Record<string, unknown>,
  now: string
) {
  const paths = getProjectPaths(root);
  const profile = await loadProfile(root);
  const opportunities = await loadOpportunities(root);
  const result = await generateBatchApplicationPacks({
    opportunities,
    profile,
    outputRoot: paths.outputsDir,
    ids: stringArray(body.ids),
    top: numberValue(body.top),
    band: priorityBandValue(body.band),
    now,
    date: today(now),
    aiProvider: new MockProvider()
  });

  await saveOpportunities(result.updatedOpportunities, root);

  return result;
}

async function findOpportunity(
  root: string | undefined,
  id: string
): Promise<Opportunity> {
  return getById(await loadOpportunities(root), id);
}

function rowsFromImportBody(body: Record<string, unknown>): BulkOpportunityRow[] {
  const format = requiredString(body.format, "format") as BulkImportFormat;

  if (!["csv", "json"].includes(format)) {
    throw new Error("format must be csv or json.");
  }

  return parseBulkOpportunityContent(requiredString(body.content, "content"), format);
}

function opportunityListView(opportunities: Opportunity[], date: string) {
  return {
    opportunities,
    summary: {
      total: opportunities.length,
      priorityBands: {
        A: countBand(opportunities, "A"),
        B: countBand(opportunities, "B"),
        C: countBand(opportunities, "C"),
        D: countBand(opportunities, "D")
      },
      urgentDeadlines: opportunities.filter((opportunity) =>
        isUrgentDeadline(opportunity.deadline, date)
      ).length,
      reviewReadyPacks: opportunities.filter(
        (opportunity) =>
          opportunity.status === "review_ready" ||
          opportunity.status === "pack_generated" ||
          Boolean(opportunity.packPath ?? opportunity.generatedPackDir)
      ).length,
      followUpsDue: opportunities.filter((opportunity) =>
        isFollowUpDue(opportunity, date)
      ).length
    },
    recommendedActions: opportunities
      .filter((opportunity) => !["closed", "rejected", "ignored"].includes(opportunity.status))
      .slice(0, 5)
      .map(
        (opportunity) =>
          `${opportunity.company} - ${opportunity.role}: ${
            opportunity.nextAction ??
            opportunity.recommendedAction ??
            "Decide next step"
          }`
      )
  };
}

function groupByBand(opportunities: Opportunity[]): Record<PriorityBand, Opportunity[]> {
  return {
    A: opportunities.filter((opportunity) => opportunity.priorityBand === "A"),
    B: opportunities.filter((opportunity) => opportunity.priorityBand === "B"),
    C: opportunities.filter((opportunity) => opportunity.priorityBand === "C"),
    D: opportunities.filter((opportunity) => opportunity.priorityBand === "D")
  };
}

function countBand(opportunities: Opportunity[], band: PriorityBand): number {
  return opportunities.filter((opportunity) => opportunity.priorityBand === band).length;
}

function getById(opportunities: Opportunity[], id: string): Opportunity {
  const opportunity = opportunities.find((item) => item.id === id);

  if (!opportunity) {
    throw new Error(`Opportunity not found: ${id}`);
  }

  return opportunity;
}

function pipelineStatus(value: string): PipelineStatus {
  if (!pipelineStatuses.includes(value as PipelineStatus)) {
    throw new Error(`Status must be one of: ${pipelineStatuses.join(", ")}`);
  }

  return value as PipelineStatus;
}

function isUrgentDeadline(deadline: string, date: string): boolean {
  if (!deadline) {
    return false;
  }

  const days = daysUntil(deadline, date);

  return days >= 0 && days <= 7;
}

function isFollowUpDue(opportunity: Opportunity, date: string): boolean {
  if (opportunity.followUpDate) {
    return opportunity.followUpDate <= date;
  }

  return opportunity.status === "follow_up_due" || opportunity.status === "follow_up";
}

function daysUntil(deadline: string, date: string): number {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  const end = Date.parse(`${deadline}T00:00:00.000Z`);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return 999;
  }

  return Math.floor((end - start) / 86_400_000);
}

function today(now: string): string {
  return now.slice(0, 10);
}

async function log(
  root: string | undefined,
  action: ActionLogEntry["action"],
  details: Record<string, unknown>,
  now: string,
  opportunityId?: string
): Promise<void> {
  await appendActionLog(root, { action, opportunityId, details }, now);
}

function json(status: number, body: unknown): ApiResponse {
  return {
    status,
    body,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  };
}

function assertRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("JSON object body is required.");
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required.`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberValue(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer.");
  }

  return parsed;
}

function priorityBandValue(value: unknown): PriorityBand | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const band = value.trim().toUpperCase();

  if (!["A", "B", "C", "D"].includes(band)) {
    throw new Error("priority band must be A, B, C, or D.");
  }

  return band as PriorityBand;
}

function isNotFound(message: string): boolean {
  return message.toLowerCase().includes("not found");
}
