# genui-agent-workbench

A resident GenUI Popup Broker for AI agents.

`genui-agent-workbench` gives local agents a way to show rich temporary UI without owning windows themselves. The agent generates OpenUI Lang, the CLI sends it to the resident Electron broker, and the broker validates, stores, and renders it in a popup.

OpenUI means the Generative UI framework from `@openuidev`, not the W3C Open UI community/spec project.

## Product Concept

GenUI is a visual output surface for agents, not a chat app and not a broker-side LLM.

The intended flow:

1. The agent reads the CLI-provided authoring guide with `genui prompt-spec`.
2. The agent decides the UI and generates OpenUI Lang.
3. The agent calls `genui popup --openui-lang-file ui.openui`.
4. The CLI starts or connects to the resident Electron broker.
5. The broker validates the OpenUI Lang, saves an artifact under `.genui/artifacts`, and opens a popup.
6. The preview page renders the artifact with OpenUI `<Renderer>`.

The broker does not interpret natural-language prompts and does not call an LLM. UI planning belongs to the calling agent.

## Setup

For end users, download `genui-popup-broker-macos-arm64.zip`, move
`GenUI Popup Broker.app` to `/Applications`, and copy the bundled `genui`
command to a directory on `PATH`:

```bash
mkdir -p ~/.local/bin
cp ./genui ~/.local/bin/genui
chmod +x ~/.local/bin/genui
```

The release CLI runs through the Electron runtime inside
`/Applications/GenUI Popup Broker.app`. If the app is not installed yet, it can
also use Node.js from `PATH`.

For local development from this repository:

```bash
npm install
cp .env.example .env.local
```

Artifacts are stored in `.genui/` by default. Set `GENUI_DATA_DIR=/path/to/dir` to use a different local store.

## Run

Start the resident broker explicitly:

```bash
npm run electron:dev
```

The `popup` command also attempts to start the broker when it is not reachable.

## CLI

Ask the CLI how an agent should use it:

```bash
genui doctor --json
genui agent-snippet
genui agent-instructions
genui prompt-spec
genui components
genui examples
```

Use `genui doctor --json` when an agent needs a cheap availability check before
deciding whether to open a popup. It reports whether the CLI is installed, whether
the broker is reachable, when GenUI is useful, and the next commands to run.
Use `genui agent-snippet` when you want a short block to paste into an agent's
project instructions or `AGENTS.md`.

Open a popup from OpenUI Lang:

```bash
genui examples --name build-review > ui.openui
genui validate --openui-lang-file ui.openui
genui popup \
  --agent-id codex \
  --title "Build Review" \
  --size panel \
  --openui-lang-file ui.openui
```

Use a preset or custom dimensions when opening a popup:

```bash
genui popup --openui-lang-file ui.openui --size review
genui popup --openui-lang-file ui.openui --width 1200 --height 760
```

Open from stdin:

```bash
cat ui.openui | genui popup \
  --agent-id codex \
  --title "Build Review" \
  --stdin-openui
```

Wait until the popup is closed:

```bash
genui popup \
  --agent-id codex \
  --title "Build Review" \
  --openui-lang-file ui.openui \
  --wait
```

Close and inspect:

```bash
genui close --popup-id "<popupId>"
genui complete --popup-id "<popupId>" --outcome completed
genui resize --popup-id "<popupId>" --size wide
genui status
genui popups
genui artifacts --limit 20
genui artifact --artifact-id "<artifactId>"
genui replay --artifact-id "<artifactId>"
genui prune --max-artifacts 50
genui guide
```

Popup chrome includes a completion control. When an agent opens a popup with
`--wait`, the command now returns when the popup is completed, cancelled,
closed, or failed. Completion responses include a `completion` object when the
popup reported an explicit outcome. Interactive components such as
`ConfirmDialog`, `FormPanel`, `WizardForm`, and `MessageThread` can send
structured events back to the broker. Add an `actionId` when the calling agent
needs to branch on a button press or submitted form:

