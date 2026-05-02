import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { importBulkOpportunityFile } from "../core/bulkImport.js";
import { enrichOpportunityWithScore } from "../core/bulkScoring.js";
import { cleanOpportunityJobDescription } from "../core/jobDescriptionCleaner.js";
import { createOpportunity } from "../core/opportunity.js";
import {
  ignoreOpportunity,
  markApplied,
  scheduleFollowUp,
  updateNextAction,
  updatePipelineStatus
} from "../core/pipeline.js";
import { MockProvider } from "../generators/aiProvider.js";
import { generateApplicationPack } from "../generators/applicationPack.js";
import { generateBatchApplicationPacks } from "../generators/batchGenerator.js";
import { opportunitiesToCsv } from "../generators/csvExporter.js";
import { generateDailyBrief } from "../generators/dailyBrief.js";
import {
  generateShortlistCsv,
  generateShortlistMarkdown,
  selectShortlist
} from "../generators/shortlist.js";
import {
  loadOpportunities,
  loadProfile,
  saveOpportunities
} from "../storage/jsonStore.js";
import { getProjectPaths } from "../storage/paths.js";
import {
  pipelineStatuses,
  type ApplicationRiskLevel,
  type Opportunity,
  type OpportunityInput,
  type PipelineStatus,
  type PriorityBand,
  type Profile
} from "../types/index.js";

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "add":
      await addOpportunity();
      break;
    case "import":
      await importOpportunities(args);
      break;
    case "score":
      await scoreOpportunities(args);
      break;
    case "clean-jd":
      await cleanJobDescriptionForOpportunity(args[0]);
      break;
    case "generate":
      await generatePack(args[0]);
      break;
    case "generate-batch":
      await generateBatch(args);
      break;
    case "shortlist":
      await writeShortlist(args);
      break;
    case "status":
      await setStatus(args[0], args[1]);
      break;
    case "next":
      await setNextAction(args[0], args.slice(1).join(" "));
      break;
    case "applied":
      await markOpportunityApplied(args[0]);
      break;
    case "followup":
      await setFollowUp(args[0], args[1]);
      break;
    case "ignore":
      await ignore(args[0]);
      break;
    case "brief":
      await writeDailyBrief();
      break;
    case "export":
      await exportTracker();
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

async function importOpportunities(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const filePath = parsed.positionals[0];

  if (!filePath) {
    throw new Error("Usage: pnpm start import <filePath> [--update]");
  }

  const opportunities = await loadOpportunities();
  const result = await importBulkOpportunityFile(filePath, opportunities, {
    update: booleanFlag(parsed, "update")
  });

  await saveOpportunities(result.opportunities);
  output.write(
    [
      `Imported: ${result.summary.imported}`,
      `Updated: ${result.summary.updated}`,
      `Skipped: ${result.summary.skipped}`,
      `Duplicates: ${result.summary.duplicates}`,
      `Invalid: ${result.summary.invalid}`
    ].join("\n")
  );
  output.write("\n");

  for (const error of result.errors) {
    output.write(`Row ${error.rowNumber}: ${error.reason}\n`);
  }
}

async function addOpportunity(): Promise<void> {
  const inputFromEnv = parseOpportunityInputFromEnv();

  if (inputFromEnv) {
    await saveNewOpportunity(inputFromEnv);
    return;
  }

  const rl = createInterface({ input, output });

  try {
    const company = await rl.question("Company: ");
    const role = await rl.question("Role title: ");
    const url = await rl.question("Opportunity URL: ");
    const source = await rl.question("Source: ");
    output.write(
      "Full job description. Paste text, then enter a single line containing END.\n"
    );
    const jobDescription = await readMultilineUntilEnd(rl);
    const deadline = await rl.question("Deadline (YYYY-MM-DD, blank if none): ");
    const contact = await rl.question("Contact email or person if known: ");
    const method = await rl.question(
      "Application method (email, web, referral, recruiter, other): "
    );
    const notes = await rl.question("Notes: ");

    await saveNewOpportunity({
      company,
      role,
      url,
      source,
      jobDescription,
      deadline,
      contact,
      method,
      notes
    });
  } finally {
    rl.close();
  }
}

async function saveNewOpportunity(inputValue: OpportunityInput): Promise<void> {
  const opportunity = createOpportunity(inputValue);
  const opportunities = await loadOpportunities();
  opportunities.push(opportunity);
  await saveOpportunities(opportunities);

  output.write(`Saved opportunity ${opportunity.id}\n`);
}

