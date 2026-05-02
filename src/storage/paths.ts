import { join, resolve } from "node:path";

export interface ProjectPaths {
  root: string;
  dataDir: string;
  outputsDir: string;
  localDir: string;
  resumesDir: string;
  applicationKitsDir: string;
  opportunitiesFile: string;
  profileFile: string;
  actionLogFile: string;
  operatorSettingsFile: string;
  resumeLibraryFile: string;
  packReviewNotesFile: string;
}

export function getProjectPaths(root?: string): ProjectPaths {
  const projectRoot = resolve(
    root ?? process.env.JATA_PROJECT_ROOT ?? process.cwd()
  );
  const dataDir = join(projectRoot, "data");
  const outputsDir = join(projectRoot, "outputs");
  const localDir = join(projectRoot, ".local");
  const resumesDir = join(localDir, "resumes");
  const applicationKitsDir = join(outputsDir, "application-kits");

  return {
    root: projectRoot,
    dataDir,
    outputsDir,
    localDir,
    resumesDir,
    applicationKitsDir,
    opportunitiesFile: join(dataDir, "opportunities.json"),
    profileFile: join(dataDir, "profile.json"),
    actionLogFile: join(localDir, "action-log.jsonl"),
    operatorSettingsFile: join(localDir, "operator-settings.json"),
    resumeLibraryFile: join(resumesDir, "library.json"),
    packReviewNotesFile: join(localDir, "pack-review-notes.json")
  };
}
