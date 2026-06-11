# Agent Interface

This project is designed so AI agents can use GenUI as a local visual output tool through the CLI.

## Responsibility Split

- Agent: understand the user, choose the UI, and generate OpenUI Lang.
- CLI: expose authoring instructions, start/connect to the broker, and send OpenUI Lang.
- Broker: validate OpenUI Lang, store artifacts, and open Electron popups.
- OpenUI: render OpenUI Lang with the broker's component library.

The broker is not a UI-planning LLM. Do not send natural-language prompts as the primary path.

## Preferred Agent Flow

1. Run `genui agent-snippet` when you need a short reusable instruction block for `AGENTS.md` or an agent profile.
2. Run `genui agent-instructions` if the agent has not used GenUI before.
3. Run `genui doctor --json` when the agent needs to confirm the CLI is installed and whether the broker is reachable.
4. Run `genui prompt-spec` and use the output as the OpenUI Lang authoring guide.
5. Use `genui examples` for known-good starter snippets when useful.
6. Generate OpenUI Lang using only listed components.
7. Validate before opening:

```bash
genui validate --openui-lang-file ui.openui
```

8. Open a popup:

```bash
genui popup --agent-id codex --title "Decision Review" --size review --openui-lang-file ui.openui
```

9. Store `popupId`, `artifactId`, and `previewUrl` if the workflow needs to close or reference the popup later.
10. Resize an open popup if the content needs more or less space:

```bash
genui resize --popup-id "<popupId>" --size wide
genui resize --popup-id "<popupId>" --width 1100 --height 720
```

11. Use `--wait` when the workflow needs the user's explicit completion result. The command returns when the popup is completed, cancelled, closed, or failed. Interactive components with `actionId` return their event data in `completion.payload`.
12. Inspect and replay saved UI when the user wants to revisit a prior artifact:

```bash
genui artifacts --limit 20
genui artifact --artifact-id "<artifactId>"
genui replay --artifact-id "<artifactId>"
```

13. Close when done:

```bash
genui close --popup-id "<popupId>"
```

## OpenUI Lang Example

```openui
root = Card([header, matrix, actions])
header = CardHeader("Decision Review", "Three implementation options")
matrix = DecisionMatrix("Options", "Recommendation summary", [o1, o2])
o1 = { name: "Direct OpenUI Lang", recommendation: "recommended", score: "9/10", pros: ["Clear responsibility", "No broker LLM"], cons: ["Agent must generate UI"] }
o2 = { name: "Broker prompt route", recommendation: "avoid", score: "4/10", pros: ["Simple caller"], cons: ["Duplicate interpretation", "Harder to control"] }
actions = ActionPanel("Next Actions", "Recommended handoff", [a1])
a1 = { label: "Use direct CLI route", priority: "high", owner: "agent", description: "Generate OpenUI Lang and pass it to --openui-lang-file" }
```

## Component Selection

- Use `MetricGrid`, `Stat`, or `Gauge` when a number is the main message.
- Use `InsightStack` when the UI should explain AI takeaways with confidence or sources.
- Use `ChecklistPanel` for acceptance criteria, QA gates, and launch-readiness checks.
- Use `ProgressStepper` or `TimelinePanel` only when sequence or time order matters.
- Use `AlertList` for multiple risks and `NotificationToast` for one compact status banner.

## Approval and Form Results

`ConfirmDialog`, `FormPanel`, `WizardForm`, and `MessageThread` can report user input back to the broker. Set an `actionId` when the agent needs to branch on the result.

```openui
root = Card([header, approval, form])
header = CardHeader("Release Gate", "Approve or adjust the deployment")
approval = ConfirmDialog("Deploy approval", "Production deploy", "Deploy build 184 now?", "All checks passed.", "medium", "Approve deploy", "Hold", "release.approve")
form = FormPanel("Release note", "Optional note for the agent", [note], "release.note", "Submit note")
note = { label: "Note", name: "note", type: "textarea", value: "", required: false, help: "Returned in completion.payload.fields.note" }
```

When opened with `--wait`, the returned popup JSON includes:

```json
{
  "status": "completed",
  "completion": {
    "outcome": "completed",
    "payload": {
      "actionId": "release.approve",
      "value": "confirm",
      "fields": {
        "question": "Deploy build 184 now?",
        "risk": "medium"
      },
      "events": []
    }
  }
}
```

The popup chrome Complete button also includes any previously recorded events in `completion.payload.events`.

## CLI Commands

```bash
genui doctor --json
genui agent-snippet
genui agent-instructions
genui prompt-spec
genui components
genui examples
genui examples --name build-review > ui.openui
genui validate --openui-lang-file ui.openui
genui popup --openui-lang-file ui.openui --title "Status" --agent-id codex
genui popup --openui-lang-file ui.openui --title "Status" --agent-id codex --wait
genui complete --popup-id "<popupId>" --outcome completed
genui resize --popup-id "<popupId>" --size wide
genui status
genui popups
genui artifacts --limit 20
genui artifact --artifact-id "<artifactId>"
genui replay --artifact-id "<artifactId>"
genui prune --max-artifacts 50
genui close --popup-id "<popupId>"
```

The broker writes its current control URL and per-run control token to
`broker.json`. The standalone CLI reads the packaged app location under
`~/Library/Application Support/GenUI Popup Broker/genui-data/` automatically.
The repository development CLI also reads `.genui/broker.json`. If a tool calls
the local control API directly, private and mutating endpoints require the
`x-genui-token` header.

The release zip bundles both `GenUI Popup Broker.app` and the standalone
`genui` command. End users do not need to clone this repository or run
`npm install` just to open popups.

Artifacts are saved OpenUI Lang plus metadata and optional context. Replaying
an artifact reopens the saved UI through the broker; it does not ask the
broker to infer or regenerate UI.

## Size Presets

- `compact`: tiny focused confirmation.
- `card`: small explanation or one component.
- `panel`: default work surface for KPI/action UI.
- `wide`: comparison tables and decision matrices.
- `review`: code review, diffs, and approval forms.
- `tall`: timelines and long lists.
- `stage`: maps and spatial UI.
- `cinema`: video-heavy UI.
- `fullscreen`: large review sessions.

Prefer presets before custom `width` and `height`.
Use `genui resize` to change the size of a popup that is already open.

## MCP Server

Development checkouts expose a stdio MCP server:

```bash
npm run genui:mcp
```

It provides:

- `genui_prompt_spec`: return the OpenUI Lang authoring guide.
- `genui_validate`: validate OpenUI Lang.
- `genui_popup`: open a popup and optionally wait for completion.
- `genui_resize`: resize an existing open popup.
- `genui_wait`: wait for an existing popup id.

Configure MCP clients to run the command from the repository root. The server wraps the same CLI and broker state as normal agent usage.

## Guardrails

- Never pass secrets in OpenUI Lang or context.
- Return only OpenUI Lang when authoring popup content.
- Always define `root = ...`.
- Use only components listed by `prompt-spec` or `components`.
- Keep each popup focused on one user decision or explanation.
- Do not claim live data, tools, or remote sources were used unless the calling agent actually used them.