async function cleanJobDescriptionForOpportunity(
  opportunityId: string | undefined
): Promise<void> {
  if (!opportunityId) {
    throw new Error("Usage: pnpm start clean-jd <opportunityId>");
  }

  const opportunities = await loadOpportunities();
  const index = opportunities.findIndex(
    (opportunity) => opportunity.id === opportunityId
  );

  if (index === -1) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  const updated = cleanOpportunityJobDescription(opportunities[index]);
  opportunities[index] = updated;
  await saveOpportunities(opportunities);

  output.write(`Cleaned job description for ${opportunityId}\n`);
  output.write(
    `Original length: ${updated.jobDescriptionCleaning?.originalLength ?? 0}\n`
  );
  output.write(
    `Cleaned length: ${updated.jobDescriptionCleaning?.cleanedLength ?? 0}\n`
  );
  output.write("Status: needs_regeneration\n");
}

function parseOpportunityInputFromEnv(): OpportunityInput | null {
  const raw = process.env.JATA_ADD_JSON;

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw) as Partial<OpportunityInput>;

  return {
    company: String(parsed.company ?? ""),
    role: String(parsed.role ?? ""),
    url: String(parsed.url ?? ""),
    source: String(parsed.source ?? ""),
    jobDescription: String(parsed.jobDescription ?? parsed.description ?? ""),
    deadline: String(parsed.deadline ?? ""),
    contact: String(parsed.contact ?? ""),
    method: String(parsed.method ?? ""),
    notes: String(parsed.notes ?? ""),
    salary: String(parsed.salary ?? ""),
    location: String(parsed.location ?? ""),
    remote:
      typeof parsed.remote === "boolean"
        ? parsed.remote
        : String(parsed.remote ?? "")
  };
}

async function readMultilineUntilEnd(
  rl: ReturnType<typeof createInterface>
): Promise<string> {
  const lines: string[] = [];

  while (true) {
    const line = await rl.question("> ");

    if (line.trim() === "END") {
      return lines.join("\n").trim();
    }

    lines.push(line);
  }
}

async function scoreOpportunities(args: string[] = []): Promise<void> {
  const parsed = parseArgs(args);
  const [profile, opportunities] = await Promise.all([
    loadProfile(),
    loadOpportunities()
  ]);
  const now = new Date().toISOString();
  const selectedIds = selectScoreTargets(opportunities, parsed);
  const selectedIdSet = new Set(selectedIds);
  let scoredCount = 0;
  const bandCounts = new Map<PriorityBand, number>();

  const updated = opportunities.map((opportunity) => {
    if (!selectedIdSet.has(opportunity.id)) {
      return opportunity;
    }

    const enriched = enrichOpportunityWithScore(opportunity, profile, now);
    scoredCount += 1;
    bandCounts.set(
      enriched.priorityBand ?? "D",
      (bandCounts.get(enriched.priorityBand ?? "D") ?? 0) + 1
    );

    return enriched;
  });

  await saveOpportunities(updated);
  output.write(`Scored ${scoredCount} opportunity record(s).\n`);
  output.write(`Bands: ${formatBandCounts(bandCounts)}\n`);
}

async function generatePack(opportunityId: string | undefined): Promise<void> {
  if (!opportunityId) {
    throw new Error("Usage: pnpm start generate <opportunityId>");
  }

  const paths = getProjectPaths();
  const [profile, opportunities] = await Promise.all([
    loadProfile(),
    loadOpportunities()
  ]);
  const index = opportunities.findIndex(
    (opportunity) => opportunity.id === opportunityId
  );

  if (index === -1) {
    throw new Error(`Opportunity not found: ${opportunityId}`);
  }

  const result = await generateApplicationPack({
    opportunity: opportunities[index],
    profile,
    outputRoot: paths.outputsDir,
    aiProvider: new MockProvider(),
    useAI: false
  });

  const now = new Date().toISOString();

  opportunities[index] = {
    ...opportunities[index],
    status: "review_ready",
    generatedPackDir: result.directory,
    packPath: result.directory,
    lastGeneratedAt: now,
    lastUpdated: now,
    nextAction: "Human review application pack"
  };

  await saveOpportunities(opportunities);
  output.write(`Generated application pack: ${result.directory}\n`);
}

