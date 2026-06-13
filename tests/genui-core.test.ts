import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Renderer } from "@openuidev/react-lang";
import packageJson from "../package.json";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { deleteArtifact, listArtifacts, loadArtifact, pruneArtifacts } from "../src/server/genui/artifacts";
import { readBrokerState, writeBrokerState } from "../src/server/genui/broker-state";
import { readLiveDesignSettings } from "../src/app/preview/live-design-settings";
import { buildAgentInstructions, buildAgentSnippet, buildPromptSpec } from "../src/server/genui/cli-guidance";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { genUIExamples } from "../src/server/genui/examples";
import { GenUIRuntimeDataContext, chartTooltipStyle, library, promptOptions, resolveVideoEmbedSource } from "../src/library";
import { OpenUILangValidationError, renderGenUI, validateOpenUILang } from "../src/server/genui/render";
import {
  applyPreviewThemeParams,
  buildPopupPreviewUrl,
  previewThemeParamsFromSettings,
} from "../src/server/genui/preview-url";
import { sanitizeSettings } from "../src/server/genui/settings";
import { coerceSizePreset, resolveResizePreset, resolveWindowGeometry, WINDOW_SIZE_PRESETS } from "../src/server/genui/window-size";

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

  it("reports validation failures with line context and suggestions", () => {
    expect(() => validateOpenUILang("root = MissingCard()")).toThrow(/line 1: unknown-component/);
    expect(() => validateOpenUILang("root = ConfirmDialg(\"Deploy?\")")).toThrow(/ConfirmDialog/);
    expect(() => validateOpenUILang("root = ConfirmDialg(\"Deploy?\")")).toThrow(/ConfirmDialog\(title, description, question/);
  });

  it("validates representative OpenUI Lang", () => {
    expect(() => validateOpenUILang(sampleOpenUILang)).not.toThrow();
  });

  it("validates score, checklist, and insight components", () => {
    const readinessOpenUILang = [
      "root = Card([gauge, checklist, insights])",
      'gauge = Gauge("Readiness", "Bounded release score", "Release", 82, 100, "%", 90, "info")',
      'checklist = ChecklistPanel("Gates", "Go/no-go checks", [c1, c2], "One gate still needs attention")',
      'c1 = { label: "Tests", status: "done", description: "Regression suite passes" }',
      'c2 = { label: "Support coverage", status: "warning", owner: "support", description: "Launch window not confirmed" }',
      'insights = InsightStack("Takeaways", "Agent summary", [i1])',
      'i1 = { title: "Technical risk is low", detail: "Remaining issue is operational coverage.", confidence: "high", source: "release checklist", tone: "info" }',
    ].join("\n");

    expect(() => validateOpenUILang(readinessOpenUILang)).not.toThrow();
  });

  it("validates context-backed chart and table components", () => {
    const chartOpenUILang = [
      "root = Card([header, line, bars, combo, table, preview])",
      'header = CardHeader("Traffic", "Rows loaded from context")',
      'line = LineChart("Daily Traffic", "Reads context.daily", " views", [], "daily", "date", "pv")',
      'bars = BarChart("Top Pages", "Reads context.pages", " views", 2000, [], "pages", "path", "views", "tone")',
      'combo = ComboChart("Traffic + CVR", "Reads context.daily", [], " views", "%", "PV", "CVR", "info", "daily", "date", "pv", "cvr")',
      'table = DataTable("Pages", "Columns inferred from context.pages", [], [], "Top landing pages", "pages")',
      'preview = DataPreview("Raw Rows", "Schema inferred from context.pages", "pages", [], [], false, 0, "pages")',
    ].join("\n");

    expect(() => validateOpenUILang(chartOpenUILang)).not.toThrow();
    const markup = renderToStaticMarkup(
      React.createElement(
        GenUIRuntimeDataContext.Provider,
        {
          value: {
            daily: [{ date: "Jun 1", pv: 1200, cvr: 2.4 }],
            pages: [{ path: "/docs", views: 1800, tone: "positive" }],
          },
        },
        React.createElement(Renderer, { response: chartOpenUILang, library }),
      ),
    );
    expect(markup).toContain("path");
    expect(markup).toContain("views");
    expect(markup).toContain("/docs");
  });

  it("keeps chart tooltip text readable on any visual theme", () => {
    expect(chartTooltipStyle.contentStyle).toMatchObject({
      backgroundColor: "#07110d",
      color: "#f8fdff",
      colorScheme: "dark",
    });
    expect(chartTooltipStyle.labelStyle.color).toBe("rgba(232, 245, 236, 0.84)");
    expect(chartTooltipStyle.itemStyle.color).toBe("#f8fdff");
    expect(chartTooltipStyle.wrapperStyle.color).toBe("#f8fdff");
  });

  it("validates bidirectional interaction components", () => {
    const interactiveOpenUILang = [
      "root = Card([approval, form, wizard, thread, code])",
      'approval = ConfirmDialog("Deploy approval", "Release gate", "Deploy now?", "All checks passed.", "medium", "Approve", "Hold", "deploy.approve")',
      'form = FormPanel("Release note", "Returned to the agent", [note], "release.note", "Submit note")',
      'note = { label: "Note", name: "note", type: "textarea", value: "", required: false }',
      'wizard = WizardForm("Setup", "Collect release details", [step], "release.setup", "Finish")',
      'step = { label: "Target", status: "active", fields: [env] }',
      'env = { label: "Environment", name: "environment", type: "select", options: ["staging", "production"], value: "staging" }',
      'thread = MessageThread("Reviewer notes", "Send a note", [], { placeholder: "Message", sendLabel: "Send", actionId: "review.message" })',
      'code = CodeBlock("Command", "Run after approval", "bash", "npm run build", true, "release.sh", true)',
    ].join("\n");

    expect(() => validateOpenUILang(interactiveOpenUILang)).not.toThrow();
  });

  it("renders an empty WizardForm without crashing", () => {
    const emptyWizardOpenUILang = 'root = WizardForm("Setup", "No steps yet", [])';

    expect(() => validateOpenUILang(emptyWizardOpenUILang)).not.toThrow();
    expect(() =>
      renderToStaticMarkup(React.createElement(Renderer, { response: emptyWizardOpenUILang, library })),
    ).not.toThrow();
  });

  it("validates interactive media OpenUI Lang", () => {
    const mediaOpenUILang = [
      "root = Card([videos, audio, gallery])",
      'videos = VideoPlaylist("おすすめ動画", "クリックで候補を切り替え", [v1, v2], true)',
      'v1 = { title: "Main", src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", channel: "YouTube", reason: "best match" }',
      'v2 = { title: "Next", src: "https://youtu.be/aqz-KE-bpKQ?t=42", channel: "YouTube", reason: "next candidate" }',
      'audio = AudioPlayer("音声候補", "選択式キュー", [track1, track2])',
      'track1 = { title: "Track 1", src: "https://example.com/a.mp3", artist: "demo" }',
      'track2 = { title: "Track 2", src: "https://example.com/b.mp3", artist: "demo", coverUrl: "https://example.com/b.png" }',
      'gallery = ImageGallery("画像候補", "選択式プレビュー", [img1, img2], 2)',
      'img1 = { src: "https://example.com/a.png", caption: "A" }',
      'img2 = { src: "https://example.com/b.png", caption: "B" }',
    ].join("\n");

    expect(() => validateOpenUILang(mediaOpenUILang)).not.toThrow();
    const markup = renderToStaticMarkup(React.createElement(Renderer, { response: mediaOpenUILang, library }));
    expect(markup).toContain('data-lg-widget="video-playlist"');
    expect(markup).toContain('data-lg-widget="audio-player"');
    expect(markup).toContain('data-lg-widget="image-gallery"');
    expect(markup).toContain("data-lg-embed-src");
    expect(markup).toContain("data-lg-audio-track");
    expect(markup).toContain("data-lg-audio-cover");
    expect(markup).toContain("data-lg-cover");
    expect(markup).toContain("data-lg-gallery-item");
  });

  it("validates long text and translation components", () => {
    const translationOpenUILang = [
      "root = Card([long, panel, compare])",
      'long = LongText("Policy Draft", "Readable long-form text", "", [s1, s2], "en", "draft.md", 360)',
      's1 = { heading: "Purpose", body: "This policy explains the review process.\\n\\nRead each section before approval." }',
      's2 = { heading: "Scope", body: "The policy applies to agent-authored UI artifacts." }',
      'panel = TranslationPanel("Translation", "Single translated result", "ja", "en", "原文です。", "This is the source text.", ["Keep product names unchanged."], [term1], 320)',
      'term1 = { source: "常駐ブローカー", target: "resident broker", note: "Keep consistent with docs." }',
      'compare = TranslationCompare("Bilingual Review", "Compare by segment", "ja", "en", [seg1, seg2], 420)',
      'seg1 = { id: "1", source: "最初の段落です。", translation: "This is the first paragraph.", status: "ok" }',
      'seg2 = { id: "2", source: "確認が必要です。", translation: "This needs review.", status: "review", note: "Check tone." }',
    ].join("\n");

    expect(() => validateOpenUILang(translationOpenUILang)).not.toThrow();
    expect(() =>
      renderToStaticMarkup(React.createElement(Renderer, { response: translationOpenUILang, library })),
    ).not.toThrow();
  });

  it("keeps all shipped examples parser-valid", () => {
    expect(genUIExamples.length).toBeGreaterThan(0);
    expect(genUIExamples.map((example) => example.name)).toEqual(
      expect.arrayContaining(["code-review", "context-timeseries", "research-brief", "support-triage", "data-quality"]),
    );
    for (const example of genUIExamples) {
      expect(() => validateOpenUILang(example.openuiLang)).not.toThrow();
    }
  });
});

