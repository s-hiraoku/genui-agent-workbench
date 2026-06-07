import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { deleteArtifact, listArtifacts, loadArtifact, pruneArtifacts } from "../src/server/genui/artifacts";
import { readBrokerState, writeBrokerState } from "../src/server/genui/broker-state";
import { buildAgentInstructions, buildPromptSpec } from "../src/server/genui/cli-guidance";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { genUIExamples } from "../src/server/genui/examples";
import { library, promptOptions, resolveVideoEmbedSource } from "../src/library";
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

  it("deletes artifacts by id", async () => {
    const result = await renderGenUI({
      openuiLang: sampleOpenUILang,
      agentId: "test-agent",
      title: "Disposable Popup",
    });

    await expect(deleteArtifact(result.artifact.artifactId)).resolves.toBe(true);
    await expect(loadArtifact(result.artifact.artifactId)).resolves.toBeNull();
  });

  it("prunes older artifacts beyond a retention limit", async () => {
    for (let index = 0; index < 3; index += 1) {
      await renderGenUI({
        openuiLang: sampleOpenUILang,
        agentId: "test-agent",
        title: `Popup ${index}`,
      });
    }

    await expect(pruneArtifacts(2)).resolves.toEqual({ deleted: 1, kept: 2 });
    await expect(listArtifacts(10)).resolves.toHaveLength(2);
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

  it("validates interactive media OpenUI Lang", () => {
    const mediaOpenUILang = [
      "root = Card([videos, audio, gallery])",
      'videos = VideoPlaylist("おすすめ動画", "クリックで候補を切り替え", [v1, v2], true)',
      'v1 = { title: "Main", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", channel: "YouTube", reason: "best match" }',
      'v2 = { title: "Next", src: "https://youtu.be/aqz-KE-bpKQ?t=42", channel: "YouTube", reason: "next candidate" }',
      'audio = AudioPlayer("音声候補", "選択式キュー", [track1, track2])',
      'track1 = { title: "Track 1", src: "https://example.com/a.mp3", artist: "demo" }',
      'track2 = { title: "Track 2", src: "https://example.com/b.mp3", artist: "demo" }',
      'gallery = ImageGallery("画像候補", "選択式プレビュー", [img1, img2], 2)',
      'img1 = { src: "https://example.com/a.png", caption: "A" }',
      'img2 = { src: "https://example.com/b.png", caption: "B" }',
    ].join("\n");

    expect(() => validateOpenUILang(mediaOpenUILang)).not.toThrow();
  });

  it("keeps all shipped examples parser-valid", () => {
    expect(genUIExamples.length).toBeGreaterThan(0);
    expect(genUIExamples.map((example) => example.name)).toEqual(
      expect.arrayContaining(["code-review", "research-brief", "support-triage", "data-quality"]),
    );
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
    expect(agentUsageGuide.cli.open).toContain("genui popup");
    expect(agentUsageGuide.cli.artifacts).toContain("artifacts");
    expect(agentUsageGuide.cli.replay).toContain("replay");
    expect(agentUsageGuide.purpose).toContain("The agent generates OpenUI Lang");
  });

  it("builds an OpenUI prompt spec with custom components", () => {
    const promptSpec = library.prompt(promptOptions);
    expect(promptSpec).toContain("MetricGrid");
    expect(promptSpec).toContain("ActionPanel");
    expect(promptSpec).toContain("MapView");
    expect(promptSpec).toContain("VideoPlaylist");
  });

  it("builds broker-served CLI guidance for standalone commands", () => {
    const instructions = buildAgentInstructions();
    expect(buildPromptSpec()).toContain("MetricGrid");
    expect(instructions).toContain("genui prompt-spec");
    expect(instructions).toContain("genui popup");
    expect(instructions.indexOf("genui validate")).toBeLessThan(instructions.indexOf("genui popup"));
  });

  it("exposes a component catalog without duplicate names", () => {
    const names = componentCatalog.map((component) => component.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["MetricGrid", "ActionPanel", "DataTable", "VideoPlaylist"]));
  });

  it("normalizes YouTube watch and short URLs for inline embeds", () => {
    expect(resolveVideoEmbedSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "iframe",
      provider: "YouTube",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });
    expect(resolveVideoEmbedSource("https://youtu.be/aqz-KE-bpKQ?t=1m2s", { autoplay: true })).toEqual({
      kind: "iframe",
      provider: "YouTube",
      src: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0&autoplay=1&mute=1&start=62",
    });
    expect(resolveVideoEmbedSource("https://example.com/demo.mp4")).toEqual({
      kind: "native",
      src: "https://example.com/demo.mp4",
    });
  });
});

