import { library, promptOptions } from "../../library";

const cliCommand = "genui";

export function buildPromptSpec(): string {
  return [
    "You are generating OpenUI Lang for GenUI Popup Broker.",
    "Return only OpenUI Lang code. Do not return Markdown prose.",
    "The broker will validate the output and render it in an Electron popup.",
    "",
    library.prompt(promptOptions),
  ].join("\n");
}

export function buildAgentInstructions(): string {
  return `You have access to the GenUI CLI.

Use GenUI when a visual popup helps the user inspect status, risks, decisions, task boards, tables, diffs, maps, media, diagnostics, checklists, scores, insights, or approvals.
Do not use GenUI for a single short text answer, a tiny code-only response, or UI filled with generic placeholder content.

Availability:
- Run \`${cliCommand} doctor --json\` when you need to check whether GenUI is installed/reachable and what commands to use.
- The \`popup\`, \`validate\`, \`prompt-spec\`, \`components\`, and \`examples\` commands can auto-start the resident broker unless \`--no-start\` is passed.
- If \`doctor\` reports \`brokerReachable: false\`, you can still generate and validate after opening a popup command or by asking the user to open GenUI Popup Broker.

Workflow:
1. Run \`${cliCommand} prompt-spec\` and use that output as your OpenUI Lang authoring guide.
2. Generate OpenUI Lang yourself using only the listed components.
3. Validate before opening with \`${cliCommand} validate --openui-lang-file <file>\`.
4. Open the popup with \`${cliCommand} popup --openui-lang-file <file> --title "<title>" --agent-id "<agent-id>"\`.
5. Use \`${cliCommand} examples\` and \`${cliCommand} components\` for examples and the concise component catalog.
6. Add \`--wait\` when you need a completed, cancelled, closed, or failed result. For approvals/forms, give ConfirmDialog, FormPanel, WizardForm, or MessageThread an \`actionId\`; the selected action or submitted fields return in \`completion.payload\`.

Component selection:
- Use MetricGrid/Stat/Gauge for status, KPIs, scores, confidence, and readiness.
- Use ChecklistPanel/ProgressStepper/TimelinePanel for gates, workflows, and time-ordered explanations.
- Use InsightStack/KeyValuePanel/ResourceList for findings, evidence, sources, and metadata.
- Use DecisionMatrix/CompareTable/ConfirmDialog for choices and approvals.
- Use DataTable/DataPreview/CodeDiff/CodeBlock for records, raw data, and code review.
- Use MapWithList/MapView, ImageGallery, VideoPlayer/VideoPlaylist, or AudioPlayer when spatial or media context matters.

Use \`--size review\` for code review, diffs, and approval forms; \`--size wide\` for tables/matrices; \`--size tall\` for timelines/checklists; \`--size stage\` for maps. Resize an open popup with \`genui resize --popup-id <popupId> --size wide\` or custom \`--width\`/\`--height\`. Development checkouts can expose MCP with \`npm run genui:mcp\` (\`genui_prompt_spec\`, \`genui_validate\`, \`genui_popup\`, \`genui_resize\`, \`genui_wait\`).

Do not send natural-language prompts to GenUI. The CLI/broker is an OpenUI Lang popup runtime, not a UI-planning LLM.
Never include secrets in OpenUI Lang or context.`;
}

export function buildAgentSnippet(): string {
  return `## GenUI Popup Broker

If the \`genui\` CLI is available, use it when a local visual popup would make the answer easier to inspect: status dashboards, risks, decisions, checklists, tables, diffs, maps, media, diagnostics, insights, or approvals.

Paste this block into project instructions such as \`AGENTS.md\` when you want agents to discover and use GenUI automatically.

Before first use, run \`genui doctor --json\` to check availability. For authoring, run \`genui prompt-spec\` and generate OpenUI Lang directly; do not send natural-language UI requests to GenUI. Validate with \`genui validate --openui-lang-file <file>\`, then open with \`genui popup --openui-lang-file <file> --title "<title>" --agent-id "<agent-id>"\`.

Do not use GenUI for a short plain-text answer or generic placeholder UI. Never include secrets in OpenUI Lang or context.`;
}