describe("agent interface scaffold", () => {
  it("publishes direct OpenUI Lang CLI guidance", () => {
    expect(agentUsageGuide.preferredFlow.join("\n")).toContain("prompt-spec");
    expect(agentUsageGuide.quickStart.join("\n")).toContain("doctor");
    expect(agentUsageGuide.whenToUse.join("\n")).toContain("visual");
    expect(agentUsageGuide.preferredFlow.join("\n")).toContain("validate");
    expect(agentUsageGuide.cli.doctor).toContain("doctor");
    expect(agentUsageGuide.cli.agentSnippet).toContain("agent-snippet");
    expect(agentUsageGuide.cli.open).toContain("--openui-lang-file");
    expect(agentUsageGuide.cli.openAndWait).toContain("--wait");
    expect(agentUsageGuide.cli.open).toContain("genui popup");
    expect(agentUsageGuide.cli.artifacts).toContain("artifacts");
    expect(agentUsageGuide.cli.replay).toContain("replay");
    expect(agentUsageGuide.cli.resize).toContain("resize");
    expect(agentUsageGuide.purpose).toContain("The agent generates OpenUI Lang");
  });

  it("builds an OpenUI prompt spec with custom components", () => {
    const promptSpec = library.prompt(promptOptions);
    expect(promptSpec).toContain("MetricGrid");
    expect(promptSpec).toContain("Gauge");
    expect(promptSpec).toContain("ChecklistPanel");
    expect(promptSpec).toContain("InsightStack");
    expect(promptSpec).toContain("ActionPanel");
    expect(promptSpec).toContain("MapView");
    expect(promptSpec).toContain("VideoPlaylist");
  });

  it("builds broker-served CLI guidance for standalone commands", () => {
    const instructions = buildAgentInstructions();
    const snippet = buildAgentSnippet();
    expect(buildPromptSpec()).toContain("MetricGrid");
    expect(buildPromptSpec()).toContain("contextPath");
    expect(buildPromptSpec()).toContain("TranslationCompare");
    expect(snippet).toContain("genui doctor --json");
    expect(snippet).toContain("--context-file");
    expect(snippet).toContain("AGENTS.md");
    expect(instructions).toContain("genui prompt-spec");
    expect(instructions).toContain("genui doctor --json");
    expect(instructions).toContain("Component selection");
    expect(instructions).toContain("genui popup");
    expect(instructions.indexOf("genui validate")).toBeLessThan(instructions.indexOf("genui popup"));
  });

  it("keeps the packaged standalone CLI aligned with management commands", async () => {
    const source = await fs.readFile(path.join(process.cwd(), "scripts/genui-standalone-cli.mjs"), "utf8");

    expect(source).toContain("genui popups --active");
    expect(source).toContain("genui artifacts --limit 20");
    expect(source).toContain("genui close --all");
    expect(source).toContain("closeAll");
    expect(source).toContain('if (command === "popups")');
    expect(source).toContain('if (command === "artifacts")');
    expect(source).toContain('if (command === "replay")');
  });

  it("exposes a component catalog without duplicate names", () => {
    const names = componentCatalog.map((component) => component.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(["MetricGrid", "ActionPanel", "DataTable", "VideoPlaylist", "Gauge", "ChecklistPanel", "InsightStack", "LongText", "TranslationPanel", "TranslationCompare"]));
  });

  it("publishes MCP and interaction guidance", () => {
    expect(packageJson.scripts["genui:mcp"]).toBe("node scripts/genui-mcp-server.mjs");
    expect(packageJson.scripts["verify:visual-light"]).toBe("node scripts/verify-light-theme-visuals.mjs");
    expect(buildAgentInstructions()).toContain("actionId");
    expect(buildAgentInstructions()).toContain("genui:mcp");
  });

  it("normalizes YouTube watch and short URLs for inline embeds", () => {
    expect(resolveVideoEmbedSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "iframe",
      provider: "YouTube",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0",
    });
    expect(resolveVideoEmbedSource("https://youtu.be/aqz-KE-bpKQ?t=1m2s", { autoplay: true })).toEqual({
      kind: "iframe",
      provider: "YouTube",
      sourceUrl: "https://youtu.be/aqz-KE-bpKQ?t=1m2s",
      src: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?rel=0&autoplay=1&mute=1&start=62",
    });
    expect(resolveVideoEmbedSource("https://example.com/demo.mp4")).toEqual({
      kind: "native",
      src: "https://example.com/demo.mp4",
    });
  });
});