describe("settings", () => {
  it("uses mint as the tactical HUD theme preset", () => {
    const settings = sanitizeSettings({
      design: {
        visualThemePreset: "hud",
        glassPreset: "milky",
        labelInkPreset: "green",
        opaque: true,
        themeColorPreset: "mint",
        windowAnimationPreset: "center",
      },
    });

    expect(settings.design.themeColorPreset).toBe("mint");
  });

  it("accepts the bright blue theme preset", () => {
    const settings = sanitizeSettings({
      design: {
        visualThemePreset: "hud",
        glassPreset: "milky",
        labelInkPreset: "green",
        opaque: true,
        themeColorPreset: "azure",
        windowAnimationPreset: "center",
      },
    });

    expect(settings.design.themeColorPreset).toBe("azure");
  });

  it("accepts practical popup visual theme presets", () => {
    const settings = sanitizeSettings({
      design: {
        visualThemePreset: "workbench",
        glassPreset: "milky",
        labelInkPreset: "green",
        opaque: false,
        themeColorPreset: "graphite",
        windowAnimationPreset: "fade",
      },
    });

    expect(settings.design.visualThemePreset).toBe("workbench");
  });

  it("falls back to the HUD visual theme preset", () => {
    const invalidDesign = JSON.parse('{"visualThemePreset":"unknown"}') as Parameters<
      typeof sanitizeSettings
    >[0]["design"];
    const settings = sanitizeSettings({
      design: invalidDesign,
    });

    expect(settings.design.visualThemePreset).toBe("hud");
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
      controlToken: "token-123",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(readBrokerState()).resolves.toMatchObject({
      controlUrl: "http://127.0.0.1:48231",
      nextUrl: "http://127.0.0.1:3000",
      pid: 1234,
      controlToken: "token-123",
    });
  });

  it("can read broker state from an explicit state file", async () => {
    const stateFile = path.join(genuiTestRoot, randomUUID(), "broker.json");
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(
      stateFile,
      JSON.stringify({
        controlUrl: "http://127.0.0.1:48232",
        nextUrl: "http://127.0.0.1:3001",
        pid: 5678,
        brokerProtocolVersion: "test",
        appVersion: "0.0.0",
        controlToken: "token-456",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      "utf8",
    );

    const previousDataDir = process.env.GENUI_DATA_DIR;
    try {
      process.env.GENUI_BROKER_STATE_FILE = stateFile;
      delete process.env.GENUI_DATA_DIR;
      await expect(readBrokerState()).resolves.toMatchObject({
        controlUrl: "http://127.0.0.1:48232",
        controlToken: "token-456",
      });
    } finally {
      process.env.GENUI_DATA_DIR = previousDataDir;
      delete process.env.GENUI_BROKER_STATE_FILE;
      await fs.rm(path.dirname(stateFile), { force: true, recursive: true });
    }
  });

  it("skips malformed broker state files", async () => {
    const stateFile = path.join(genuiTestRoot, randomUUID(), "broker.json");
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, "{not-json", "utf8");

    const previousDataDir = process.env.GENUI_DATA_DIR;
    try {
      process.env.GENUI_DATA_DIR = path.join(genuiTestRoot, randomUUID());
      await writeBrokerState({
        controlUrl: "http://127.0.0.1:48233",
        nextUrl: "http://127.0.0.1:3002",
        pid: 9012,
        brokerProtocolVersion: "test",
        appVersion: "0.0.0",
        controlToken: "token-789",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      process.env.GENUI_BROKER_STATE_FILE = stateFile;
      await expect(readBrokerState()).resolves.toMatchObject({
        controlUrl: "http://127.0.0.1:48233",
        controlToken: "token-789",
      });
    } finally {
      process.env.GENUI_DATA_DIR = previousDataDir;
      delete process.env.GENUI_BROKER_STATE_FILE;
      await fs.rm(path.dirname(stateFile), { force: true, recursive: true });
    }
  });
});
