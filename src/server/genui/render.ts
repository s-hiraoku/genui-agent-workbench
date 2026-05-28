import { createParser } from "@openuidev/react-lang";
import { library } from "../../library";
import { saveArtifact } from "./artifacts";
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

function validationSummary(
  errors: Array<{ code: string; message: string }>,
  unresolved: string[],
): string {
  const parts = [
    ...errors.map((error) => `${error.code}: ${error.message}`),
    ...unresolved.map((name) => `unresolved: ${name}`),
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
      `Invalid OpenUI Lang: ${validationSummary(result.meta.errors, result.meta.unresolved)}`,
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
