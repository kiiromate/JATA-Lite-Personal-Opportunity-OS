import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Opportunity } from "../types/index.js";

const execFileAsync = promisify(execFile);

const applicationPackFileNames = [
  "01-fit-analysis.md",
  "02-resume-tailoring-notes.md",
  "03-cover-email-draft.md",
  "04-referral-message.md",
  "05-application-checklist.md"
] as const;

export interface SmokeWorkflowOptions {
  repoRoot?: string;
  env?: NodeJS.ProcessEnv;
  logger?: (message: string) => void;
}

export interface SmokeWorkflowResult {
  smokeRoot: string;
  opportunitiesFile: string;
  shortlistMarkdownPath: string;
  shortlistCsvPath: string;
  dailyBriefPath: string;
  trackerCsvPath: string;
  applicationPackDir: string;
  applicationPackFiles: string[];
  batchApplicationPacks: Array<{
    id: string;
    directory: string;
    files: string[];
  }>;
}

export async function runSmokeWorkflow(
  options: SmokeWorkflowOptions = {}
): Promise<SmokeWorkflowResult> {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const smokeRoot = resolve(repoRoot, ".local", "smoke");
  const logger = options.logger ?? console.log;

  assertSafeSmokeRoot(repoRoot, smokeRoot);

  const dataDir = join(smokeRoot, "data");
  const outputsDir = join(smokeRoot, "outputs");
  const fixturePath = join("fixtures", "bulk-opportunities.csv");
  const profilePath = join(repoRoot, "data", "profile.json");
  const opportunitiesFile = join(dataDir, "opportunities.json");
  const shortlistMarkdownPath = join(outputsDir, "shortlist.md");
  const shortlistCsvPath = join(outputsDir, "shortlist.csv");
  const dailyBriefPath = join(outputsDir, "daily-brief.md");
  const trackerCsvPath = join(outputsDir, "opportunity-tracker.csv");

  await rm(smokeRoot, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });
  await copyFile(profilePath, join(dataDir, "profile.json"));

  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...options.env,
    JATA_PROJECT_ROOT: smokeRoot,
    JATA_AI_PROVIDER: "mock",
    JATA_AI_MODE: "false",
    OPENROUTER_API_KEY: "",
    GEMINI_API_KEY: ""
  };

  await runCliCommand(repoRoot, ["import", fixturePath], baseEnv, logger);
  await runCliCommand(repoRoot, ["score", "--all"], baseEnv, logger);
  await runCliCommand(repoRoot, ["shortlist", "--top", "5"], baseEnv, logger);
  await runCliCommand(repoRoot, ["generate-batch", "--top", "2"], baseEnv, logger);
  await runCliCommand(repoRoot, ["brief"], baseEnv, logger);
  await runCliCommand(repoRoot, ["export"], baseEnv, logger);

  const finalOpportunities = await readOpportunities(opportunitiesFile);
  const generated = finalOpportunities.filter((item) => item.packPath);
  const firstGenerated = generated[0];

  if (!firstGenerated?.packPath) {
    throw new Error("Smoke workflow did not generate batch application packs.");
  }

  return {
    smokeRoot,
    opportunitiesFile,
    shortlistMarkdownPath,
    shortlistCsvPath,
    dailyBriefPath,
    trackerCsvPath,
    applicationPackDir: firstGenerated.packPath,
    applicationPackFiles: applicationPackFileNames.map((fileName) =>
      join(firstGenerated.packPath as string, fileName)
    ),
    batchApplicationPacks: generated.map((opportunity) => ({
      id: opportunity.id,
      directory: opportunity.packPath as string,
      files: applicationPackFileNames.map((fileName) =>
        join(opportunity.packPath as string, fileName)
      )
    }))
  };
}

async function runCliCommand(
  repoRoot: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  logger: (message: string) => void
): Promise<void> {
  const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const commandArgs = ["exec", "tsx", "src/cli/index.ts", ...args];
  const { stdout, stderr } = await execFileAsync(pnpm, commandArgs, {
    cwd: repoRoot,
    env: sanitizeEnv(env),
    shell: process.platform === "win32"
  });

  logger(`$ pnpm ${commandArgs.join(" ")}`);

  if (stdout.trim()) {
    logger(stdout.trim());
  }

  if (stderr.trim()) {
    logger(stderr.trim());
  }
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const sanitized: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(env)) {
    if (
      value === undefined ||
      key.includes("=") ||
      key.includes("\0") ||
      value.includes("\0")
    ) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

async function readOpportunities(filePath: string): Promise<Opportunity[]> {
  return JSON.parse(await readFile(filePath, "utf8")) as Opportunity[];
}

function assertSafeSmokeRoot(repoRoot: string, smokeRoot: string): void {
  const expected = resolve(repoRoot, ".local", "smoke");
  const repoPrefix = repoRoot.endsWith(sep) ? repoRoot : `${repoRoot}${sep}`;

  if (smokeRoot !== expected || !smokeRoot.startsWith(repoPrefix)) {
    throw new Error(`Refusing to reset unsafe smoke root: ${smokeRoot}`);
  }
}

function printResult(result: SmokeWorkflowResult): void {
  console.log("Smoke workflow complete.");
  console.log(`Smoke root: ${result.smokeRoot}`);
  console.log(`Opportunities data: ${result.opportunitiesFile}`);
  console.log(`Shortlist markdown: ${result.shortlistMarkdownPath}`);
  console.log(`Shortlist CSV: ${result.shortlistCsvPath}`);
  console.log(`Generated application packs: ${result.batchApplicationPacks.length}`);
  console.log(`First application pack: ${result.applicationPackDir}`);
  console.log("First application pack files:");

  for (const filePath of result.applicationPackFiles) {
    console.log(`- ${filePath}`);
  }

  console.log(`Daily brief: ${result.dailyBriefPath}`);
  console.log(`Tracker CSV: ${result.trackerCsvPath}`);
  console.log("No external AI provider was called.");
  console.log("Nothing was submitted or sent.");
}

function isDirectRun(): boolean {
  return Boolean(
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isDirectRun()) {
  runSmokeWorkflow()
    .then(printResult)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exitCode = 1;
    });
}
