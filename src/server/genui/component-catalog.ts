export type ComponentCatalogItem = {
  name: string;
  category: string;
  description: string;
  useCases: string[];
  examplePrompt: string;
};

export const componentCatalog: ComponentCatalogItem[] = [
  {
    name: "Label",
    category: "Agent Explanation",
    description: "Reusable Liquid Glass label/badge for status, priority, count, tag, and compact text surfaces. Supports glassPreset and inkPreset.",
    useCases: ["status badge", "priority label", "tag", "count pill", "compact metadata"],
    examplePrompt: "ステータスや優先度はLabelで表示して。glassPresetも使って。",
  },
  {
    name: "MetricGrid",
    category: "Agent Explanation",
    description: "Responsive KPI/status grid for dashboards, health checks, progress summaries, and executive snapshots.",
    useCases: ["KPI dashboard", "health summary", "progress report", "risk snapshot", "agent status overview"],
    examplePrompt: "プロジェクトの状況をKPIカードで要約して。リスクと次の判断も見せて。",
  },
  {
    name: "KeyValuePanel",
    category: "Agent Explanation",
    description: "Dense facts panel for metadata, environment details, customer info, config summaries, and evidence.",
    useCases: ["metadata", "environment info", "customer facts", "config summary", "evidence"],
    examplePrompt: "この調査結果の重要メタデータをkey-value形式で整理して。",
  },
  {
    name: "AlertList",
    category: "Agent Explanation",
    description: "Risk, blocker, warning, validation, incident, and confirmation list with severity and actions.",
    useCases: ["risks", "warnings", "blockers", "validation errors", "incident signals"],
    examplePrompt: "リスクと警告をseverity別に表示して。各項目に推奨アクションも付けて。",
  },
  {
    name: "ProgressStepper",
    category: "Agent Explanation",
    description: "Step-by-step progress tracker for workflows, approvals, investigations, releases, and onboarding.",
    useCases: ["workflow progress", "approval steps", "release checklist", "investigation", "onboarding"],
    examplePrompt: "この作業の進捗をステップ表示して。完了・進行中・未着手を分けて。",
  },
  {
    name: "BarChart",
    category: "Charts",
    description: "Horizontal bar chart for rankings, category comparison, counts, volume, cost, and risk.",
    useCases: ["ranking", "category comparison", "counts", "cost breakdown", "risk scoring"],
    examplePrompt: "カテゴリ別の件数を棒グラフで比較して。",
  },
  {
    name: "LineChart",
    category: "Charts",
    description: "Compact trend chart for time series, forecasts, backlog movement, and metric changes.",
    useCases: ["trend", "forecast", "time series", "backlog movement", "metric history"],
    examplePrompt: "直近7日の推移を折れ線グラフで表示して。",
  },
  {
    name: "ResourceList",
    category: "Agent Explanation",
    description: "Resource list for files, URLs, documents, generated artifacts, and handoff references.",
    useCases: ["file links", "references", "documents", "generated artifacts", "handoff materials"],
    examplePrompt: "関連ファイルと参考URLをリソース一覧として表示して。",
  },
  {
    name: "FormPanel",
    category: "Agent Explanation",
    description: "Read-only form/input review for intake, approval, missing-field checks, and user confirmation.",
    useCases: ["intake form", "approval request", "missing fields", "confirmation", "request review"],
    examplePrompt: "入力内容をフォーム確認UIで表示して。不足項目も示して。",
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