async function writeShortlist(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const paths = getProjectPaths();
  const [profile, opportunities] = await Promise.all([
    loadProfile(),
    loadOpportunities()
  ]);
  const now = new Date().toISOString();
  const scored = ensureScored(opportunities, profile, now);
  const selected = selectShortlist(scored, {
    top: numberFlag(parsed, "top"),
    band: priorityBandFlag(parsed, "band"),
    maxRisk: riskFlag(parsed, "max-risk")
  });
  const markdown = generateShortlistMarkdown(selected);
  const csv = generateShortlistCsv(selected);
  const markdownPath = join(paths.outputsDir, "shortlist.md");
  const csvPath = join(paths.outputsDir, "shortlist.csv");

  await mkdir(paths.outputsDir, { recursive: true });
  await Promise.all([
    writeFile(markdownPath, markdown, "utf8"),
    writeFile(csvPath, `${csv}\n`, "utf8"),
    saveOpportunities(scored)
  ]);

  output.write(`Wrote shortlist: ${markdownPath}\n`);
  output.write(`Wrote shortlist CSV: ${csvPath}\n`);
}

async function generateBatch(args: string[]): Promise<void> {
  const parsed = parseArgs(args);
  const paths = getProjectPaths();
  const [profile, opportunities] = await Promise.all([
    loadProfile(),
    loadOpportunities()
  ]);
  const result = await generateBatchApplicationPacks({
    opportunities,
    profile,
    outputRoot: paths.outputsDir,
    top: numberFlag(parsed, "top"),
    band: priorityBandFlag(parsed, "band"),
    ids: idsFlag(parsed, "ids")
  });

  await saveOpportunities(result.updatedOpportunities);
  output.write(`Generated ${result.generated.length} application pack(s).\n`);

  for (const pack of result.generated) {
    output.write(`${pack.id}: ${pack.directory}\n`);
  }

  if (result.skipped.length > 0) {
    output.write(
      `Skipped: ${result.skipped.map((opportunity) => opportunity.id).join(", ")}\n`
    );
  }
}

async function setStatus(
  opportunityId: string | undefined,
  status: string | undefined
): Promise<void> {
  if (!opportunityId || !status) {
    throw new Error("Usage: pnpm start status <opportunityId> <status>");
  }

  const opportunities = await loadOpportunities();
  const updated = updatePipelineStatus(
    opportunities,
    opportunityId,
    parsePipelineStatus(status)
  );

  await saveOpportunities(updated);
  output.write(`Updated ${opportunityId} status to ${status}\n`);
  output.write("No application was submitted or sent.\n");
}

async function setNextAction(
  opportunityId: string | undefined,
  nextAction: string
): Promise<void> {
  if (!opportunityId || !nextAction) {
    throw new Error('Usage: pnpm start next <opportunityId> "next action text"');
  }

  const opportunities = await loadOpportunities();
  const updated = updateNextAction(opportunities, opportunityId, nextAction);

  await saveOpportunities(updated);
  output.write(`Updated next action for ${opportunityId}\n`);
}

async function markOpportunityApplied(
  opportunityId: string | undefined
): Promise<void> {
  if (!opportunityId) {
    throw new Error("Usage: pnpm start applied <opportunityId>");
  }

  const opportunities = await loadOpportunities();
  const updated = markApplied(opportunities, opportunityId);

  await saveOpportunities(updated);
  output.write(`Marked ${opportunityId} as manually applied.\n`);
  output.write("JATA Lite did not submit anything.\n");
}

async function setFollowUp(
  opportunityId: string | undefined,
  date: string | undefined
): Promise<void> {
  if (!opportunityId || !date) {
    throw new Error("Usage: pnpm start followup <opportunityId> <YYYY-MM-DD>");
  }

  const opportunities = await loadOpportunities();
  const updated = scheduleFollowUp(opportunities, opportunityId, date);

  await saveOpportunities(updated);
  output.write(`Set manual follow-up for ${opportunityId}: ${date}\n`);
}

async function ignore(opportunityId: string | undefined): Promise<void> {
  if (!opportunityId) {
    throw new Error("Usage: pnpm start ignore <opportunityId>");
  }

  const opportunities = await loadOpportunities();
  const updated = ignoreOpportunity(opportunities, opportunityId);

  await saveOpportunities(updated);
  output.write(`Ignored ${opportunityId}\n`);
}

async function writeDailyBrief(): Promise<void> {
  const paths = getProjectPaths();
  const opportunities = await loadOpportunities();
  const brief = generateDailyBrief(opportunities);
  const filePath = join(paths.outputsDir, "daily-brief.md");

  await mkdir(paths.outputsDir, { recursive: true });
  await writeFile(filePath, brief, "utf8");
  output.write(`Wrote daily brief: ${filePath}\n`);
}