describe("window sizing", () => {
  it("publishes the expected popup size presets", () => {
    expect(WINDOW_SIZE_PRESETS).toEqual(
      expect.arrayContaining(["compact", "card", "panel", "default", "wide", "review", "tall", "stage", "cinema", "fullscreen"]),
    );
  });

  it("coerces invalid size presets to the requested fallback", () => {
    expect(coerceSizePreset("wide")).toBe("wide");
    expect(coerceSizePreset("unknown", "panel")).toBe("panel");
  });

  it("leaves fullscreen when custom resize dimensions are provided without a preset", () => {
    expect(resolveResizePreset(undefined, "fullscreen", true)).toBe("default");
    expect(resolveResizePreset(undefined, "fullscreen", false)).toBe("fullscreen");
    expect(resolveResizePreset("wide", "fullscreen", true)).toBe("wide");
  });

  it("resolves preset geometry and clamps custom dimensions to the display", () => {
    const geometry = resolveWindowGeometry({ width: 1440, height: 900 }, "review", {
      width: 2000,
      height: 300,
    });

    expect(geometry).toMatchObject({
      width: 1440,
      height: 300,
      minWidth: 960,
      minHeight: 300,
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

  it("builds preview URLs from current visual settings", () => {
    const settings = sanitizeSettings({
      theme: "light",
      design: {
        visualThemePreset: "studio",
        glassPreset: "milky",
        labelInkPreset: "blue",
        themeColorPreset: "violet",
        windowAnimationPreset: "fade",
      },
    });
    const url = new URL(
      buildPopupPreviewUrl({
        agentId: "codex agent",
        artifactId: "art_123",
        controlToken: "token+value",
        controlUrl: "http://127.0.0.1:48231",
        nextUrl: "http://127.0.0.1:3000",
        popupId: "pop_123",
        size: "review",
        themeParams: previewThemeParamsFromSettings(settings, "light"),
      }),
    );

    expect(url.pathname).toBe("/preview/art_123");
    expect(url.searchParams.get("popupId")).toBe("pop_123");
    expect(url.searchParams.get("controlUrl")).toBe("http://127.0.0.1:48231");
    expect(url.searchParams.get("theme")).toBe("light");
    expect(url.searchParams.get("animation")).toBe("fade");
    expect(url.searchParams.get("visualTheme")).toBe("studio");
    expect(url.searchParams.get("themeColor")).toBe("violet");
    expect(url.searchParams.get("agent")).toBe("codex agent");
  });

  it("updates an existing preview URL when settings change", () => {
    const original =
      "http://127.0.0.1:3000/preview/art_123?popupId=pop_123&controlUrl=http%3A%2F%2F127.0.0.1%3A48231&theme=dark&chrome=hud&token=token&size=review&animation=center&visualTheme=hud&themeColor=mint&agent=codex";
    const updated = new URL(
      applyPreviewThemeParams(original, {
        animation: "top",
        theme: "light",
        themeColor: "graphite",
        visualTheme: "workbench",
      }),
    );

    expect(updated.searchParams.get("popupId")).toBe("pop_123");
    expect(updated.searchParams.get("size")).toBe("review");
    expect(updated.searchParams.get("agent")).toBe("codex");
    expect(updated.searchParams.get("theme")).toBe("light");
    expect(updated.searchParams.get("animation")).toBe("top");
    expect(updated.searchParams.get("visualTheme")).toBe("workbench");
    expect(updated.searchParams.get("themeColor")).toBe("graphite");
  });

  it("reads live popup design update payloads defensively", () => {
    expect(
      readLiveDesignSettings({
        appearanceTheme: "light",
        animation: "fade",
        themeColor: "graphite",
        visualTheme: "workbench",
        ignored: true,
      }),
    ).toEqual({
      appearanceTheme: "light",
      animation: "fade",
      themeColor: "graphite",
      visualTheme: "workbench",
    });

    expect(readLiveDesignSettings(null)).toBeNull();
    expect(readLiveDesignSettings({ themeColor: 42 })).toEqual({});
  });
});

describe("theme CSS", () => {
  function extractVisualThemeBlock(css: string, visualTheme: string) {
    const blocks = Array.from(
      css.matchAll(new RegExp(`\\.lg-shell\\[data-visual-theme="${visualTheme}"\\] \\{([\\s\\S]*?)\\n\\}`, "g")),
    );
    expect(blocks.length).toBeGreaterThan(0);
    return blocks.at(-1)?.[1] ?? "";
  }

  it("lets non-HUD visual themes inherit accent tokens from theme color presets", async () => {
    const css = await fs.readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(/\.lg-shell\s*\{[\s\S]*?accent-color:\s*var\(--theme-frame\);/);

    for (const visualTheme of ["workbench", "studio", "briefing"]) {
      const block = extractVisualThemeBlock(css, visualTheme);
      expect(block).not.toMatch(/--theme-frame(?:-soft|-glow)?:/);
      expect(block).toContain("var(--theme-frame");
    }
  });

  it("keeps Studio readable when the resolved appearance is light", async () => {
    const css = await fs.readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="studio"\]\s*\{/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="studio"\][\s\S]*?--ink:\s*rgb\(26,\s*30,\s*36\);/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="studio"\][\s\S]*?--aether-window-tint:\s*rgb\(255,\s*252,\s*247\);/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="studio"\] \.lg-preview\s*\{/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="studio"\] \.lg-preview\s*\{[\s\S]*?--lg-component-panel-bg:\s*var\(--lg-component-panel-wash\);/);
  });

  it("keeps non-HUD visual themes distinct from light and dark appearance", async () => {
    const css = await fs.readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).toMatch(/\.lg-shell\[data-visual-theme="workbench"\][\s\S]*?--workbench-grid-line:/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="studio"\][\s\S]*?--studio-ruler:/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="briefing"\][\s\S]*?--briefing-spine:/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="briefing"\][\s\S]*?linear-gradient\(90deg,\s*var\(--briefing-spine\) 0 14px/);
    expect(extractVisualThemeBlock(css, "briefing")).not.toContain("0 58px");
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="workbench"\]\s*\{[\s\S]*?--aether-card-blur:\s*0px;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="workbench"\] \.lg-preview\s*\{[\s\S]*?--lg-component-panel-bg:\s*var\(--lg-component-panel-wash\);/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="studio"\] \.lg-preview\s*\{[\s\S]*?--lg-component-panel-bg:\s*var\(--lg-component-panel-wash\);/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-preview\s*\{[\s\S]*?--lg-component-panel-bg:\s*var\(--lg-component-panel-wash\);/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]:is\(\[data-visual-theme="workbench"\], \[data-visual-theme="studio"\], \[data-visual-theme="briefing"\]\) \.lg-preview :where\(section, article, li, \.openui-card-card, \.openui-card-sunk, \.lg-label-surface\)[\s\S]*?backdrop-filter:\s*none !important;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]:is\(\[data-visual-theme="workbench"\], \[data-visual-theme="studio"\], \[data-visual-theme="briefing"\]\) \.lg-preview :where\(\.openui-card-card, \.openui-card-sunk\)[\s\S]*?background-image:\s*none !important;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-preview :where\(\.openui-card-card, \.openui-card-sunk\)[\s\S]*?background-image:\s*none;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-row\s*\{[\s\S]*?var\(--theme-frame\)/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-preview :where\(article, li\)[\s\S]*?background-image:\s*none !important;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-preview \.lg-label-surface[\s\S]*?background-image:\s*none !important;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-preview\s*\{[\s\S]*?--lg-tone-emphasis-shadow:\s*var\(--lg-component-readable-shadow\);/);
    expect(css).toMatch(/--lg-tone-positive-bg:\s*rgb\(226,\s*246,\s*235\);/);
    expect(css).toMatch(/--lg-tone-info-bg:\s*rgb\(229,\s*240,\s*255\);/);
    expect(css).toMatch(/--lg-tone-warning-bg:\s*rgb\(255,\s*244,\s*217\);/);
    expect(css).toMatch(/--lg-tone-danger-bg:\s*rgb\(255,\s*233,\s*238\);/);
    expect(css).not.toMatch(/\.lg-shell\[data-appearance-theme="light"\]\[data-visual-theme="briefing"\] \.lg-preview :where\(article, li\)\s*\{[\s\S]*?background:\s*color-mix\(in srgb,\s*var\(--theme-frame\)/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="workbench"\][\s\S]*?--visual-control-radius:\s*6px;/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="studio"\][\s\S]*?--visual-control-radius:\s*7px;/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="briefing"\][\s\S]*?--visual-control-radius:\s*4px;/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="dark"\]\[data-visual-theme="workbench"\]\s*\{/);
    expect(css).toMatch(/\.lg-shell\[data-appearance-theme="dark"\]\[data-visual-theme="briefing"\]\s*\{/);
    expect(css).toMatch(/\.lg-shell\[data-visual-theme="briefing"\] \.lg-preview\s*\{[\s\S]*?--lg-component-panel-bg:[\s\S]*?--briefing-spine/);
    expect(css).toMatch(/\.lg-shell:not\(\[data-visual-theme="hud"\]\) \.lg-preview :where\(\.openui-card-card, \.openui-card-sunk\)[\s\S]*?border-radius:\s*var\(--visual-component-radius/);
  });

  it("lets component tone colors override theme accents in light briefing", async () => {
    const librarySource = await fs.readFile(path.join(process.cwd(), "src/library.ts"), "utf8");

    expect(librarySource).toContain("--lg-tone-emphasis-shadow");
  });

  it("ships standalone HTML interaction recovery for downloaded previews", async () => {
    const source = await fs.readFile(path.join(process.cwd(), "src/app/preview/[artifactId]/PreviewClient.tsx"), "utf8");

    expect(source).toContain("standaloneInteractionScript");
    expect(source).toContain('[role="tablist"]');
    expect(source).toContain('[data-lg-widget="audio-player"]');
    expect(source).toContain('[data-lg-widget="video-playlist"]');
    expect(source).toContain('[data-lg-widget="image-gallery"]');
    expect(source).toContain('current.style.gridTemplateColumns = coverUrl ? "88px 1fr" : "1fr"');
    expect(source).toContain('cover.removeAttribute("src")');
    expect(source).toContain('<meta name="color-scheme" content="light dark">');
    expect(source).toContain('<meta name="referrer" content="strict-origin-when-cross-origin">');
    expect(source).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });

  it("does not keep the popup frame running ambient animations while idle", async () => {
    const css = await fs.readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");

    expect(css).not.toMatch(/lg-frame-spin\s+[\d.]+s\s+linear\s+infinite/);
    expect(css).not.toMatch(/lg-frame-ring-pulse\s+[\d.]+s\s+ease-in-out\s+infinite/);
    expect(css).not.toMatch(/lg-window-frame-glow-pulse\s+[\d.]+s\s+ease-in-out\s+infinite/);
    expect(css).not.toMatch(/will-change:\s*--frame-spin/);
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
