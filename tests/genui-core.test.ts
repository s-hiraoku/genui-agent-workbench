import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { loadArtifact } from "../src/server/genui/artifacts";
import { readBrokerState, writeBrokerState } from "../src/server/genui/broker-state";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { renderGenUI } from "../src/server/genui/render";

const genuiDir = path.join(process.cwd(), ".genui");

beforeEach(async () => {
  process.env.GENUI_MOCK_RENDER = "1";
  await fs.rm(genuiDir, { force: true, recursive: true });
});

afterEach(async () => {
  delete process.env.GENUI_MOCK_RENDER;
  await fs.rm(genuiDir, { force: true, recursive: true });
});

describe("renderGenUI", () => {
  it("normalizes input and stores an artifact", async () => {
    const result = await renderGenUI({
      prompt: "売上ダッシュボードを作って",
      agentId: "test-agent",
      title: "Sales Popup",
    });

    expect(result.artifact.artifactId).toMatch(/^art_/);
    expect(result.artifact.agentId).toBe("test-agent");
    expect(result.artifact.title).toBe("Sales Popup");
    expect(result.artifact.generationMode).toBe("fallback");
    expect(result.artifact.locale).toBe("ja");
    expect(result.previewPath).toBe(`/preview/${result.artifact.artifactId}`);

    const saved = await loadArtifact(result.artifact.artifactId);
    expect(saved?.openuiLang).toContain("root = Card");
  });

  it("rejects empty prompts", async () => {
    await expect(renderGenUI({ prompt: "   " })).rejects.toThrow("prompt is required");
  });

  it("uses MapView in mock fallback for map prompts", async () => {
    const result = await renderGenUI({
      prompt: "東京の顧客拠点を地図で表示して",
      agentId: "test-agent",
    });

    expect(result.artifact.openuiLang).toContain("MapView");
    expect(result.artifact.openuiLang).toContain("tokyo");
  });

  it("uses MetricGrid and ActionPanel in sales fallback", async () => {
    const result = await renderGenUI({
      prompt: "売上ダッシュボードを作って。KPIと次のアクションを表示して。",
      agentId: "test-agent",
    });

    expect(result.artifact.openuiLang).toContain("MetricGrid");
    expect(result.artifact.openuiLang).toContain("ActionPanel");
  });

  it("uses support-focused fallback for support prompts", async () => {
    const result = await renderGenUI({
      prompt: "顧客サポートの状況を可視化して。緊急度別のカードと推奨アクションを出して。",
      agentId: "test-agent",
    });

    expect(result.artifact.mockData).toBe("support");
    expect(result.artifact.openuiLang).toContain("Support health");
    expect(result.artifact.openuiLang).toContain("ActionPanel");
  });

  it("uses TimelinePanel in timeline fallback", async () => {
    const result = await renderGenUI({
      prompt: "障害対応の流れをタイムラインで説明して",
      mockData: "none",
    });

    expect(result.artifact.openuiLang).toContain("TimelinePanel");
  });

  it("uses DecisionMatrix in decision fallback", async () => {
    const result = await renderGenUI({
      prompt: "3つの案を比較して推奨案を出して",
      mockData: "none",
    });

    expect(result.artifact.openuiLang).toContain("DecisionMatrix");
  });

  it("uses AudioPlayer in mock fallback for audio prompts", async () => {
    const result = await renderGenUI({
      prompt: "音楽プレーヤーを表示して",
      agentId: "test-agent",
    });

    expect(result.artifact.openuiLang).toContain("AudioPlayer");
  });

  it("uses VideoPlayer in mock fallback for video prompts", async () => {
    const result = await renderGenUI({
      prompt: "動画プレーヤーを表示して",
      agentId: "test-agent",
    });

    expect(result.artifact.openuiLang).toContain("VideoPlayer");
  });
});

describe("agent interface scaffold", () => {
  it("documents custom components for agents", () => {
    expect(componentCatalog.map((item) => item.name)).toEqual(
      expect.arrayContaining([
        "MetricGrid",
        "ActionPanel",
        "TimelinePanel",
        "DecisionMatrix",
        "MapView",
        "AudioPlayer",
        "VideoPlayer",
      ]),
    );
  });

  it("exposes an agent usage guide with CLI and MCP affordances", () => {
    expect(agentUsageGuide.cli.open).toContain("npm run genui -- popup");
    expect(agentUsageGuide.mcpTools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["genui.open_popup", "genui.close_popup", "genui.list_components", "genui.usage_guide"]),
    );
  });
});

describe("broker state", () => {
  it("persists the current local control URL", async () => {
    await writeBrokerState({
      controlUrl: "http://127.0.0.1:48231",
      nextUrl: "http://127.0.0.1:3000",
      pid: 123,
      brokerProtocolVersion: "0.2.0",
      appVersion: "0.1.0",
      updatedAt: "2026-05-22T00:00:00.000Z",
    });

    await expect(readBrokerState()).resolves.toMatchObject({
      controlUrl: "http://127.0.0.1:48231",
      nextUrl: "http://127.0.0.1:3000",
    });
  });
});