async function exportTracker(): Promise<void> {
  const paths = getProjectPaths();
  const opportunities = await loadOpportunities();
  const csv = opportunitiesToCsv(opportunities);
  const filePath = join(paths.outputsDir, "opportunity-tracker.csv");

  await mkdir(paths.outputsDir, { recursive: true });
  await writeFile(filePath, `${csv}\n`, "utf8");
  output.write(`Exported tracker CSV: ${filePath}\n`);
}

function printHelp(): void {
  output.write(`JATA Lite: Personal Opportunity OS

Commands:
  pnpm start add
  pnpm start import <filePath> [--update]
  pnpm start clean-jd <opportunityId>
  pnpm start score [--all] [--status new] [--limit 25]
  pnpm start shortlist [--top 10] [--band A] [--max-risk medium]
  pnpm start generate <opportunityId>
  pnpm start generate-batch [--top 5] [--band A] [--ids id1,id2]
  pnpm start status <opportunityId> <status>
  pnpm start next <opportunityId> "next action text"
  pnpm start applied <opportunityId>
  pnpm start followup <opportunityId> <YYYY-MM-DD>
  pnpm start ignore <opportunityId>
  pnpm start brief
  pnpm start export

This CLI never submits applications automatically.
`);
}

interface ParsedArgs {
  positionals: string[];
  flags: Map<string, string | true>;
}

function parseArgs(args: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = args[index + 1];

    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      index += 1;
    } else {
      flags.set(key, true);
    }
  }

  return { positionals, flags };
}

function selectScoreTargets(
  opportunities: Opportunity[],
  parsed: ParsedArgs
): string[] {
  const status = stringFlag(parsed, "status");
  const limit = numberFlag(parsed, "limit");
  const scoreAll = booleanFlag(parsed, "all");
  const filtered = opportunities.filter((opportunity) => {
    if (status) {
      return opportunity.status === status;
    }

    if (scoreAll) {
      return true;
    }

    return (
      !opportunity.score ||
      ["new", "captured", "needs_regeneration"].includes(opportunity.status)
    );
  });

  return filtered.slice(0, limit ?? filtered.length).map((item) => item.id);
}

function ensureScored(
  opportunities: Opportunity[],
  profile: Profile,
  now: string
): Opportunity[] {
  return opportunities.map((opportunity) =>
    opportunity.score && opportunity.priorityBand
      ? opportunity
      : enrichOpportunityWithScore(opportunity, profile, now)
  );
}

function booleanFlag(parsed: ParsedArgs, key: string): boolean {
  return parsed.flags.has(key);
}

function stringFlag(parsed: ParsedArgs, key: string): string | undefined {
  const value = parsed.flags.get(key);

  return typeof value === "string" ? value : undefined;
}

function numberFlag(parsed: ParsedArgs, key: string): number | undefined {
  const value = stringFlag(parsed, key);

  if (!value) {
    return undefined;
  }

  const parsedNumber = Number(value);

  if (!Number.isInteger(parsedNumber) || parsedNumber <= 0) {
    throw new Error(`--${key} must be a positive integer.`);
  }

  return parsedNumber;
}

function priorityBandFlag(
  parsed: ParsedArgs,
  key: string
): PriorityBand | undefined {
  const value = stringFlag(parsed, key)?.toUpperCase();

  if (!value) {
    return undefined;
  }

  if (!["A", "B", "C", "D"].includes(value)) {
    throw new Error(`--${key} must be one of A, B, C, D.`);
  }

  return value as PriorityBand;
}

function riskFlag(
  parsed: ParsedArgs,
  key: string
): ApplicationRiskLevel | undefined {
  const value = stringFlag(parsed, key);

  if (!value) {
    return undefined;
  }

  if (!["low", "medium", "high"].includes(value)) {
    throw new Error(`--${key} must be one of low, medium, high.`);
  }

  return value as ApplicationRiskLevel;
}

function idsFlag(parsed: ParsedArgs, key: string): string[] | undefined {
  const value = stringFlag(parsed, key);

  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function parsePipelineStatus(status: string): PipelineStatus {
  if (!pipelineStatuses.includes(status as PipelineStatus)) {
    throw new Error(`Status must be one of: ${pipelineStatuses.join(", ")}`);
  }

  return status as PipelineStatus;
}

function formatBandCounts(counts: Map<PriorityBand, number>): string {
  return (["A", "B", "C", "D"] as PriorityBand[])
    .map((band) => `${band}=${counts.get(band) ?? 0}`)
    .join(", ");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
