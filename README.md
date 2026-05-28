# genui-agent-workbench

A resident GenUI Popup Broker for AI agents.

`genui-agent-workbench` gives local agents a way to show rich temporary UI without owning windows themselves. The agent generates OpenUI Lang, the CLI sends it to the resident Electron broker, and the broker validates, stores, and renders it in a popup.

OpenUI means the Generative UI framework from `@openuidev`, not the W3C Open UI community/spec project.

## Product Concept

GenUI is a visual output surface for agents, not a chat app and not a broker-side LLM.

The intended flow:

1. The agent reads the CLI-provided authoring guide with `npm run genui -- prompt-spec`.
2. The agent decides the UI and generates OpenUI Lang.
3. The agent calls `npm run genui -- popup --openui-lang-file ui.openui`.
4. The CLI starts or connects to the resident Electron broker.
5. The broker validates the OpenUI Lang, saves an artifact under `.genui/artifacts`, and opens a popup.
6. The preview page renders the artifact with OpenUI `<Renderer>`.

The broker does not interpret natural-language prompts and does not call an LLM. UI planning belongs to the calling agent.

## Setup

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
npm run genui -- agent-instructions
npm run genui -- prompt-spec
npm run genui -- components
npm run genui -- examples
```

Open a popup from OpenUI Lang:

```bash
npm run --silent genui -- examples --name build-review > ui.openui
npm run genui -- validate --openui-lang-file ui.openui
npm run genui -- popup \
  --agent-id codex \
  --title "Build Review" \
  --size panel \
  --openui-lang-file ui.openui
```

Open from stdin:

```bash
cat ui.openui | npm run genui -- popup \
  --agent-id codex \
  --title "Build Review" \
  --stdin-openui
```

Wait until the popup is closed:

```bash
npm run genui -- popup \
  --agent-id codex \
  --title "Build Review" \
  --openui-lang-file ui.openui \
  --wait
```

Close and inspect:

```bash
npm run genui -- close --popup-id "<popupId>"
npm run genui -- complete --popup-id "<popupId>" --outcome completed
npm run genui -- status
npm run genui -- guide
```

Popup chrome includes a completion control. When an agent opens a popup with
`--wait`, the command now returns when the popup is completed, cancelled,
closed, or failed. Completion responses include a `completion` object when the
popup reported an explicit outcome.

`popup` returns JSON:

```json
{
  "popupId": "pop_...",
  "artifactId": "art_...",
  "previewUrl": "http://127.0.0.1:3000/preview/art_...",
  "status": "open",
  "generationMode": "provided",
  "brokerProtocolVersion": "0.2.0"
}
```

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
- Summaries: `MetricGrid`, `Stat`, `KeyValuePanel`
- Risks and status: `AlertList`, `NotificationToast`, `DiagnosticsCard`
- Decisions: `DecisionMatrix`, `CompareTable`, `ConfirmDialog`
- Progress: `ProgressStepper`, `TimelinePanel`, `TaskBoard`, `WizardForm`
- Data: `DataTable`, `DataPreview`, `TreeView`
- Code and changes: `CodeDiff`, `CodeBlock`
- Media and visuals: `ImageGallery`, `InlineSvg`, `AnimationCard`, `AudioPlayer`, `VideoPlayer`
- Geography: `MapView`, `MapWithList`, `GeoHeatmap`, `WeatherCard`
- Conversation and people: `MessageThread`, `TranscriptView`, `PersonCard`, `EventList`
- Charts: `BarChart`, `LineChart`, `ComboChart`, `DonutChart`, `Sparkline`

Run `npm run genui -- prompt-spec` for full signatures and examples.

## Liquid Glass Design

The app uses a project-local Liquid Glass HUD design layer built from CSS variables/classes and the custom OpenUI component library. There is no separate Liquid Glass runtime dependency.

Design defaults can be changed from:

- the main workbench screen (`/`)
- the tray settings window (`/settings`)
- `POST /v1/settings`

Available presets:

- `themeColorPreset`: `mint` (default, shown as Tactical), `blue`, `azure` (shown as Bright Blue), `cyan`, `violet`, `rose`, `amber`, `white`, `midnight`, `forest`, `crimson`, `graphite`
- `glassPreset`: `clear`, `pane`, `milky` (default), `dense`, `mint`, `sky`, `rose`, `amber`
- `labelInkPreset`: `green` (default), `slate`, `white`, `blue`, `amber`, `red`
- `windowAnimationPreset`: `center` (default), `left`, `right`, `top`, `fade`

## Local Control API

- `GET /v1/status`
- `GET /v1/components`
- `GET /v1/guide`
- `GET /v1/sizes`
- `GET /v1/settings`
- `POST /v1/settings`
- `POST /v1/popups`
- `GET /v1/popups/:popupId`
- `POST /v1/popups/:popupId/close`
- `POST /v1/popups/:popupId/complete`
- `GET /v1/artifacts`
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

The artifact is written under `dist/`. This is the default local sharing target
because it does not depend on macOS disk image tooling.

Build an unsigned local macOS `.dmg` when the host supports `hdiutil`:

```bash
npm run electron:dmg
```

Public distribution should add Developer ID signing and notarization before publishing.

## Download Site

The static GitHub Pages site lives in `site/`. It explains the download,
first launch, and CLI popup flow for end users. See `docs/pages-site.md` for
publishing steps and release asset requirements.

## Repository Notes

- Do not commit `.env`, `.env.local`, `.genui/`, build output, or secrets.
- Keep new UI components registered in both `src/library.ts` and `src/server/genui/component-catalog.ts`.
- Keep CLI help, `src/server/genui/agent-guide.ts`, and `docs/agent-interface.md` aligned.
