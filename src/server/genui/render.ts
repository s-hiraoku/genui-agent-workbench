import OpenAI from "openai";
import { library, promptOptions } from "../../library";
import { getMockData, selectMockDataMode } from "./mock-context";
import { saveArtifact } from "./artifacts";
import type {
  GenUIArtifact,
  GenUIGenerationMode,
  GenUILocale,
  GenUIMockDataMode,
  RenderGenUIInput,
  RenderGenUIResult,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function detectLocale(prompt: string, requested: GenUILocale = "auto"): GenUILocale {
  if (requested !== "auto") {
    return requested;
  }

  return /[\u3040-\u30ff\u3400-\u9fff]/.test(prompt) ? "ja" : "en";
}

function normalizeInput(input: RenderGenUIInput): Required<Pick<RenderGenUIInput, "prompt" | "mockData" | "locale">> &
  Omit<RenderGenUIInput, "prompt" | "mockData" | "locale"> {
  const prompt = input.prompt?.trim();

  if (!prompt) {
    throw new Error("prompt is required");
  }

  return {
    ...input,
    prompt,
    mockData: input.mockData ?? "auto",
    locale: input.locale ?? "auto",
  };
}

function buildSystemPrompt(input: ReturnType<typeof normalizeInput>, selectedMockData: GenUIMockDataMode): string {
  const mockData = getMockData(selectedMockData, input.prompt);
  const locale = detectLocale(input.prompt, input.locale);

  return [
    library.prompt(promptOptions),
    "You are GenUI Popup Broker, a local tool used by other AI agents.",
    "Generate a single OpenUI Lang response that can be rendered in a compact popup window.",
    "Do not answer in Markdown prose. Return only OpenUI Lang code.",
    "Every response must be useful as an interactive or scannable UI: cards, KPI summaries, tables, action blocks, forms, lists, or follow-up suggestions.",
    "Do not claim MCP or live external data was used unless it is present in the supplied context.",
    "For this implementation, embed supplied data directly in the OpenUI Lang output. Do not use Query() or Mutation().",
    "When the user asks for maps, locations, stores, sites, routes, incidents, or geography, include MapView with center coordinates and meaningful markers.",
    "When the user asks for music, audio, recordings, podcasts, voice notes, or sound previews, include AudioPlayer. Never autoplay.",
    "When the user asks for video, demos, screen recordings, clips, tutorials, or walkthroughs, include VideoPlayer. Never autoplay.",
    locale === "ja" ? "Use concise Japanese labels and copy." : "Use concise English labels and copy.",
    "",
    "Caller context:",
    JSON.stringify(
      {
        agentId: input.agentId,
        title: input.title,
        context: input.context,
        mockData,
      },
      null,
      2,
    ),
  ].join("\n");
}

function createFallbackOpenUILang(input: ReturnType<typeof normalizeInput>): string {
  const title = input.title ?? "GenUI Popup";
  const prompt = input.prompt.replaceAll("\"", "\\\"");
  const wantsMap = /map|地図|location|locations|拠点|店舗|住所|ルート|route|nearby|周辺|geo|incident|現場/i.test(input.prompt);
  const wantsAudio = /audio|music|sound|podcast|voice|recording|音楽|音声|録音|ポッドキャスト|曲|サウンド/i.test(input.prompt);
  const wantsVideo = /video|movie|clip|screen recording|demo|walkthrough|動画|映像|録画|デモ|チュートリアル/i.test(input.prompt);

  if (wantsMap) {
    return [
      "root = Card([header, map, actions])",
      `header = CardHeader("${title.replaceAll("\"", "\\\"")}", "Generated locally by GenUI Popup Broker")`,
      'map = MapView("東京周辺マップ", "サンプル地点を表示しています。実データがある場合はagent contextから座標を渡してください。", { lat: 35.6812, lng: 139.7671 }, 11, 360, [tokyo, shinjuku, shinagawa])',
      'tokyo = { lat: 35.6812, lng: 139.7671, label: "Tokyo", description: "Central reference point", color: "red" }',
      'shinjuku = { lat: 35.6909, lng: 139.7003, label: "Shinjuku", description: "Sample west-side site", color: "yellow" }',
      'shinagawa = { lat: 35.6285, lng: 139.7388, label: "Shinagawa", description: "Sample south-side site", color: "green" }',
      "actions = FollowUpBlock([done])",
      "done = FollowUpItem(\"Close this popup when finished\")",
    ].join("\n");
  }

  if (wantsAudio) {
    return [
      "root = Card([header, player, actions])",
      `header = CardHeader("${title.replaceAll("\"", "\\\"")}", "Generated locally by GenUI Popup Broker")`,
      'player = AudioPlayer("音声プレビュー", "デモ用の音声サンプルです。実データがある場合はagent contextから音声URLを渡してください。", [track1])',
      'track1 = { title: "Sample audio", artist: "GenUI Broker", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3", description: "AudioPlayer rendering sample" }',
      "actions = FollowUpBlock([done])",
      "done = FollowUpItem(\"Close this popup when finished\")",
    ].join("\n");
  }

  if (wantsVideo) {
    return [
      "root = Card([header, video, actions])",
      `header = CardHeader("${title.replaceAll("\"", "\\\"")}", "Generated locally by GenUI Popup Broker")`,
      'video = VideoPlayer("動画プレビュー", "デモ用の動画サンプルです。実データがある場合はagent contextから動画URLを渡してください。", "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", null, "VideoPlayer rendering sample.", [chapter1])',
      'chapter1 = { time: "00:00", title: "Preview starts", description: "Use chapters to summarize important moments." }',
      "actions = FollowUpBlock([done])",
      "done = FollowUpItem(\"Close this popup when finished\")",
    ].join("\n");
  }

  return [
    "root = Card([header, summary, actions])",
    `header = CardHeader("${title.replaceAll("\"", "\\\"")}", "Generated locally by GenUI Popup Broker")`,
    `summary = TextContent("${prompt}", "default")`,
    "actions = FollowUpBlock([done])",
    "done = FollowUpItem(\"Close this popup when finished\")",
  ].join("\n");
}

export async function renderGenUI(input: RenderGenUIInput): Promise<RenderGenUIResult> {
  const normalized = normalizeInput(input);
  const selectedMockData = selectMockDataMode(normalized.prompt, normalized.mockData);
  const locale = detectLocale(normalized.prompt, normalized.locale);
  const model = process.env.OPENAI_MODEL ?? "gpt-5.2";
  let openuiLang: string;
  let generationMode: GenUIGenerationMode;

  if (!process.env.OPENAI_API_KEY || process.env.GENUI_MOCK_RENDER === "1") {
    openuiLang = createFallbackOpenUILang(normalized);
    generationMode = "fallback";
  } else {
    const client = new OpenAI();
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: buildSystemPrompt(normalized, selectedMockData) },
        { role: "user", content: normalized.prompt },
      ],
    });

    openuiLang = response.choices[0]?.message.content?.trim() || createFallbackOpenUILang(normalized);
    generationMode = response.choices[0]?.message.content?.trim() ? "llm" : "fallback";
  }

  const artifact: GenUIArtifact = {
    artifactId: createId("art"),
    prompt: normalized.prompt,
    agentId: normalized.agentId,
    title: normalized.title ?? `${normalized.agentId ?? "Agent"} GenUI`,
    openuiLang,
    createdAt: new Date().toISOString(),
    generationMode,
    model,
    locale,
    mockData: selectedMockData,
    context: normalized.context,
    requiredTools: [],
  };

  await saveArtifact(artifact);

  return {
    artifact,
    previewPath: `/preview/${artifact.artifactId}`,
  };
}
