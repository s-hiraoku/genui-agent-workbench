import { promises as fs } from "node:fs";
import path from "node:path";
import type { GenUIArtifact } from "./types";

const ARTIFACT_ROOT = ".genui";
const ARTIFACT_DIR = "artifacts";
const ARTIFACT_ID_PATTERN = /^art_[a-f0-9]{16}$/;

export function getGenUIRoot(): string {
  return process.env.GENUI_DATA_DIR ? path.resolve(process.env.GENUI_DATA_DIR) : path.join(process.cwd(), ARTIFACT_ROOT);
}

export function getArtifactDir(): string {
  return path.join(getGenUIRoot(), ARTIFACT_DIR);
}

export function assertArtifactId(artifactId: string): void {
  if (!ARTIFACT_ID_PATTERN.test(artifactId)) {
    throw new Error(`Invalid artifact id: ${artifactId}`);
  }
}

function getArtifactPath(artifactId: string): string {
  assertArtifactId(artifactId);
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

export async function deleteArtifact(artifactId: string): Promise<boolean> {
  try {
    await fs.unlink(getArtifactPath(artifactId));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
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

export async function pruneArtifacts(maxArtifacts: number): Promise<{ deleted: number; kept: number }> {
  if (!Number.isFinite(maxArtifacts) || maxArtifacts < 1) {
    throw new Error("maxArtifacts must be a positive number");
  }

  const artifacts = await listArtifacts(Number.MAX_SAFE_INTEGER);
  const stale = artifacts.slice(Math.floor(maxArtifacts));
  await Promise.all(stale.map((artifact) => deleteArtifact(artifact.artifactId)));

  return { deleted: stale.length, kept: artifacts.length - stale.length };
}
