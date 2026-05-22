# genui-agent-workbench

A resident GenUI Popup Broker for AI agents.

`genui-agent-workbench` is a local visual surface for agent workflows. Other AI agents call it through CLI, MCP, or repository-local Skill instructions when they need to explain something to a human with generated UI. The Electron app stays resident, generates an OpenUI artifact, and opens the result in a dedicated popup window.

OpenUI means the Generative UI framework from `@openuidev`, not the W3C Open UI community/spec project.

## Product Concept

GenUI is treated as a tool, not as a standalone chat app.

The intended flow:

1. Start the resident Electron broker once.
2. Any AI agent calls the broker through CLI or MCP.
3. The agent sends `prompt`, optional `context`, `agentId`, `title`, and a size preset.
4. The broker generates an OpenUI artifact and saves it under `.genui/artifacts`.
5. Electron opens a popup that renders `/preview/[artifactId]`.
6. The user closes the popup, or the calling agent closes it later by `popupId`.

The goal is to make this an interface layer that AI agents naturally reach for when text is not enough: status dashboards, decision support, timelines, maps, media previews, task handoffs, and compact explanations.

## MVP Status

This scaffold includes:

- Electron tray-resident broker.
- Local control API owned by Electron main.
- Next.js dashboard and `/preview/[artifactId]` renderer.
- CLI client for popup open/close/status/component discovery/usage guide.
- MCP stdio server with agent-oriented tools.
- OpenUI + custom GenUI component library.
- Deterministic fallback renderer for local development without OpenAI.
- Artifact store under `.genui/`.
- Broker protocol version checks for CLI/MCP compatibility.
- Unit coverage for artifact generation, fallback routing, broker state, component catalog, and agent guide.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set `OPENAI_API_KEY` in `.env.local` for real LLM generation.

For local smoke tests without OpenAI:

```bash
GENUI_MOCK_RENDER=1 npm run electron:dev
```

## Run

Start the resident broker:

```bash
npm run electron:dev
```

Electron starts the Next.js preview service, starts the local control API, writes `.genui/broker.json`, and stays available from the tray.

## CLI

Open a popup:

```bash
npm run genui -- popup \
  --agent-id codex \
  --title "Sales Review" \
  --size panel \
  --prompt "売上ダッシュボードを作って。KPI、リスク、次のアクションを表示して。"
```

Open a popup with structured context from files:

```bash
npm run genui -- popup \
  --agent-id codex \
  --title "Triage Table" \
  --size wide \
  --prompt-file prompt.txt \
  --context-file context.json
```

Useful context shape for table-style UI:

```json
{
  "columns": [
    { "key": "id", "label": "ID" },
    { "key": "status", "label": "Status" },
    { "key": "next", "label": "Next action" }
  ],
  "rows": [
    { "id": "A-1", "status": "blocked", "next": "Escalate owner" }
  ]
}
```

Close a popup:

```bash
npm run genui -- close --popup-id "<popupId>"
```

Inspect the broker:

```bash
npm run genui -- status
npm run genui -- components
npm run genui -- guide
```

`popup` returns JSON:

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

`generationMode` is `"llm"` when OpenAI generated the artifact and `"fallback"` when local deterministic generation was used.

## MCP

Run the MCP stdio server:

```bash
npm run genui:mcp
```

Tools:

- `genui.open_popup`: generate an artifact and open a popup.
- `genui.close_popup`: close a popup by `popupId`.
- `genui.list_components`: list available custom GenUI components.
- `genui.usage_guide`: return agent-oriented usage patterns, CLI examples, MCP affordances, prompt patterns, and guardrails.

The MCP server expects the Electron broker to already be running. It resolves the local broker URL from `GENUI_BROKER_URL`, `GENUI_SERVICE_URL`, `.genui/broker.json`, or `http://127.0.0.1:48231`.

## Built-In GenUI Components

Agent explanation components:

- `MetricGrid`: KPI/status cards for dashboards, health checks, and progress summaries.
- `ActionPanel`: prioritized next actions with owner, due date, and severity.
- `TimelinePanel`: chronological explanation for incidents, releases, research, and workflows.
- `DecisionMatrix`: option comparison for recommendations and tradeoffs.
- `DataTable`: operational rows, tickets, file lists, research results, rankings, and evidence.
- `TaskBoard`: task queues, implementation plans, triage lanes, QA status, and agent handoffs.
- `CodeDiff`: code/config/prompt/document diffs for review.

Media and spatial components:

- `MapView`: OpenStreetMap-backed panel with center, zoom, height, and colored markers.
- `AudioPlayer`: playlist-style audio player for music, voice notes, podcasts, and recordings.
- `VideoPlayer`: video player with poster, chapters, and transcript support.

The renderer also adds popup-specific layout hardening: stable scroll boundaries, container-query aware content, media aspect-ratio constraints, table wrapping, and overflow protection.

## Agent Prompt Patterns

Use outcome-oriented prompts:

```txt
この状況をKPIカード、リスク、次アクションで視覚化して。
```

```txt
障害対応の流れをタイムラインで説明し、今すぐやることを出して。
```

```txt
3つの実装案を比較して、推奨案と理由を視覚的に説明して。
```

```txt
このrowsを表で表示して。重要な行と次アクションも示して。
```

```txt
作業状況をTodo/Doing/Doneのボードで表示して。担当と状態も見せて。
```

```txt
この変更差分をレビュー用UIで表示して。追加・削除と確認ポイントも見せて。
```

```txt
東京の顧客拠点を地図で表示して。優先度別にマーカーを分けて。
```

```txt
デモ動画をチャプター付きで表示して。重要な場面もまとめて。
```

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

The API is local-only on `127.0.0.1`. CLI and MCP check `brokerProtocolVersion` before mutating popup state.

## Architecture

```txt
External AI agent
  ↓ CLI / MCP / Skill-guided workflow
Electron resident broker
  ↓ local control API
renderGenUI(input)
  ↓ OpenAI or deterministic fallback
.genui/artifacts/<artifactId>.json
  ↓
Electron BrowserWindow popup
  ↓
Next.js /preview/[artifactId]
  ↓
OpenUI React renderer + custom component library
```

Electron owns popup lifecycle. CLI and MCP are thin clients. Next.js owns dashboard and preview rendering.

## Validation

```bash
npm run lint
npm run test
npm run build
npm run electron:build
```

## Repository Notes

- Do not commit `.env`, `.env.local`, `.genui/`, build output, or secrets.
- Keep new UI components registered in both `src/library.ts` and `src/server/genui/component-catalog.ts`.
- Keep MCP schemas, CLI options, and `docs/agent-interface.md` aligned.
- Document architectural changes in `docs/`.
