import { appendFile, mkdir, readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";
import { getProjectPaths } from "../storage/paths.js";
import type { ActionLogEntry } from "../types/index.js";

export async function appendActionLog(
  root: string | undefined,
  entry: Omit<ActionLogEntry, "id" | "timestamp">,
  now = new Date().toISOString()
): Promise<ActionLogEntry> {
  const actionEntry: ActionLogEntry = {
    id: `log_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    timestamp: now,
    ...entry
  };
  const filePath = getProjectPaths(root).actionLogFile;

  await mkdir(dirname(filePath), { recursive: true });
  await appendFile(filePath, `${JSON.stringify(actionEntry)}\n`, "utf8");

  return actionEntry;
}

export async function readActionLog(root?: string): Promise<ActionLogEntry[]> {
  const filePath = getProjectPaths(root).actionLogFile;

  try {
    const content = await readFile(filePath, "utf8");

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as ActionLogEntry);
  } catch (error) {
    if (isMissingFile(error)) {
      return [];
    }

    throw error;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
