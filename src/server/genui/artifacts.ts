import { promises as fs } from "node:fs";
import path from "node:path";
import type { GenUIArtifact } from "./types";

const ARTIFACT_ROOT = ".genui";
const ARTIFACT_DIR = "artifacts";

export function getGenUIRoot(): string {
  return process.env.GENUI_DATA_DIR ? path.resolve(process.env.GENUI_DATA_DIR) : path.join(process.cwd(), ARTIFACT_ROOT);
}

export function getArtifactDir(): string {
  return path.join(getGenUIRoot(), ARTIFACT_DIR);
}

function getArtifactPath(artifactId: string): string {
  return path.join(getArtifactDir(), `${artifactId}.json`);
}

async function ensureArtifactDir(): Promise<void> {
  await fs.mkdir(getArtifactDir(), { recursive: true });
}

export async function saveArtifact(artifact: GenUIArtifact): Promise<void> {
  await ensureArtifactDir();
  await fs.writeFile(getArtifactPath(artifact.artifactId), JSON.stringify(artifact, null, 2), "utf8");
}

export async function loadArtifact(artifactId: string): Promise<GenUIArtifact | null> {
  try {
    const raw = await fs.readFile(getArtifactPath(artifactId), "utf8");
    return JSON.parse(raw) as GenUIArtifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function listArtifacts(limit = 20): Promise<GenUIArtifact[]> {
  try {
    const entries = await fs.readdir(getArtifactDir(), { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(getArtifactDir(), entry.name));

    const artifacts = await Promise.all(
      files.map(async (file) => JSON.parse(await fs.readFile(file, "utf8")) as GenUIArtifact),
    );

    return artifacts
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}