```openui
root = Card([approval])
approval = ConfirmDialog("Deploy approval", "Release gate", "Deploy now?", "All checks passed.", "medium", "Approve", "Hold", "deploy.approve")
```

Opened with `--wait`, this returns the clicked action in
`completion.payload.actionId` and `completion.payload.value`.

`popup` returns JSON:

```json
{
  "popupId": "pop_...",
  "artifactId": "art_...",
  "title": "Build Review",
  "previewUrl": "http://127.0.0.1:3000/preview/art_...",
  "status": "open",
  "createdAt": "2026-06-07T00:00:00.000Z",
  "generationMode": "provided",
  "size": "panel",
  "width": 806,
  "height": 648,
  "brokerProtocolVersion": "0.3.0"
}
```

Repository developers can still use `npm run genui -- ...`; the release zip
bundles the standalone `genui` command so users do not need to clone this repo
or run `npm install`.

Artifacts remain available after a popup closes. Use `artifacts` for a compact
history, `artifact` for full OpenUI Lang/context inspection, and `replay` to
open a saved artifact again without regenerating OpenUI Lang.

## OpenUI Lang Example

```openui
root = Card([header, metrics, actions])
header = CardHeader("Build Review", "Current agent run")
metrics = MetricGrid("Summary", "Key checks", [m1, m2])
m1 = { label: "Tests", value: "68 passed", tone: "positive" }
m2 = { label: "Lint", value: "passed", tone: "positive" }
actions = ActionPanel("Next Actions", "Recommended handoff", [a1])
a1 = { label: "Open popup", priority: "medium", owner: "agent", description: "Send OpenUI Lang through the CLI" }
```

## Built-In GenUI Components

The component library is the design boundary. Agents can compose listed components, but styling is owned by this repo.

- Basics: `Card`, `CardHeader`, `Label`
- Summaries: `MetricGrid`, `Stat`, `Gauge`, `KeyValuePanel`, `InsightStack`
- Risks and status: `AlertList`, `NotificationToast`, `DiagnosticsCard`
- Decisions: `DecisionMatrix`, `CompareTable`, `ConfirmDialog`
- Progress: `ProgressStepper`, `TimelinePanel`, `TaskBoard`, `ChecklistPanel`, `WizardForm`
- Data: `DataTable`, `DataPreview`, `TreeView`
- Text and translation: `LongText`, `TranslationPanel`, `TranslationCompare`
- Code and changes: `CodeDiff`, `CodeBlock`
- Media and visuals: `ImageGallery`, `InlineSvg`, `AnimationCard`, `AudioPlayer`, `VideoPlayer`, `VideoPlaylist`
- Geography: `MapView`, `MapWithList`, `GeoHeatmap`, `WeatherCard`
- Conversation and people: `MessageThread`, `TranscriptView`, `PersonCard`, `EventList`
- Charts: `BarChart`, `LineChart`, `ComboChart`, `DonutChart`, `Sparkline`

Run `genui prompt-spec` for full signatures and examples.

## MCP Server

Development checkouts can expose GenUI through MCP:

```bash
npm run genui:mcp
```

The stdio server exposes `genui_prompt_spec`, `genui_validate`, `genui_popup`,
`genui_resize`, and `genui_wait`. Configure MCP clients to run the command from
the repository root. The MCP server uses the same CLI and resident broker as
normal usage.

## Liquid Glass Design

The app uses a project-local Liquid Glass HUD design layer built from CSS variables/classes and the custom OpenUI component library. There is no separate Liquid Glass runtime dependency.

Design defaults can be changed from:

- the main workbench screen (`/`)
- the tray settings window (`/settings`)
- `POST /v1/settings`

Available presets:

- `visualThemePreset`: `hud` (default, existing Liquid Glass HUD), `workbench` (light practical surface), `studio` (dark neutral surface), `briefing` (report-style surface)
- `themeColorPreset`: `mint` (default, shown as Tactical), `blue`, `azure` (shown as Bright Blue), `cyan`, `violet`, `rose`, `amber`, `white`, `midnight`, `forest`, `crimson`, `graphite`
- `glassPreset`: `clear`, `pane`, `milky` (default), `dense`, `mint`, `sky`, `rose`, `amber`
- `labelInkPreset`: `green` (default), `slate`, `white`, `blue`, `amber`, `red`
- `windowAnimationPreset`: `center` (default), `left`, `right`, `top`, `fade`

