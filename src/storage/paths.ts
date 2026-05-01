import { join, resolve } from "node:path";

export interface ProjectPaths {
  root: string;
  dataDir: string;
  outputsDir: string;
  opportunitiesFile: string;
  profileFile: string;
}

export function getProjectPaths(root?: string): ProjectPaths {
  const projectRoot = resolve(
    root ?? process.env.JATA_PROJECT_ROOT ?? process.cwd()
  );
  const dataDir = join(projectRoot, "data");
  const outputsDir = join(projectRoot, "outputs");

  return {
    root: projectRoot,
    dataDir,
    outputsDir,
    opportunitiesFile: join(dataDir, "opportunities.json"),
    profileFile: join(dataDir, "profile.json")
  };
}
