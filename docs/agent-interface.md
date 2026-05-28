# Agent Interface

This project is designed so AI agents can use GenUI as a local visual output tool through the CLI.

## Responsibility Split

- Agent: understand the user, choose the UI, and generate OpenUI Lang.
- CLI: expose authoring instructions, start/connect to the broker, and send OpenUI Lang.
- Broker: validate OpenUI Lang, store artifacts, and open Electron popups.
- OpenUI: render OpenUI Lang with the broker's component library.

The broker is not a UI-planning LLM. Do not send natural-language prompts as the primary path.

## Preferred Agent Flow

1. Run `npm run genui -- agent-instructions` if the agent has not used GenUI before.
2. Run `npm run genui -- prompt-spec` and use the output as the OpenUI Lang authoring guide.
3. Use `npm run genui -- examples` for known-good starter snippets when useful.
4. Generate OpenUI Lang using only listed components.
5. Validate before opening:

```bash
npm run genui -- validate --openui-lang-file ui.openui
```

6. Open a popup:

```bash
npm run genui -- popup --agent-id codex --title "Decision Review" --size wide --openui-lang-file ui.openui
```

7. Store `popupId`, `artifactId`, and `previewUrl` if the workflow needs to close or reference the popup later.
8. Use `--wait` when the workflow needs the user's explicit completion result. The command returns when the popup is completed, cancelled, closed, or failed.
9. Close when done:

```bash
npm run genui -- close --popup-id "<popupId>"
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

## CLI Commands

```bash
npm run genui -- agent-instructions
npm run genui -- prompt-spec
npm run genui -- components
npm run genui -- examples
npm run --silent genui -- examples --name build-review > ui.openui
npm run genui -- validate --openui-lang-file ui.openui
npm run genui -- popup --openui-lang-file ui.openui --title "Status" --agent-id codex
npm run genui -- popup --openui-lang-file ui.openui --title "Status" --agent-id codex --wait
npm run genui -- complete --popup-id "<popupId>" --outcome completed
npm run genui -- status
npm run genui -- close --popup-id "<popupId>"
```

The broker writes its current control URL and per-run control token to
`.genui/broker.json`. The CLI reads that file automatically. If a tool calls
the local control API directly, private and mutating endpoints require the
`x-genui-token` header.

## Size Presets

- `compact`: tiny focused confirmation.
- `card`: small explanation or one component.
- `panel`: default work surface for KPI/action UI.
- `wide`: comparison tables and decision matrices.
- `tall`: timelines and long lists.
- `stage`: maps and spatial UI.
- `cinema`: video-heavy UI.
- `fullscreen`: large review sessions.

Prefer presets before custom `width` and `height`.

## Guardrails

- Never pass secrets in OpenUI Lang or context.
- Return only OpenUI Lang when authoring popup content.
- Always define `root = ...`.
- Use only components listed by `prompt-spec` or `components`.
- Keep each popup focused on one user decision or explanation.
- Do not claim live data, tools, or remote sources were used unless the calling agent actually used them.