## Local Control API

- `GET /v1/status`
- `GET /v1/components`
- `GET /v1/guide`
- `GET /v1/prompt-spec`
- `GET /v1/agent-instructions`
- `GET /v1/examples`
- `GET /v1/sizes`
- `GET /v1/settings`
- `POST /v1/settings`
- `POST /v1/popups`
- `POST /v1/validate`
- `GET /v1/popups`
- `GET /v1/popups/:popupId`
- `POST /v1/popups/:popupId/close`
- `POST /v1/popups/:popupId/resize`
- `POST /v1/popups/:popupId/event`
- `POST /v1/popups/:popupId/complete`
- `GET /v1/artifacts`
- `GET /v1/artifacts/:artifactId`
- `POST /v1/artifacts/:artifactId/replay`
- `DELETE /v1/artifacts/:artifactId`
- `POST /v1/artifacts/prune`

The API is local-only on `127.0.0.1`. State-changing and private endpoints
require the per-run `x-genui-token` written to `.genui/broker.json`; the CLI
and Electron-hosted pages attach it automatically. The CLI is the supported
agent-facing interface.

## Architecture

```txt
AI agent
  ↓ reads `genui prompt-spec`
OpenUI Lang
  ↓ CLI
Electron resident broker
  ↓ validate + save artifact
BrowserWindow popup
  ↓
Next.js /preview/[artifactId]
  ↓
OpenUI React renderer + custom component library
```

Electron owns popup lifecycle. The CLI is the agent-facing entry point. Next.js owns dashboard and preview rendering.

## Validation

```bash
npm run lint
npm run test
npm run build
npm run electron:build
```

## Mac Package

Build an unsigned local macOS `.zip` package:

```bash
npm run electron:pack
```

The Electron app artifact is written under `dist/`.

Build the end-user release zip with the app, standalone `genui` CLI, and
`INSTALL.txt`:

```bash
npm run release:macos
```

The stable release asset is written to
`release/genui-popup-broker-macos-arm64.zip`. This is the default local sharing
target because it does not require a repo clone or npm install on the target
machine.

Build an unsigned local macOS `.dmg` when the host supports `hdiutil`:

```bash
npm run electron:dmg
```

Public distribution should add Developer ID signing and notarization before publishing.

Unsigned developer-preview builds need one manual macOS first launch before
CLI auto-start is reliable: move `GenUI Popup Broker.app` to `/Applications`,
right-click it in Finder, choose `Open`, and then rerun `genui doctor --json`.
If `genui doctor --start` or `genui popup` times out on first use, repeat that
Finder `Open` step.

For large chart and table data, keep rows in JSON and pass them with
`--context-file` instead of expanding every point or cell in OpenUI Lang.
Charts can read rows from context paths with explicit source keys:

```openui
chart = LineChart("Daily Traffic", "Rows loaded from context.daily", " views", [], "daily", "date", "pv")
combo = ComboChart("PV + CVR", "Two series from context.daily", [], " views", "%", "PV", "CVR", "info", "daily", "date", "pv", "cvr")
table = DataTable("Top Pages", "Columns inferred from context.pages", [], [], "Landing pages", "pages")
```

```bash
genui popup --openui-lang-file ui.openui --context-file metrics.json --agent-id codex
```

## Download Site

The static GitHub Pages site lives in `site/`. It explains the app download,
first launch, and current developer-preview CLI popup flow. See
`docs/pages-site.md` for publishing steps and release asset requirements.

## Repository Notes

- Do not commit `.env`, `.env.local`, `.genui/`, build output, or secrets.
- Keep new UI components registered in both `src/library.ts` and `src/server/genui/component-catalog.ts`.
- Keep CLI help, `src/server/genui/agent-guide.ts`, and `docs/agent-interface.md` aligned.
