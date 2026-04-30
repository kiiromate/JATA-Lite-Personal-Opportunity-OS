import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createOpportunity } from "../core/opportunity.js";
import { createAIProviderFromEnv } from "../generators/aiProvider.js";
import { generateApplicationPack } from "../generators/applicationPack.js";
import { opportunitiesToCsv } from "../generators/csvExporter.js";
import { generateDailyBrief } from "../generators/dailyBrief.js";
import { scoreOpportunity } from "../scoring/scorer.js";
import {
  loadOpportunities,
  loadProfile,
  saveOpportunities
} from "../storage/jsonStore.js";
import { getProjectPaths } from "../storage/paths.js";
import type { OpportunityInput } from "../types/index.js";

async function main(): Promise<void> {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case "add":
      await addOpportunity();
      break;
    case "score":
      await scoreOpportunities();
      break;
    case "generate":
      await generatePack(arg);
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
    jobDescription: String(parsed.jobDescription ?? ""),
    deadline: String(parsed.deadline ?? ""),
    contact: String(parsed.contact ?? ""),
    method: String(parsed.method ?? ""),
    notes: String(parsed.notes ?? "")
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

async function scoreOpportunities(): Promise<void> {
  const [profile, opportunities] = await Promise.all([
    loadProfile(),
    loadOpportunities()
  ]);
  const now = new Date().toISOString();
  let scoredCount = 0;

  const updated = opportunities.map((opportunity) => {
    if (opportunity.score) {
      return opportunity;
    }

    const score = scoreOpportunity(opportunity, profile);
    scoredCount += 1;

    return {
      ...opportunity,
      score,
      status: "scored" as const,
      nextAction: nextActionForDecision(score.decision),
      lastUpdated: now
    };
  });

  await saveOpportunities(updated);
  output.write(`Scored ${scoredCount} opportunity record(s).\n`);
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

  const { provider, useAI } = createAIProviderFromEnv();
  const result = await generateApplicationPack({
    opportunity: opportunities[index],
    profile,
    outputRoot: paths.outputsDir,
    aiProvider: provider,
    useAI
  });
  const now = new Date().toISOString();

  opportunities[index] = {
    ...opportunities[index],
    status: "review_ready",
    generatedPackDir: result.directory,
    lastGeneratedAt: now,
    lastUpdated: now,
    nextAction: "Human review application pack"
  };

  await saveOpportunities(opportunities);
  output.write(`Generated application pack: ${result.directory}\n`);
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

function nextActionForDecision(decision: string): string {
  if (decision === "Pursue") {
    return "Generate application pack";
  }

  if (decision === "Maybe") {
    return "Review manually before generating pack";
  }

  return "No action unless strategic context changes";
}

function printHelp(): void {
  output.write(`JATA Lite: Personal Opportunity OS

Commands:
  pnpm start add
  pnpm start score
  pnpm start generate <opportunityId>
  pnpm start brief
  pnpm start export

This CLI never submits applications automatically.
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
