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
      components: ["MetricGrid", "ActionPanel"],
      size: "panel",
    },
    {
      intent: "Incident/Timeline",
      prompt: "障害対応の流れをタイムラインで説明し、今すぐやることを出して。",
      components: ["TimelinePanel", "ActionPanel"],
      size: "tall",
    },
    {
      intent: "Decision",
      prompt: "候補案を比較して、推奨案と理由を視覚的に説明して。",
      components: ["DecisionMatrix", "ActionPanel"],
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
    "Do not claim external live data or MCP-backed tools were used unless the caller supplied that data.",
    "Keep prompts outcome-oriented: tell the broker what the user needs to understand or decide.",
  ],
} as const;
