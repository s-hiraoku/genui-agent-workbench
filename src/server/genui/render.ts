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
  const design = input.design;

  return [
    library.prompt(promptOptions),
    "You are GenUI Popup Broker, a local tool used by other AI agents.",
    "Generate a single OpenUI Lang response that can be rendered in a compact popup window.",
    "Do not answer in Markdown prose. Return only OpenUI Lang code.",
    "Every response must be useful as an interactive or scannable UI: cards, KPI summaries, tables, action blocks, forms, lists, or follow-up suggestions.",
    "Prefer the broker's custom explanation components when they fit: MetricGrid for KPI/status summaries, ActionPanel for next actions, TimelinePanel for chronological explanations, DecisionMatrix for choices/tradeoffs.",
    "Do not claim MCP or live external data was used unless it is present in the supplied context.",
    "For this implementation, embed supplied data directly in the OpenUI Lang output. Do not use Query() or Mutation().",
    "When the user asks for maps, locations, stores, sites, routes, incidents, or geography, include MapView with center coordinates and meaningful markers.",
    "When the user asks for music, audio, recordings, podcasts, voice notes, or sound previews, include AudioPlayer. Never autoplay.",
    "When the user asks for video, demos, screen recordings, clips, tutorials, or walkthroughs, include VideoPlayer. Never autoplay.",
    design
      ? `Use the configured Liquid Glass defaults unless the user explicitly asks otherwise: themeColorPreset="${design.themeColorPreset}", glassPreset="${design.glassPreset}", Label inkPreset="${design.labelInkPreset}". Window animation is handled by the shell as "${design.windowAnimationPreset}".`
      : "Use the default Liquid Glass preset and readable Label ink preset.",
    locale === "ja" ? "Use concise Japanese labels and copy." : "Use concise English labels and copy.",
    "",
    "Caller context:",
    JSON.stringify(
      {
        agentId: input.agentId,
        title: input.title,
        context: input.context,
        design: input.design,
        mockData,
      },
      null,
      2,
    ),
  ].join("\n");
}

function q(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
}

function openUiLiteral(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "string") return `"${q(value)}"`;
  if (value === null || value === undefined) return "\"\"";
  return `"${q(JSON.stringify(value))}"`;
}

function objectLiteral(record: Record<string, unknown>): string {
  return `{ ${Object.entries(record)
    .map(([key, value]) => `${key}: ${openUiLiteral(value)}`)
    .join(", ")} }`;
}

function recordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
}

function contextRows(input: ReturnType<typeof normalizeInput>): Record<string, unknown>[] {
  const context = input.context;
  if (!context) return [];
  return recordArray(context.rows).length ? recordArray(context.rows) : recordArray(context.items).length ? recordArray(context.items) : recordArray(context.records);
}

function contextColumns(input: ReturnType<typeof normalizeInput>, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const explicitColumns = recordArray(input.context?.columns);
  if (explicitColumns.length > 0) {
    return explicitColumns.slice(0, 8).map((column) => ({
      key: String(column.key ?? column.id ?? column.label ?? ""),
      label: String(column.label ?? column.key ?? column.id ?? ""),
      align: column.align,
    }));
  }

  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);
  return keys.map((key) => ({ key, label: key }));
}

function createContextTableOpenUILang(input: ReturnType<typeof normalizeInput>, rows: Record<string, unknown>[]): string {
  const title = input.title ?? "Context Table";
  const columns = contextColumns(input, rows).filter((column) => column.key && column.label);
  const visibleRows = rows.slice(0, 12);
  const lines = [
    "root = Card([header, table, actions])",
    `header = CardHeader("${q(title)}", "Structured context rendered as a practical GenUI table")`,
    `table = DataTable("Context rows", "Rows supplied by the calling agent", [${columns.map((_, index) => `c${index + 1}`).join(", ")}], [${visibleRows
      .map((_, index) => `r${index + 1}`)
      .join(", ")}], "Showing ${visibleRows.length} of ${rows.length} rows")`,
    ...columns.map((column, index) => `c${index + 1} = ${objectLiteral(column)}`),
    ...visibleRows.map((row, index) => {
      const projected = Object.fromEntries(columns.map((column) => [String(column.key), row[String(column.key)]]));
      return `r${index + 1} = ${objectLiteral(projected)}`;
    }),
    "actions = ActionPanel(\"次のアクション\", \"この表を使ってagentが次にできること\", [a1, a2])",
    "a1 = { label: \"重要行を絞り込んで再生成\", priority: \"medium\", owner: \"agent\", description: \"context rowsを減らすとより焦点の合ったUIになります\" }",
    "a2 = { label: \"判断結果を呼び出し元へ返す\", priority: \"low\", owner: \"user\" }",
  ];

  return lines.join("\n");
}

