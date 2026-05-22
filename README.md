# genui-agent-workbench

A resident GenUI Popup Broker for AI agents.

`genui-agent-workbench` lets other AI agents request generated UI through CLI or MCP. The Electron app stays resident, generates OpenUI artifacts, and opens each result in its own popup window.

In this repository, OpenUI means the Generative UI framework from `@openuidev`, not the W3C Open UI community/spec project.

## Concept

GenUI is treated as a local tool, not as a standalone chat application.

The intended user experience is:

1. A developer starts the resident Electron app once.
2. Other AI agents call this app through CLI or MCP when they need a UI.
3. The broker generates an OpenUI artifact from the agent's prompt and context.
4. The generated UI appears immediately as a dedicated popup window.
5. The user can inspect, interact with, and close the popup when its job is done.
6. The calling agent can also close the popup later by `popupId`.

This makes GenUI a shared visual surface for agent workflows. Agents do not own windows, renderers, or UI state directly; they ask the resident broker to create temporary UI on their behalf.

## Current Status

- Electron resident broker with a tray menu.
- Local control API owned by the Electron main process.
- CLI client for opening and closing GenUI popups.
- MCP stdio server exposing `genui.open_popup` and `genui.close_popup`.
- Next.js dashboard and `/preview/[artifactId]` renderer for saved OpenUI artifacts.
- Artifacts and broker state are stored under `.genui/` and are not committed.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local` for real generation. For local smoke tests without OpenAI, set:

```bash
GENUI_MOCK_RENDER=1
```

## Run The Resident Broker

```bash
npm run electron:dev
```

Electron starts a local Next.js preview/dashboard service, starts the broker control API, and keeps running from the tray. The dashboard shows CLI/MCP examples and recent artifacts.

## CLI Usage

Open a popup:

```bash
npm run genui -- popup --prompt "売上ダッシュボードを表示して" --agent-id codex
```

Close a popup:

```bash
npm run genui -- close --popup-id "<popupId>"
```

Inspect the running broker:

```bash
npm run genui -- status
npm run genui -- components
```

The CLI returns JSON:

```json
{
  "popupId": "pop_...",
  "artifactId": "art_...",
  "previewUrl": "http://127.0.0.1:3000/preview/art_...",
  "status": "open",
  "generationMode": "llm",
  "brokerProtocolVersion": "0.2.0"
}
```

`generationMode` is `"llm"` when OpenAI generated the artifact and `"fallback"` when the broker used a local deterministic fallback.

## MCP Usage

Run the MCP stdio server:

```bash
npm run genui:mcp
```

Tools:

- `genui.open_popup`: generates an OpenUI artifact and opens a popup.
- `genui.close_popup`: closes a popup by `popupId`.
- `genui.list_components`: lists custom GenUI components available in the resident broker.

The MCP server expects the Electron broker to already be running. It reads `.genui/broker.json` or `GENUI_BROKER_URL` to find the local control API.

## Built-in GenUI Components

The broker extends OpenUI's default component library with:

- `MapView`: OpenStreetMap-backed map panel with center, zoom, height, and colored markers.
- `AudioPlayer`: playlist-style audio player for music, voice notes, podcasts, recordings, and generated audio.
- `VideoPlayer`: video player with poster, chapters, and transcript support for demos, clips, recordings, and walkthroughs.

The same catalog is available from the resident broker:

```bash
npm run genui -- components
```

Useful next component candidates for agent popups:

- `ApprovalPanel`: approve/reject/needs-changes decisions.
- `TaskChecklist`: short-lived execution checklists.
- `Timeline`: incident, deployment, or research event timelines.
- `DiffViewer`: code/config/document change review.
- `DataGrid`: sortable operational tables.
- `FormWizard`: multi-step structured input collection.
- `FilePreview`: quick document/image/code artifact inspection.
- `LogStream`: compact live process or CI logs.
- `DecisionCard`: recommendation with options and tradeoffs.

## Useful Commands

```bash
npm run lint
npm run test
npm run build
npm run electron:build
npm run electron:dev
```

## Architecture

```txt
External AI agent
  ↓ CLI or MCP
Electron resident broker
  ↓ local control API
renderGenUI() core
  ↓
.genui/artifacts/<artifactId>.json
  ↓
Electron popup window
  ↓
Next.js /preview/[artifactId]
  ↓
OpenUI React renderer
```

MCP is implemented as a thin stdio adapter. Electron remains the owner of popup windows and the local control API.

## Broker Contract

- Broker protocol version: `0.2.0`
- Status endpoint: `GET /v1/status`
- Component catalog endpoint: `GET /v1/components`
- Popup open endpoint: `POST /v1/popups`
- Popup close endpoint: `POST /v1/popups/:popupId/close`

CLI and MCP clients check the broker protocol version before opening or closing popups. If the resident app is using old code, restart it with `npm run electron:dev`.
