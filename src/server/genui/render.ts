import { createParser } from "@openuidev/react-lang";
import { library } from "../../library";
import { saveArtifact } from "./artifacts";
import type { GenUIArtifact, GenUILocale, RenderGenUIInput, RenderGenUIResult } from "./types";

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function normalizeInput(input: RenderGenUIInput): RenderGenUIInput & { openuiLang: string; locale: GenUILocale } {
  const openuiLang = input.openuiLang?.trim();

  if (!openuiLang) {
    throw new Error("openuiLang is required");
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
  const parser = createParser(library.toJSONSchema(), library.root);
  const result = parser.parse(openuiLang);

  if (result.meta.errors.length > 0 || result.meta.unresolved.length > 0) {
    throw new Error(`Invalid OpenUI Lang: ${validationSummary(result.meta.errors, result.meta.unresolved)}`);
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
