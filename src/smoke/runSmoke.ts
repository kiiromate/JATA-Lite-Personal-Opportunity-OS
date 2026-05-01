import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import type { Opportunity, OpportunityInput } from "../types/index.js";

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
  dailyBriefPath: string;
  trackerCsvPath: string;
  applicationPackDir: string;
  applicationPackFiles: string[];
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
  const fixturePath = join(repoRoot, "fixtures", "sample-opportunity.json");
  const profilePath = join(repoRoot, "data", "profile.json");
  const opportunitiesFile = join(dataDir, "opportunities.json");
  const dailyBriefPath = join(outputsDir, "daily-brief.md");
  const trackerCsvPath = join(outputsDir, "opportunity-tracker.csv");
  const fixtureRaw = await readFile(fixturePath, "utf8");
  const fixtureJson = JSON.stringify(JSON.parse(fixtureRaw) as OpportunityInput);

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

  await runCliCommand(repoRoot, ["add"], {
    ...baseEnv,
    JATA_ADD_JSON: fixtureJson
  }, logger);
  await runCliCommand(repoRoot, ["score"], baseEnv, logger);

  const scoredOpportunities = await readOpportunities(opportunitiesFile);
  const opportunity = scoredOpportunities[0];

  if (!opportunity) {
    throw new Error("Smoke workflow did not create an opportunity record.");
  }

  await runCliCommand(repoRoot, ["generate", opportunity.id], baseEnv, logger);
  await runCliCommand(repoRoot, ["brief"], baseEnv, logger);
  await runCliCommand(repoRoot, ["export"], baseEnv, logger);

  const finalOpportunities = await readOpportunities(opportunitiesFile);
  const generated = finalOpportunities.find((item) => item.id === opportunity.id);

  if (!generated?.generatedPackDir) {
    throw new Error("Smoke workflow did not generate an application pack.");
  }

  return {
    smokeRoot,
    opportunitiesFile,
    dailyBriefPath,
    trackerCsvPath,
    applicationPackDir: generated.generatedPackDir,
    applicationPackFiles: applicationPackFileNames.map((fileName) =>
      join(generated.generatedPackDir as string, fileName)
    )
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
  console.log(`Application pack: ${result.applicationPackDir}`);
  console.log("Application pack files:");

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
