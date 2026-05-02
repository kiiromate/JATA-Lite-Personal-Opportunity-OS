import { mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { getProjectPaths } from "../storage/paths.js";
import { readJsonFile, writeJsonFile } from "../storage/jsonStore.js";
import type { RegisterResumeInput, ResumeVersion } from "../types/index.js";

export async function listResumeVersions(root?: string): Promise<ResumeVersion[]> {
  await ensureResumeLibrary(root);

  return readJsonFile<ResumeVersion[]>(
    getProjectPaths(root).resumeLibraryFile,
    []
  );
}

export async function registerResumeVersion(
  input: RegisterResumeInput,
  options: { root?: string; now?: string } = {}
): Promise<ResumeVersion> {
  const now = options.now ?? new Date().toISOString();
  const cleaned = normalizeResumeInput(input);
  const versions = await listResumeVersions(options.root);
  const resume: ResumeVersion = {
    id: `resume_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`,
    createdAt: now,
    updatedAt: now,
    ...cleaned
  };
  const next = resume.isPreferred
    ? versions.map((version) => ({ ...version, isPreferred: false }))
    : versions;

  next.push(resume);
  await writeJsonFile(getProjectPaths(options.root).resumeLibraryFile, next);

  return resume;
}

export async function findResumeVersion(
  root: string | undefined,
  resumeVersionId: string | undefined
): Promise<ResumeVersion | undefined> {
  const versions = await listResumeVersions(root);

  if (resumeVersionId) {
    return versions.find((version) => version.id === resumeVersionId);
  }

  return versions.find((version) => version.isPreferred);
}

async function ensureResumeLibrary(root?: string): Promise<void> {
  await mkdir(getProjectPaths(root).resumesDir, { recursive: true });
}

function normalizeResumeInput(input: RegisterResumeInput): Omit<
  ResumeVersion,
  "id" | "createdAt" | "updatedAt"
> {
  const title = clean(input.title);
  const filePath = clean(input.filePath);

  if (!title) {
    throw new Error("Resume title is required.");
  }

  if (!filePath) {
    throw new Error("Resume file path is required.");
  }

  return {
    title,
    targetLane: clean(input.targetLane),
    industries: (input.industries ?? []).map(clean).filter(Boolean),
    seniority: clean(input.seniority),
    language: clean(input.language) || "English",
    filePath,
    notes: clean(input.notes ?? ""),
    isPreferred: input.isPreferred ?? false
  };
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}
