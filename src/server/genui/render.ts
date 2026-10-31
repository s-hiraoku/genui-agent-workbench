import { createParser } from "@openuidev/react-lang";
import { library } from "../../library";
import { saveArtifact } from "./artifacts";
import { componentCatalog } from "./component-catalog";
import type { GenUIArtifact, GenUILocale, RenderGenUIInput, RenderGenUIResult } from "./types";

const openuiParser = createParser(library.toJSONSchema(), library.root);
const MAX_OPENUI_LANG_BYTES = 512 * 1024;
const MAX_CONTEXT_JSON_BYTES = 512 * 1024;

export class OpenUILangValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenUILangValidationError";
  }
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function normalizeInput(input: RenderGenUIInput): RenderGenUIInput & { openuiLang: string; locale: GenUILocale } {
  const openuiLang = input.openuiLang?.trim();

  if (!openuiLang) {
    throw new Error("openuiLang is required");
  }

  if (Buffer.byteLength(openuiLang, "utf8") > MAX_OPENUI_LANG_BYTES) {
    throw new Error(`openuiLang exceeds ${MAX_OPENUI_LANG_BYTES} bytes`);
  }

  if (input.context && Buffer.byteLength(JSON.stringify(input.context), "utf8") > MAX_CONTEXT_JSON_BYTES) {
    throw new Error(`context exceeds ${MAX_CONTEXT_JSON_BYTES} bytes`);
  }

  return {
    ...input,
    openuiLang,
    locale: input.locale ?? "auto",
  };
}

const componentNames = componentCatalog.map((component) => component.name);
const componentSignatureHints: Record<string, string> = {
  ActionPanel: 'ActionPanel(title, description, actions)',
  AlertList: 'AlertList(title, description, alerts)',
  BarChart: 'BarChart(title, description, unit, max, data)',
  ChecklistPanel: 'ChecklistPanel(title, description, items, summary)',
  ConfirmDialog: 'ConfirmDialog(title, description, question, detail, risk, confirmLabel, cancelLabel, consequences)',
  DataTable: 'DataTable(title, description, columns, rows, caption)',
  DonutChart: 'DonutChart(title, description, total, segments)',
  LineChart: 'LineChart(title, description, unit, data)',
  MetricGrid: 'MetricGrid(title, description, metrics)',
  AudioPlayer: 'AudioPlayer(title, description, tracks, autoplay)',
  VideoPlayer: 'VideoPlayer(title, description, src, posterUrl, transcript, chapters, autoplay)',
  VideoPlaylist: 'VideoPlaylist(title, description, videos, autoplay)',
};

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1),
      );
    }
  }
  return dp[a.length][b.length];
}

function closestComponents(name: string): string[] {
  return componentNames
    .map((candidate) => ({ candidate, distance: levenshtein(name, candidate) }))
    .filter(({ distance }) => distance <= Math.max(3, Math.floor(name.length * 0.45)))
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate))
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}

function suggestionText(names: string[]): string {
  if (names.length === 0) return "";
  const hints = names
    .map((name) => {
      const signature = componentSignatureHints[name];
      return signature ? `"${name}" (${signature})` : `"${name}"`;
    })
    .join(", ");
  return `; did you mean ${hints}?`;
}

function lineForStatement(openuiLang: string, statementId?: string): number | undefined {
  if (!statementId) return undefined;
  const escaped = statementId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`^\\s*${escaped}\\s*=`);
  const lines = openuiLang.split(/\r?\n/);
  const index = lines.findIndex((line) => matcher.test(line));
  return index >= 0 ? index + 1 : undefined;
}

function lineForToken(openuiLang: string, token: string): number | undefined {
  const lines = openuiLang.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(token));
  return index >= 0 ? index + 1 : undefined;
}

function validationSummary(
  openuiLang: string,
  errors: Array<{ code: string; message: string; component?: string; statementId?: string }>,
  unresolved: string[],
): string {
  const parts = [
    ...errors.map((error) => {
      const line = lineForStatement(openuiLang, error.statementId);
      const prefix = line ? `line ${line}: ` : "";
      const suggestions = error.component ? closestComponents(error.component) : [];
      const suffix = suggestionText(suggestions);
      return `${prefix}${error.code}: ${error.message}${suffix}`;
    }),
    ...unresolved.map((name) => {
      const line = lineForToken(openuiLang, name);
      return `${line ? `line ${line}: ` : ""}unresolved: ${name}`;
    }),
  ];
  return parts.join("; ");
}

export function validateOpenUILang(openuiLang: string): void {
  let result: ReturnType<typeof openuiParser.parse>;

  try {
    result = openuiParser.parse(openuiLang);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new OpenUILangValidationError(`Invalid OpenUI Lang: ${detail}`);
  }

  if (result.meta.errors.length > 0 || result.meta.unresolved.length > 0) {
    throw new OpenUILangValidationError(
      `Invalid OpenUI Lang: ${validationSummary(openuiLang, result.meta.errors, result.meta.unresolved)}`,
    );
  }
}

export async function renderGenUI(input: RenderGenUIInput): Promise<RenderGenUIResult> {
  const normalized = normalizeInput(input);
  validateOpenUILang(normalized.openuiLang);

  const artifact: GenUIArtifact = {
    artifactId: createId("art"),
    agentId: normalized.agentId,
    title: normalized.title ?? `${normalized.agentId ?? "Agent"} GenUI`,
    openuiLang: normalized.openuiLang,
    createdAt: new Date().toISOString(),
    generationMode: "provided",
    locale: normalized.locale,
    context: normalized.context,
  };

  await saveArtifact(artifact);

  return {
    artifact,
    previewPath: `/preview/${artifact.artifactId}`,
  };
}
