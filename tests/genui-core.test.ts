import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadArtifact } from "../src/server/genui/artifacts";
import { readBrokerState, writeBrokerState } from "../src/server/genui/broker-state";
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
