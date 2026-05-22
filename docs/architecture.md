# Architecture

`genui-agent-workbench` is a resident GenUI Popup Broker. It is an agent-facing visual tool, not primarily a standalone chat application.

## Runtime Flow

```txt
External AI agent
  ↓ CLI / MCP / Skill-guided workflow
Electron main process
  ↓ local control API
renderGenUI(input)
  ↓ OpenAI or deterministic fallback
artifact store under .genui/
  ↓
BrowserWindow popup
  ↓
Next.js /preview/[artifactId]
  ↓
OpenUI Renderer + custom component library
```

## Responsibilities

- Electron main owns tray lifecycle, settings, local control API, popup windows, and the Next.js child service.
- `src/server/genui/render.ts` owns input normalization, prompt construction, mock context selection, LLM calls, deterministic fallback, and artifact creation.
- `src/library.ts` owns OpenUI custom components and prompt guidance for the renderer.
- `src/server/genui/component-catalog.ts` owns agent-visible component discovery metadata.
- `src/server/genui/agent-guide.ts` owns the agent-facing usage guide exposed through CLI/MCP/API.
- `src/server/genui/artifacts.ts` owns `.genui/artifacts` persistence.
- `scripts/genui-cli.ts` and `scripts/genui-mcp.ts` are thin clients over the resident broker.
- Next.js owns the dashboard and artifact preview rendering only.

## Control API

- `GET /v1/status`: inspect broker protocol version and runtime status.
- `GET /v1/components`: list custom GenUI components.
- `GET /v1/guide`: return agent-facing usage guidance.
- `GET /v1/sizes`: list popup size presets and approximate dimensions.
- `GET /v1/settings`: read resident broker settings.
- `POST /v1/settings`: update resident broker settings.
- `POST /v1/popups`: generate an artifact and open a popup.
- `GET /v1/popups/:popupId`: inspect popup state.
- `POST /v1/popups/:popupId/close`: close a popup.

The control API is local-only on `127.0.0.1`. The current URL is written to `.genui/broker.json`.

## Component Strategy

The MVP component library is organized around agent explanation jobs:

- `MetricGrid` for KPI/status summaries.
- `KeyValuePanel` for compact facts and metadata.
- `AlertList` for risks, warnings, blockers, and validation findings.
- `ProgressStepper` for staged workflows and approvals.
- `BarChart` and `LineChart` for category comparison and trends.
- `ResourceList` for files, URLs, documents, and generated artifacts.
- `FormPanel` for input review, missing fields, and approval checks.
- `ActionPanel` for next actions and handoffs.
- `TimelinePanel` for chronological explanations.
- `DecisionMatrix` for tradeoff comparisons.
- `DataTable` for structured rows, tickets, file lists, evidence, and search results.
- `TaskBoard` for queues, implementation plans, triage lanes, and handoffs.
- `CodeDiff` for code, config, prompt, document, and migration review.
- `MapView` for spatial explanation.
- `AudioPlayer` for sound and recording review.
- `VideoPlayer` for clips, demos, and walkthroughs.

Every new component should be registered in `src/library.ts`, `src/server/genui/component-catalog.ts`, docs, and tests when behavior is user-visible.

## Artifact Model

Artifacts are JSON files in `.genui/artifacts`. They contain the prompt, OpenUI Lang response, model, caller metadata, mock-data mode, generation mode, context, and timestamps. Closed popups do not delete artifacts.

Artifacts include `generationMode`:

- `llm`: OpenAI generated the OpenUI Lang.
- `fallback`: deterministic local fallback was used.

## Renderer Stability

Popup previews are constrained by a dedicated `.genui-render-root` wrapper. The renderer applies:

- container-query aware spacing;
- stable scroll boundaries;
- media max-width and aspect-ratio constraints;
- table/pre/code wrapping;
- narrow-container fallback for generated grid layouts.

This is intentionally defensive because generated UI can contain arbitrary component combinations and long text.
