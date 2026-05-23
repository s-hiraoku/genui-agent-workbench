import { BROKER_PROTOCOL_VERSION } from "./version";

export const agentUsageGuide = {
  brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
  purpose:
    "Use GenUI Popup Broker when an AI agent needs to explain something visually to a human with a temporary local popup.",
  preferredFlow: [
    "Check broker availability with status.",
    "Inspect components if choosing a UI shape programmatically.",
    "Call open_popup or CLI popup with prompt, agentId, title, context, and size.",
    "Return popupId and previewUrl to the calling workflow.",
    "Close the popup when the UI is no longer useful.",
  ],
  cli: {
    open:
      "npm run genui -- popup --agent-id <agent> --title <title> --size panel --prompt \"<visual explanation request>\"",
    openWithContext:
      "npm run genui -- popup --agent-id <agent> --prompt-file prompt.txt --context-file context.json --size wide",
    close: "npm run genui -- close --popup-id <popupId>",
    inspect: ["npm run genui -- status", "npm run genui -- components", "npm run genui -- guide"],
  },
  mcpTools: [
    {
      name: "genui.open_popup",
      whenToUse: "Open a visual explanation popup for a prompt/context.",
      input: "{ prompt, agentId?, title?, context?, mockData?, locale?, size?, width?, height? }",
    },
    {
      name: "genui.close_popup",
      whenToUse: "Close a popup once the workflow is done.",
      input: "{ popupId }",
    },
    {
      name: "genui.list_components",
      whenToUse: "Discover available visual components before choosing a UI shape.",
      input: "{}",
    },
    {
      name: "genui.usage_guide",
      whenToUse: "Fetch this guide for agent-side planning.",
      input: "{}",
    },
  ],
  promptPatterns: [
    {
      intent: "Status/KPI",
      prompt: "この状況をKPIカード、リスク、次アクションで視覚化して。",
      components: ["MetricGrid", "AlertList", "ActionPanel"],
      size: "panel",
    },
    {
      intent: "Facts/metadata",
      prompt: "この調査結果の重要メタデータをkey-value形式で整理して。",
      components: ["KeyValuePanel", "ResourceList"],
      size: "panel",
    },
    {
      intent: "Charts",
      prompt: "カテゴリ別の件数と直近推移をチャートで表示して。",
      components: ["BarChart", "LineChart"],
      size: "wide",
    },
    {
      intent: "Input review",
      prompt: "入力内容をフォーム確認UIで表示して。不足項目も示して。",
      components: ["FormPanel", "AlertList"],
      size: "panel",
    },
    {
      intent: "Incident/Timeline",
      prompt: "障害対応の流れをタイムラインで説明し、今すぐやることを出して。",
      components: ["TimelinePanel", "ProgressStepper", "AlertList", "ActionPanel"],
      size: "tall",
    },
    {
      intent: "Decision",
      prompt: "候補案を比較して、推奨案と理由を視覚的に説明して。",
      components: ["DecisionMatrix", "ActionPanel"],
      size: "wide",
    },
    {
      intent: "Structured rows",
      prompt: "このrowsを表で表示して。重要な行と次アクションも示して。",
      components: ["DataTable", "ActionPanel"],
      size: "wide",
    },
    {
      intent: "Task handoff",
      prompt: "作業状況をTodo/Doing/Doneのボードで表示して。担当と状態も見せて。",
      components: ["TaskBoard", "ActionPanel"],
      size: "wide",
    },
    {
      intent: "Change review",
      prompt: "この変更差分をレビュー用UIで表示して。追加・削除と確認ポイントも見せて。",
      components: ["CodeDiff", "ActionPanel"],
      size: "wide",
    },
    {
      intent: "Map",
      prompt: "拠点や顧客を地図で表示し、優先度別にマーカーを分けて。",
      components: ["MapView"],
      size: "stage",
    },
    {
      intent: "Media",
      prompt: "音声または動画を再生できるUIにして、チャプターと要点を添えて。",
      components: ["AudioPlayer", "VideoPlayer"],
      size: "cinema",
    },
  ],
  guardrails: [
    "Never include secrets in prompt or context.",
    "Pass concrete data in context when available instead of asking the broker to invent it.",
    "Use size presets before custom width/height.",
    "For CLI calls, prefer --context-file for structured data and --prompt-file for long prompts.",
    "Do not claim external live data or MCP-backed tools were used unless the caller supplied that data.",
    "Keep prompts outcome-oriented: tell the broker what the user needs to understand or decide.",
    'The shell theme color accepts themeColorPreset ("blue", "cyan", "violet", "mint", "rose", "amber", "white"). Default is blue.',
    'Liquid Glass components accept glassPreset ("clear", "pane", "milky", "dense", "mint", "sky", "rose", "amber"), plus glassColor and glassOpacity overrides.',
    'Label accepts inkPreset ("green", "slate", "white", "blue", "amber", "red"). Prefer green on milky labels for readability.',
    'Window opening animation accepts windowAnimationPreset ("center", "left", "right", "top", "fade").',
  ],
} as const;
