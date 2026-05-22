# Architecture

`genui-agent-workbench` is a resident GenUI Popup Broker. It is not primarily a standalone chat app.

## Runtime Flow

```txt
External AI agent
  ↓ CLI or MCP
Electron main process
  ↓ local control API
renderGenUI(input)
  ↓ OpenAI + OpenUI system prompt
artifact store under .genui/
  ↓
BrowserWindow popup
  ↓
Next.js /preview/[artifactId]
  ↓
OpenUI Renderer
```

## Responsibilities

- Electron main process owns the tray, popup lifecycle, local control API, and Next.js child service.
- `src/server/genui/render.ts` owns prompt normalization, mock context selection, OpenAI calls, and artifact creation.
- `src/server/genui/artifacts.ts` owns `.genui/artifacts` persistence.
- `scripts/genui-cli.ts` and `scripts/genui-mcp.ts` are thin clients that call the resident broker.
- Next.js owns the dashboard and artifact preview rendering only.

## Local Control API

- `POST /v1/popups`: generate an artifact and open a popup.
- `GET /v1/popups/:popupId`: inspect popup state.
- `POST /v1/popups/:popupId/close`: close a popup.
- `GET /v1/status`: inspect broker protocol version and runtime status.
- `GET /v1/components`: list custom GenUI components.

The control API is local-only on `127.0.0.1`. The current URL is written to `.genui/broker.json`.

## Artifact Model

Artifacts are JSON files in `.genui/artifacts`. They contain the prompt, OpenUI Lang response, model, caller metadata, and timestamps. Closed popups do not delete artifacts.

Artifacts include `generationMode`:

- `llm`: OpenAI generated the OpenUI Lang.
- `fallback`: deterministic local fallback was used.