function designArg(input: ReturnType<typeof normalizeInput>): string {
  return input.design?.glassPreset ? `, "${q(input.design.glassPreset)}"` : "";
}

function numericContextPoints(rows: Record<string, unknown>[]): Array<{ label: string; value: number }> {
  return rows
    .map((row, index) => {
      const label = String(row.label ?? row.name ?? row.app ?? row.application ?? row.title ?? `Item ${index + 1}`);
      const rawValue = row.value ?? row.downloads ?? row.count ?? row.total;
      const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
      return Number.isFinite(value) ? { label, value } : null;
    })
    .filter((point): point is { label: string; value: number } => Boolean(point));
}

function createContextLineChartOpenUILang(input: ReturnType<typeof normalizeInput>, rows: Record<string, unknown>[]): string | null {
  const points = numericContextPoints(rows).slice(0, 10);
  if (points.length === 0) return null;

  const title = input.title ?? "Download Report";
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const top = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const average = Math.round(total / points.length);
  const glass = designArg(input);
  return [
    "root = Card([header, metrics, trend, actions])",
    `header = CardHeader("${q(title)}", "アプリ別ダウンロード数のサンプルレポート"${glass})`,
    `metrics = MetricGrid("Summary", "対象アプリ ${points.length} 件", [m1, m2, m3]${glass})`,
    `m1 = { label: "Total", value: "${total.toLocaleString()}", tone: "positive", description: "全アプリの合計ダウンロード数" }`,
    `m2 = { label: "Top app", value: "${q(top.label)}", delta: "${top.value.toLocaleString()}", tone: "info", description: "最もダウンロードされたアプリ" }`,
    `m3 = { label: "Average", value: "${average.toLocaleString()}", tone: "neutral", description: "アプリあたりの平均" }`,
    `trend = LineChart("Downloads by app", "アプリ別のダウンロード数を折れ線で比較", " downloads", [${points
      .map((_, index) => `p${index + 1}`)
      .join(", ")}]${glass})`,
    ...points.map((point, index) => `p${index + 1} = { label: "${q(point.label)}", value: ${point.value} }`),
    `actions = ActionPanel("読み取りポイント", "このレポートから見えること", [a1, a2]${glass})`,
    `a1 = { label: "${q(top.label)} が最大", priority: "high", owner: "report", description: "${top.value.toLocaleString()} downloadsで最も強い需要があります" }`,
    `a2 = { label: "平均との差を確認", priority: "medium", owner: "report", description: "平均 ${average.toLocaleString()} downloads を基準に伸びしろを比較できます" }`,
  ].join("\n");
}

