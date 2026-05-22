export type ComponentCatalogItem = {
  name: string;
  category: string;
  description: string;
  useCases: string[];
  examplePrompt: string;
};

export const componentCatalog: ComponentCatalogItem[] = [
  {
    name: "MetricGrid",
    category: "Agent Explanation",
    description: "Responsive KPI/status grid for dashboards, health checks, progress summaries, and executive snapshots.",
    useCases: ["KPI dashboard", "health summary", "progress report", "risk snapshot", "agent status overview"],
    examplePrompt: "プロジェクトの状況をKPIカードで要約して。リスクと次の判断も見せて。",
  },
  {
    name: "ActionPanel",
    category: "Agent Explanation",
    description: "Prioritized next-action panel with owner, due date, and severity for agent recommendations.",
    useCases: ["next actions", "handoff", "approval workflow", "support escalation", "agent plan"],
    examplePrompt: "この調査結果から、優先度付きの次アクションをユーザーに見せて。",
  },
  {
    name: "TimelinePanel",
    category: "Agent Explanation",
    description: "Chronological timeline for incidents, launches, research, deployments, and multi-step explanations.",
    useCases: ["incident timeline", "release plan", "research history", "deployment progress", "workflow explanation"],
    examplePrompt: "障害対応の流れをタイムラインで説明して。完了・進行中・次の予定を分けて。",
  },
  {
    name: "DecisionMatrix",
    category: "Agent Explanation",
    description: "Option comparison panel for recommendations, tradeoffs, vendor/tool choices, and design decisions.",
    useCases: ["decision support", "tradeoff comparison", "tool selection", "design alternatives", "recommendation"],
    examplePrompt: "3つの実装案を比較して、推奨案と理由を視覚的に説明して。",
  },
  {
    name: "DataTable",
    category: "Agent Explanation",
    description: "Responsive table for operational rows, tickets, file lists, research results, rankings, and evidence.",
    useCases: ["ticket list", "search results", "file inventory", "ranked options", "structured evidence"],
    examplePrompt: "このJSON rowsを表で表示して。重要な行と次のアクションも示して。",
  },
  {
    name: "TaskBoard",
    category: "Agent Explanation",
    description: "Compact board for task queues, implementation plans, triage lanes, QA status, and multi-agent handoffs.",
    useCases: ["task board", "agent plan", "handoff", "triage queue", "QA workflow"],
    examplePrompt: "この作業をTodo/Doing/Doneのボードで表示して。担当と状態も見せて。",
  },
  {
    name: "CodeDiff",
    category: "Agent Explanation",
    description: "Readable diff viewer for code, configuration, prompt, document, and migration review.",
    useCases: ["code review", "config diff", "patch preview", "prompt changes", "migration review"],
    examplePrompt: "この変更差分をレビュー用UIで表示して。追加・削除と確認ポイントも見せて。",
  },
  {
    name: "MapView",
    category: "Maps",
    description: "OpenStreetMap-backed map panel with center, zoom, height, and colored markers.",
    useCases: ["customer locations", "store/site maps", "routes", "incidents", "nearby places"],
    examplePrompt: "東京の顧客拠点を地図で表示して。優先度別にマーカーを分けて。",
  },
  {
    name: "AudioPlayer",
    category: "Media",
    description: "Playlist-style audio player for music, voice notes, podcasts, recordings, and generated audio.",
    useCases: ["music preview", "voice note review", "meeting recordings", "podcasts", "generated speech"],
    examplePrompt: "音声メモをプレーヤーで表示して。概要と再生リストも付けて。",
  },
  {
    name: "VideoPlayer",
    category: "Media",
    description: "Video player with poster, chapters, and transcript support for demos, clips, recordings, and walkthroughs.",
    useCases: ["screen recordings", "feature demos", "tutorials", "incident evidence", "generated clips"],
    examplePrompt: "デモ動画をチャプター付きで表示して。重要な場面もまとめて。",
  },
];
