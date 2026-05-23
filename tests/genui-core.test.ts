import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { loadArtifact } from "../src/server/genui/artifacts";
import { readBrokerState, writeBrokerState } from "../src/server/genui/broker-state";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { genUIExamples } from "../src/server/genui/examples";
import { library, promptOptions } from "../src/library";
import { OpenUILangValidationError, renderGenUI, validateOpenUILang } from "../src/server/genui/render";
import { sanitizeSettings } from "../src/server/genui/settings";

const genuiTestRoot = path.join(process.cwd(), ".genui-test");
let genuiDir = "";

const sampleOpenUILang = [
  "root = Card([header, metrics, actions])",
  'header = CardHeader("Build Review", "Agent-generated popup")',
  'metrics = MetricGrid("Summary", "Current checks", [m1, m2])',
  'm1 = { label: "Tests", value: "68 passed", tone: "positive" }',
  'm2 = { label: "Lint", value: "passed", tone: "positive" }',
  'actions = ActionPanel("Next Actions", "Recommended handoff", [a1])',
  'a1 = { label: "Open popup", priority: "medium", owner: "agent", description: "Send OpenUI Lang through the CLI" }',
].join("\n");

beforeEach(async () => {
  genuiDir = path.join(genuiTestRoot, randomUUID());
  process.env.GENUI_DATA_DIR = genuiDir;
  await fs.rm(genuiDir, { force: true, recursive: true });
});

afterEach(async () => {
  delete process.env.GENUI_DATA_DIR;
  await fs.rm(genuiDir, { force: true, recursive: true });
});

describe("renderGenUI", () => {
  it("stores caller-provided OpenUI Lang as a provided artifact", async () => {
    const result = await renderGenUI({
      openuiLang: sampleOpenUILang,
      agentId: "test-agent",
      title: "Build Popup",
      context: { source: "unit-test" },
    });

    expect(result.artifact.artifactId).toMatch(/^art_/);
    expect(result.artifact.agentId).toBe("test-agent");
    expect(result.artifact.title).toBe("Build Popup");
    expect(result.artifact.generationMode).toBe("provided");
    expect(result.previewPath).toBe(`/preview/${result.artifact.artifactId}`);

    const saved = await loadArtifact(result.artifact.artifactId);
    expect(saved?.openuiLang).toBe(sampleOpenUILang);
    expect(saved?.context).toMatchObject({ source: "unit-test" });
  });

  it("rejects empty OpenUI Lang", async () => {
    await expect(renderGenUI({ openuiLang: "   " })).rejects.toThrow("openuiLang is required");
  });

  it("rejects OpenUI Lang with unknown components", async () => {
    await expect(renderGenUI({ openuiLang: "root = MissingCard()" })).rejects.toThrow(
      "Invalid OpenUI Lang",
    );
  });

  it("reports validation failures with a typed error", () => {
    expect(() => validateOpenUILang("root = MissingCard()")).toThrow(OpenUILangValidationError);
  });

  it("validates representative OpenUI Lang", () => {
    expect(() => validateOpenUILang(sampleOpenUILang)).not.toThrow();
  });

  it("keeps all shipped examples parser-valid", () => {
    expect(genUIExamples.length).toBeGreaterThan(0);
    for (const example of genUIExamples) {
      expect(() => validateOpenUILang(example.openuiLang)).not.toThrow();
    }
  });
});

describe("agent interface scaffold", () => {
  it("publishes direct OpenUI Lang CLI guidance", () => {
    expect(agentUsageGuide.preferredFlow.join("\n")).toContain("prompt-spec");
    expect(agentUsageGuide.preferredFlow.join("\n")).toContain("validate");
    expect(agentUsageGuide.cli.open).toContain("--openui-lang-file");
    expect(agentUsageGuide.cli.openAndWait).toContain("--wait");
    expect(agentUsageGuide.purpose).toContain("The agent generates OpenUI Lang");
  });

  it("builds an OpenUI prompt spec with custom components", () => {
    const promptSpec = library.prompt(promptOptions);
    expect(promptSpec).toContain("MetricGrid");
    expect(promptSpec).toContain("ActionPanel");
    expect(promptSpec).toContain("MapView");
  });

  it("exposes a component catalog without duplicate names", () => {
    const names = componentCatalog.map((component) => component.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["MetricGrid", "ActionPanel", "DataTable"]));
  });
});

describe("settings", () => {
  it("uses mint as the tactical HUD theme preset", () => {
    const settings = sanitizeSettings({
      design: {
        glassPreset: "milky",
        labelInkPreset: "green",
        themeColorPreset: "mint",
        windowAnimationPreset: "center",
      },
    });

    expect(settings.design.themeColorPreset).toBe("mint");
  });

  it("accepts the bright blue theme preset", () => {
    const settings = sanitizeSettings({
      design: {
        glassPreset: "milky",
        labelInkPreset: "green",
        themeColorPreset: "azure",
        windowAnimationPreset: "center",
      },
    });

    expect(settings.design.themeColorPreset).toBe("azure");
  });
});

describe("broker state", () => {
  it("persists and reads broker state under GENUI_DATA_DIR", async () => {
    await writeBrokerState({
      controlUrl: "http://127.0.0.1:48231",
      nextUrl: "http://127.0.0.1:3000",
      pid: 1234,
      brokerProtocolVersion: "test",
      appVersion: "0.0.0",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(readBrokerState()).resolves.toMatchObject({
      controlUrl: "http://127.0.0.1:48231",
      nextUrl: "http://127.0.0.1:3000",
      pid: 1234,
    });
  });
});