function createFallbackOpenUILang(input: ReturnType<typeof normalizeInput>): string {
  const title = input.title ?? "GenUI Popup";
  const prompt = q(input.prompt);
  const wantsMap = /map|地図|location|locations|拠点|店舗|住所|ルート|route|nearby|周辺|geo|incident|現場/i.test(input.prompt);
  const wantsAudio = /audio|music|sound|podcast|voice|recording|音楽|音声|録音|ポッドキャスト|曲|サウンド/i.test(input.prompt);
  const wantsVideo = /video|movie|clip|screen recording|demo|walkthrough|動画|映像|録画|デモ|チュートリアル/i.test(input.prompt);
  const wantsDecision = /compare|comparison|choose|decision|tradeoff|option|選択|比較|判断|意思決定|推奨案|案/i.test(input.prompt);
  const wantsTimeline = /timeline|history|incident|release|plan|steps|時系列|タイムライン|障害|リリース|手順|進捗/i.test(input.prompt);
  const wantsTable = /table|grid|rows|records|csv|spreadsheet|一覧|表形式|テーブル|リスト|データ|検索結果/i.test(input.prompt);
  const wantsTasks = /task|kanban|board|todo|plan|handoff|queue|triage|タスク|計画|担当|進捗|カンバン|キュー/i.test(input.prompt);
  const wantsDiff = /diff|patch|code|config|review|changes|差分|パッチ|コード|設定|変更|レビュー/i.test(input.prompt);
  const wantsChart = /chart|graph|bar|line|trend|forecast|推移|グラフ|チャート|棒グラフ|折れ線|予測/i.test(input.prompt);
  const wantsAlert = /alert|warning|risk|blocker|issue|validation|リスク|警告|問題|ブロッカー|検証|注意/i.test(input.prompt);
  const wantsProgress = /step|progress|workflow|approval|release|investigation|ステップ|進行|承認|調査|リリース/i.test(input.prompt);
  const wantsResources = /resource|link|url|file|document|artifact|reference|資料|リンク|URL|ファイル|ドキュメント|参考/i.test(input.prompt);
  const wantsForm = /form|input|field|intake|approval|missing|フォーム|入力|項目|申請|不足|確認/i.test(input.prompt);
  const wantsFacts = /key-value|metadata|facts|environment|config|summary|メタデータ|ファクト|環境|設定値|要約/i.test(input.prompt);
  const selectedMockData = selectMockDataMode(input.prompt, input.mockData);
  const rows = contextRows(input);

  if (wantsChart) {
    const contextChart = createContextLineChartOpenUILang(input, rows);
    if (contextChart) {
      return contextChart;
    }

    return [
      "root = Card([header, bars, trend, actions])",
      `header = CardHeader("${q(title)}", "Agent-generated chart view")`,
      "bars = BarChart(\"カテゴリ比較\", \"件数やスコアの比較\", \"\", null, [b1, b2, b3, b4])",
      "b1 = { label: \"Critical\", value: 9, tone: \"danger\" }",
      "b2 = { label: \"High\", value: 16, tone: \"warning\" }",
      "b3 = { label: \"Normal\", value: 28, tone: \"info\" }",
      "b4 = { label: \"Done\", value: 42, tone: \"positive\" }",
      "trend = LineChart(\"直近推移\", \"contextに時系列を渡すと実データで表示できます\", \"\", [p1, p2, p3, p4, p5])",
      "p1 = { label: \"Mon\", value: 18 }",
      "p2 = { label: \"Tue\", value: 22 }",
      "p3 = { label: \"Wed\", value: 19 }",
      "p4 = { label: \"Thu\", value: 31 }",
      "p5 = { label: \"Fri\", value: 27 }",
      "actions = ActionPanel(\"次のアクション\", \"チャートを実データ化するには\", [a1])",
      "a1 = { label: \"data pointsをcontextで渡す\", priority: \"medium\", owner: \"calling agent\" }",
    ].join("\n");
  }

  if (wantsTable && rows.length > 0) {
    return createContextTableOpenUILang(input, rows);
  }

  if (wantsForm) {
    return [
      "root = Card([header, form, alerts, actions])",
      `header = CardHeader("${q(title)}", "Input review popup")`,
      "form = FormPanel(\"入力内容の確認\", \"不足項目とレビュー対象を表示します\", [f1, f2, f3])",
      "f1 = { label: \"目的\", value: \"ユーザーに視覚的に説明する\", type: \"textarea\", required: true, status: \"valid\" }",
      "f2 = { label: \"データソース\", value: \"\", type: \"text\", required: true, status: \"missing\", help: \"context-fileで渡してください\" }",
      "f3 = { label: \"出力サイズ\", value: \"panel\", type: \"select\", status: \"review\" }",
      "alerts = AlertList(\"確認事項\", \"生成前に見るべきポイント\", [al1])",
      "al1 = { severity: \"warning\", title: \"データソース未指定\", description: \"実データが必要なUIではcontextを渡してください\", action: \"--context-fileを使う\" }",
      "actions = ActionPanel(\"次のアクション\", \"不足情報を埋める\", [a1])",
      "a1 = { label: \"context-fileを追加して再生成\", priority: \"high\", owner: \"agent\" }",
    ].join("\n");
  }

  if (wantsResources) {
    return [
      "root = Card([header, resources, facts])",
      `header = CardHeader("${q(title)}", "Resource handoff popup")`,
      "resources = ResourceList(\"関連リソース\", \"ファイル、URL、生成物をまとめます\", [r1, r2, r3])",
      "r1 = { title: \"Generated artifact\", type: \"artifact\", description: \"このpopupの保存済みartifact\", status: \"ready\" }",
      "r2 = { title: \"Implementation notes\", type: \"document\", description: \"agentが参照すべき設計メモ\", status: \"draft\" }",
      "r3 = { title: \"External reference\", type: \"url\", url: \"https://example.com\", description: \"実URLがある場合はcontextで渡してください\", status: \"external\" }",
      "facts = KeyValuePanel(\"メタデータ\", \"呼び出し元情報\", [kv1, kv2])",
      `kv1 = { label: "Agent", value: "${q(input.agentId ?? "agent")}", tone: "info" }`,
      "kv2 = { label: \"Mode\", value: \"fallback\", tone: \"neutral\" }",
    ].join("\n");
  }

  if (wantsProgress) {
    return [
      "root = Card([header, steps, actions])",
      `header = CardHeader("${q(title)}", "Workflow progress popup")`,
      "steps = ProgressStepper(\"進行状況\", \"完了・進行中・未着手を分けて表示します\", [s1, s2, s3, s4])",
      "s1 = { label: \"依頼を受信\", status: \"done\", description: \"calling agentからpromptを受け取りました\" }",
      "s2 = { label: \"UIを生成\", status: \"done\", description: \"OpenUI artifactを作成しました\" }",
      "s3 = { label: \"ユーザー確認\", status: \"active\", description: \"popupで内容を確認してください\" }",
      "s4 = { label: \"結果を反映\", status: \"pending\", description: \"判断結果をagent workflowへ戻します\" }",
      "actions = ActionPanel(\"次のアクション\", \"workflowを進める\", [a1])",
      "a1 = { label: \"確認後にclose_popupを呼ぶ\", priority: \"medium\", owner: \"agent\" }",
    ].join("\n");
  }

  if (wantsAlert) {
    return [
      "root = Card([header, alerts, actions])",
      `header = CardHeader("${q(title)}", "Risk and alert summary")`,
      "alerts = AlertList(\"リスクと警告\", \"ユーザーが先に見るべき注意点\", [al1, al2, al3])",
      "al1 = { severity: \"danger\", title: \"高優先度のブロッカー\", description: \"判断前にowner確認が必要です\", action: \"ownerへ確認\" }",
      "al2 = { severity: \"warning\", title: \"データ不足\", description: \"contextが不足すると推論ベースのUIになります\", action: \"structured contextを追加\" }",
      "al3 = { severity: \"info\", title: \"fallback生成\", description: \"OPENAI_API_KEYなしでも確認用UIを表示できます\" }",
      "actions = ActionPanel(\"推奨アクション\", \"リスクを下げる動き\", [a1, a2])",
      "a1 = { label: \"不足データを追加\", priority: \"high\", owner: \"agent\" }",
      "a2 = { label: \"ブロッカーを先に解消\", priority: \"critical\", owner: \"user\" }",
    ].join("\n");
  }

  if (wantsFacts) {
    return [
      "root = Card([header, facts, actions])",
      `header = CardHeader("${q(title)}", "Compact facts summary")`,
      "facts = KeyValuePanel(\"重要情報\", \"判断に必要なファクト\", [kv1, kv2, kv3, kv4])",
      `kv1 = { label: "Prompt", value: "${prompt}", tone: "info" }`,
      `kv2 = { label: "Agent", value: "${q(input.agentId ?? "agent")}", tone: "neutral" }`,
      "kv3 = { label: \"Data\", value: \"context optional\", description: \"context-fileで実データを渡せます\", tone: \"warning\" }",
      "kv4 = { label: \"Output\", value: \"popup artifact\", tone: \"positive\" }",
      "actions = ActionPanel(\"次のアクション\", \"必要なら詳細UIへ展開\", [a1])",
      "a1 = { label: \"表・チャート・差分などへ再生成\", priority: \"medium\", owner: \"agent\" }",
    ].join("\n");
  }

  if (wantsDiff) {
    return [
      "root = Card([header, diff, actions])",
      `header = CardHeader("${q(title)}", "Agent-generated change review")`,
      "diff = CodeDiff(\"差分レビュー\", \"実データがある場合はcontextにfiles/hunksを渡してください\", [file1])",
      "file1 = { path: \"src/example.ts\", language: \"typescript\", additions: 2, deletions: 1, hunks: [h1] }",
      "h1 = { title: \"@@ render @@\", lines: [l1, l2, l3, l4] }",
      "l1 = { type: \"context\", content: \"export function render() {\" }",
      "l2 = { type: \"remove\", content: \"  return text;\" }",
      "l3 = { type: \"add\", content: \"  return visualUi;\" }",
      "l4 = { type: \"context\", content: \"}\" }",
      "actions = ActionPanel(\"レビュー観点\", \"適用前に確認すること\", [a1, a2])",
      "a1 = { label: \"意図した変更か確認\", priority: \"high\", owner: \"user\" }",
      "a2 = { label: \"テスト結果を添えて再提示\", priority: \"medium\", owner: \"agent\" }",
    ].join("\n");
  }

  if (wantsTasks) {
    return [
      "root = Card([header, board, actions])",
      `header = CardHeader("${q(title)}", "Agent workflow board")`,
      "board = TaskBoard(\"実行ボード\", \"agentがユーザーへ作業状態を説明するためのボード\", [todo, doing, done])",
      "todo = { title: \"Next\", tone: \"neutral\", items: [t1, t2] }",
      "doing = { title: \"Active\", tone: \"info\", items: [t3] }",
      "done = { title: \"Done\", tone: \"positive\", items: [t4] }",
      "t1 = { title: \"必要データをcontextで渡す\", owner: \"calling agent\", status: \"next\", description: \"rows, metrics, options, filesなどを渡す\" }",
      "t2 = { title: \"ユーザー判断を1つに絞る\", owner: \"agent\", status: \"next\" }",
      "t3 = { title: \"生成UIを確認\", owner: \"user\", status: \"active\" }",
      "t4 = { title: \"popup broker起動\", owner: \"system\", status: \"done\" }",
      "actions = ActionPanel(\"次の一手\", \"実用UIにするための動き\", [a1])",
      "a1 = { label: \"context付きで再生成\", priority: \"high\", owner: \"agent\" }",
    ].join("\n");
  }

  if (wantsTable) {
    return [
      "root = Card([header, table, actions])",
      `header = CardHeader("${q(title)}", "Agent-generated table view")`,
      "table = DataTable(\"サンプル一覧\", \"context.rowsを渡すと実データで表示できます\", [c1, c2, c3, c4], [r1, r2, r3], \"Fallback sample\")",
      "c1 = { key: \"name\", label: \"Name\" }",
      "c2 = { key: \"status\", label: \"Status\" }",
      "c3 = { key: \"risk\", label: \"Risk\" }",
      "c4 = { key: \"next\", label: \"Next action\" }",
      "r1 = { name: \"Primary item\", status: \"Active\", risk: \"Medium\", next: \"Confirm data source\" }",
      "r2 = { name: \"Blocked item\", status: \"Waiting\", risk: \"High\", next: \"Escalate owner\" }",
      "r3 = { name: \"Completed item\", status: \"Done\", risk: \"Low\", next: \"Archive\" }",
      "actions = ActionPanel(\"次のアクション\", \"表を実データ化するには\", [a1])",
      "a1 = { label: \"--context-fileでrowsを渡す\", priority: \"medium\", owner: \"calling agent\" }",
    ].join("\n");
  }

  if (
    selectedMockData === "sales" &&
    !wantsMap &&
    !wantsAudio &&
    !wantsVideo &&
    /sales|revenue|kpi|dashboard|売上|ダッシュボード|商談|KPI/i.test(input.prompt)
  ) {
    return [
      "root = Card([header, metrics, actions])",
      `header = CardHeader("${q(title)}", "売上状況をagent向けの視覚UIとして要約しています")`,
      "metrics = MetricGrid(\"売上サマリー\", \"モックデータから生成したKPI\", [m1, m2, m3, m4])",
      "m1 = { label: \"Revenue\", value: \"¥12.8M\", delta: \"+8.7%\", tone: \"positive\", description: \"Q2 month-to-date\" }",
      "m2 = { label: \"Pipeline\", value: \"¥36.4M\", tone: \"info\", description: \"Forecast coverage is healthy\" }",
      "m3 = { label: \"Conversion\", value: \"18.4%\", tone: \"neutral\", description: \"Watch SMB renewal cohort\" }",
      "m4 = { label: \"Risk\", value: \"SMB\", delta: \"High\", tone: \"warning\", description: \"Renewal campaign required\" }",
      "actions = ActionPanel(\"次のアクション\", \"agentがユーザーに提示すべき判断材料\", [a1, a2, a3])",
      "a1 = { label: \"Enterprise legal-review dealsを月末前にclose\", priority: \"high\", owner: \"Sales\", due: \"this week\", description: \"Forecast upsideを確定させる\" }",
      "a2 = { label: \"SMB renewal cohortへchurn-save campaignを実施\", priority: \"critical\", owner: \"CS\", due: \"today\", description: \"target未達リスクを下げる\" }",
      "a3 = { label: \"Partner co-sell enablementを優先\", priority: \"medium\", owner: \"Partner\", description: \"好調セグメントを伸ばす\" }",
    ].join("\n");
  }

  if (
    selectedMockData === "support" &&
    !wantsMap &&
    !wantsAudio &&
    !wantsVideo &&
    /support|ticket|sla|customer|サポート|問い合わせ|未対応|緊急|顧客/i.test(input.prompt)
  ) {
    return [
      "root = Card([header, metrics, actions])",
      `header = CardHeader("${q(title)}", "顧客サポート状況をagent向けの視覚UIとして要約しています")`,
      "metrics = MetricGrid(\"Support health\", \"緊急度とSLAを短時間で把握するための概要\", [m1, m2, m3, m4])",
      "m1 = { label: \"Open\", value: \"47\", delta: \"-6 backlog\", tone: \"positive\", description: \"全未対応件数\" }",
      "m2 = { label: \"Urgent\", value: \"9\", tone: \"warning\", description: \"優先確認が必要\" }",
      "m3 = { label: \"SLA breach\", value: \"3\", tone: \"danger\", description: \"即時エスカレーション対象\" }",
      "m4 = { label: \"First response\", value: \"22m\", tone: \"info\", description: \"median response time\" }",
      "actions = ActionPanel(\"推奨アクション\", \"未対応一覧から優先すべき動き\", [a1, a2, a3])",
      "a1 = { label: \"Northstar Retailをpayments ownerへエスカレーション\", priority: \"critical\", owner: \"Support lead\", due: \"30 min\", description: \"Checkout failureのため顧客影響が大きい\" }",
      "a2 = { label: \"Aoba Logisticsにexport workaroundを提示\", priority: \"high\", owner: \"Support\", due: \"today\", description: \"schema versionを確認して暫定回避策を出す\" }",
      "a3 = { label: \"Mira HealthのSSO logsを添付してadmin sessionを設定\", priority: \"high\", owner: \"Identity owner\", description: \"group mapping mismatchを解消する\" }",
    ].join("\n");
  }

  if (wantsMap) {
    return [
      "root = Card([header, map, actions])",
      `header = CardHeader("${q(title)}", "Generated locally by GenUI Popup Broker")`,
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
      `header = CardHeader("${q(title)}", "Generated locally by GenUI Popup Broker")`,
      'player = AudioPlayer("音声プレビュー", "デモ用の音声サンプルです。実データがある場合はagent contextから音声URLを渡してください。", [track1])',
      'track1 = { title: "Sample audio", artist: "GenUI Broker", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3", description: "AudioPlayer rendering sample" }',
      "actions = FollowUpBlock([done])",
      "done = FollowUpItem(\"Close this popup when finished\")",
    ].join("\n");
  }

  if (wantsVideo) {
    return [
      "root = Card([header, video, actions])",
      `header = CardHeader("${q(title)}", "Generated locally by GenUI Popup Broker")`,
      'video = VideoPlayer("動画プレビュー", "デモ用の動画サンプルです。実データがある場合はagent contextから動画URLを渡してください。", "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", null, "VideoPlayer rendering sample.", [chapter1])',
      'chapter1 = { time: "00:00", title: "Preview starts", description: "Use chapters to summarize important moments." }',
      "actions = FollowUpBlock([done])",
      "done = FollowUpItem(\"Close this popup when finished\")",
    ].join("\n");
  }

  if (wantsTimeline) {
    return [
      "root = Card([header, timeline, actions])",
      `header = CardHeader("${q(title)}", "Agent-generated timeline popup")`,
      "timeline = TimelinePanel(\"状況の流れ\", \"現時点までの経緯と次のステップ\", [e1, e2, e3])",
      "e1 = { time: \"Start\", title: \"依頼を受信\", status: \"done\", description: \"agentがユーザー説明用のUIを要求しました\" }",
      "e2 = { time: \"Now\", title: \"要点を整理\", status: \"active\", description: \"重要情報を視覚的なタイムラインに圧縮しています\" }",
      "e3 = { time: \"Next\", title: \"次の判断\", status: \"planned\", description: \"必要なら追加情報をagent contextとして渡してください\" }",
      "actions = ActionPanel(\"次のアクション\", \"このpopupでできること\", [a1])",
      "a1 = { label: \"追加データ付きで再生成\", priority: \"medium\", owner: \"calling agent\", description: \"より正確なUIにはcontextを渡してください\" }",
    ].join("\n");
  }

  if (wantsDecision) {
    return [
      "root = Card([header, matrix, actions])",
      `header = CardHeader("${q(title)}", "Agent-generated decision support")`,
      "matrix = DecisionMatrix(\"選択肢比較\", \"promptから推定した初期比較です\", [o1, o2, o3])",
      "o1 = { name: \"今すぐ実行\", score: \"High speed\", recommendation: \"consider\", summary: \"短時間で前進できるが、追加検証が必要\", pros: [\"早い\", \"学習が進む\"], cons: [\"手戻りリスク\"] }",
      "o2 = { name: \"小さく検証\", score: \"Recommended\", recommendation: \"recommended\", summary: \"小さい範囲で確認してから拡張する\", pros: [\"失敗コストが低い\", \"品質を保ちやすい\"], cons: [\"初速は少し遅い\"] }",
      "o3 = { name: \"保留\", score: \"Low\", recommendation: \"avoid\", summary: \"情報不足のまま止める選択\", pros: [\"リスクは増えない\"], cons: [\"価値が出ない\", \"判断が遅れる\"] }",
      "actions = ActionPanel(\"推奨\", \"agentへの次の指示\", [a1])",
      "a1 = { label: \"小さく検証してから拡張\", priority: \"high\", owner: \"agent\", description: \"UI scaffoldを壊さず改善を積み上げる\" }",
    ].join("\n");
  }

  return [
    "root = Card([header, metrics, actions])",
    `header = CardHeader("${q(title)}", "Generated locally by GenUI Popup Broker")`,
    "metrics = MetricGrid(\"要点\", \"agent promptを視覚的に説明するための初期UI\", [m1, m2, m3])",
    `m1 = { label: "Request", value: "Received", tone: "info", description: "${prompt}" }`,
    "m2 = { label: \"Mode\", value: \"Fallback\", tone: \"neutral\", description: \"OPENAI_API_KEYなしでもUIを表示できます\" }",
    "m3 = { label: \"Next\", value: \"Add context\", tone: \"warning\", description: \"具体データを渡すとさらに良いUIになります\" }",
    "actions = ActionPanel(\"次のアクション\", \"calling agentがユーザーに提示できる操作\", [a1, a2])",
    "a1 = { label: \"context付きで再生成\", priority: \"medium\", owner: \"agent\", description: \"数値、候補、URL、座標、ファイル情報などを渡してください\" }",
    "a2 = { label: \"確認後に閉じる\", priority: \"low\", owner: \"user\", description: \"役目が終わったらpopupを閉じられます\" }",
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
