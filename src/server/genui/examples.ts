export type GenUIExample = {
  name: string;
  title: string;
  description: string;
  size: "compact" | "card" | "panel" | "default" | "wide" | "tall" | "stage" | "cinema" | "fullscreen";
  openuiLang: string;
};

export const genUIExamples: GenUIExample[] = [
  {
    name: "build-review",
    title: "Build Review",
    description: "Status summary with checks and recommended next action.",
    size: "panel",
    openuiLang: [
      "root = Card([header, metrics, diagnostics, actions])",
      'header = CardHeader("Build Review", "Current agent run")',
      'metrics = MetricGrid("Summary", "Key signals", [m1, m2, m3])',
      'm1 = { label: "Tests", value: "68 passed", tone: "positive", description: "Unit suite completed" }',
      'm2 = { label: "Lint", value: "passed", tone: "positive", description: "ESLint reported no issues" }',
      'm3 = { label: "Build", value: "ready", tone: "info", description: "Electron build is available" }',
      'diagnostics = DiagnosticsCard("Checks", "Pre-flight status", [c1, c2, c3])',
      'c1 = { name: "tests", status: "pass", detail: "68 passed" }',
      'c2 = { name: "lint", status: "pass", detail: "clean" }',
      'c3 = { name: "electron:build", status: "pass", detail: "tsc completed" }',
      'actions = ActionPanel("Next Actions", "Recommended handoff", [a1])',
      'a1 = { label: "Open review popup", priority: "medium", owner: "agent", description: "Share this status with the user" }',
    ].join("\n"),
  },
  {
    name: "decision-review",
    title: "Decision Review",
    description: "Comparison matrix for choosing an implementation direction.",
    size: "wide",
    openuiLang: [
      "root = Card([header, matrix, actions])",
      'header = CardHeader("Decision Review", "Choose the implementation direction")',
      'matrix = DecisionMatrix("Options", "Tradeoffs and recommendation", [o1, o2, o3])',
      'o1 = { name: "Direct OpenUI Lang", recommendation: "recommended", score: "9/10", pros: ["Clear responsibility", "No broker LLM"], cons: ["Agent must generate UI"] }',
      'o2 = { name: "Broker prompt route", recommendation: "avoid", score: "4/10", pros: ["Simple caller"], cons: ["Duplicate interpretation", "Harder to control"] }',
      'o3 = { name: "Manual screenshots", recommendation: "consider", score: "5/10", pros: ["Predictable"], cons: ["Not generative", "Hard to update"] }',
      'actions = ActionPanel("Next Actions", "Recommended path", [a1])',
      'a1 = { label: "Use direct CLI route", priority: "high", owner: "agent", description: "Generate OpenUI Lang and pass it to --openui-lang-file" }',
    ].join("\n"),
  },
  {
    name: "incident-timeline",
    title: "Incident Timeline",
    description: "Timeline plus risks for incident communication.",
    size: "tall",
    openuiLang: [
      "root = Card([header, timeline, alerts, actions])",
      'header = CardHeader("Incident Timeline", "Current response state")',
      'timeline = TimelinePanel("Timeline", "Response milestones", [t1, t2, t3])',
      't1 = { time: "09:00", title: "Alert fired", status: "done", description: "Monitoring detected elevated errors" }',
      't2 = { time: "09:12", title: "Owner paged", status: "done", description: "Runtime owner acknowledged" }',
      't3 = { time: "09:30", title: "Mitigation active", status: "active", description: "Traffic is being shifted" }',
      'alerts = AlertList("Risks", "Items to watch", [r1, r2])',
      'r1 = { title: "Customer impact", severity: "warning", description: "Checkout latency remains elevated", action: "Keep status page updated" }',
      'r2 = { title: "Rollback window", severity: "info", description: "Rollback remains available", action: "Confirm data safety before rollback" }',
      'actions = ActionPanel("Next Actions", "Immediate handoff", [a1])',
      'a1 = { label: "Post next update", priority: "high", owner: "incident lead", due: "15 min", description: "Summarize current mitigation and ETA" }',
    ].join("\n"),
  },
  {
    name: "data-table",
    title: "Triage Table",
    description: "Structured rows with a follow-up action.",
    size: "wide",
    openuiLang: [
      "root = Card([header, table, actions])",
      'header = CardHeader("Triage Table", "Open support items")',
      'table = DataTable("Tickets", "Prioritized queue", [col1, col2, col3], [row1, row2], "Agent-selected rows")',
      'col1 = { key: "id", label: "ID" }',
      'col2 = { key: "status", label: "Status" }',
      'col3 = { key: "next", label: "Next action" }',
      'row1 = { id: "A-1", status: "blocked", next: "Escalate owner" }',
      'row2 = { id: "A-2", status: "ready", next: "Notify reviewer" }',
      'actions = ActionPanel("Next Actions", "Queue handoff", [a1])',
      'a1 = { label: "Escalate blocked ticket", priority: "high", owner: "support", description: "A-1 needs an owner decision" }',
    ].join("\n"),
  },
];

export function getGenUIExample(name: string): GenUIExample | undefined {
  return genUIExamples.find((example) => example.name === name);
}
