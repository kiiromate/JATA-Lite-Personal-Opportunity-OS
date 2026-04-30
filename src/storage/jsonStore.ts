import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Opportunity, Profile } from "../types/index.js";
import { getProjectPaths } from "./paths.js";

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (isMissingFile(error)) {
      await writeJsonFile(filePath, fallback);
      return fallback;
    }

    throw error;
  }
}

export async function writeJsonFile<T>(
  filePath: string,
  value: T
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function loadOpportunities(
  root = process.cwd()
): Promise<Opportunity[]> {
  return readJsonFile<Opportunity[]>(
    getProjectPaths(root).opportunitiesFile,
    []
  );
}

export async function saveOpportunities(
  opportunities: Opportunity[],
  root = process.cwd()
): Promise<void> {
  await writeJsonFile(getProjectPaths(root).opportunitiesFile, opportunities);
}

export async function loadProfile(root = process.cwd()): Promise<Profile> {
  const profile = await readJsonFile<Profile | null>(
    getProjectPaths(root).profileFile,
    null
  );

  if (!profile) {
    throw new Error("data/profile.json is missing. Restore the profile file.");
  }

  return profile;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
