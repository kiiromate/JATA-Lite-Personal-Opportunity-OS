import { join } from "node:path";

export interface ProjectPaths {
  root: string;
  dataDir: string;
  outputsDir: string;
  opportunitiesFile: string;
  profileFile: string;
}

export function getProjectPaths(root = process.cwd()): ProjectPaths {
  const dataDir = join(root, "data");
  const outputsDir = join(root, "outputs");

  return {
    root,
    dataDir,
    outputsDir,
    opportunitiesFile: join(dataDir, "opportunities.json"),
    profileFile: join(dataDir, "profile.json")
  };
}
