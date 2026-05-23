# Architecture

`genui-agent-workbench` is a resident OpenUI Lang popup runtime for AI agents.

## Runtime Flow

```txt
AI agent
  ↓ reads CLI prompt-spec and components
OpenUI Lang
  ↓ `npm run genui -- popup --openui-lang-file ...`
Electron main process
  ↓ local control API
renderGenUI(input)
  ↓ validate + save artifact
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
- `scripts/genui-cli.ts` is the supported agent-facing interface. It exposes authoring instructions and sends OpenUI Lang to the broker.
- `src/server/genui/render.ts` validates caller-provided OpenUI Lang and creates artifacts. It does not call an LLM and does not infer UI from natural language.
- `src/library.ts` owns OpenUI custom components, schemas, prompt guidance, and visual implementation.
- `src/server/genui/component-catalog.ts` owns concise component discovery metadata.
- `src/server/genui/agent-guide.ts` owns CLI-first usage guidance.
- `src/server/genui/artifacts.ts` owns `.genui/artifacts` persistence.
- Next.js owns the dashboard and artifact preview rendering only.

## Control API

- `GET /v1/status`: inspect broker protocol version and runtime status.
- `GET /v1/components`: list GenUI components.
- `GET /v1/guide`: return agent-facing usage guidance.
- `GET /v1/sizes`: list popup size presets and approximate dimensions.
- `GET /v1/settings`: read resident broker settings.
- `POST /v1/settings`: update resident broker settings.
- `POST /v1/popups`: validate OpenUI Lang, create an artifact, and open a popup.
- `GET /v1/popups/:popupId`: inspect popup state.
- `POST /v1/popups/:popupId/close`: close a popup.

The control API is local-only on `127.0.0.1`. The current URL is written to `.genui/broker.json`.

## Artifact Model

Artifacts are JSON files in `.genui/artifacts`. They contain caller-provided OpenUI Lang, caller metadata, optional context, generation mode, locale, and timestamps. Closed popups do not delete artifacts.

`generationMode` is currently always `provided`, meaning the calling agent supplied the OpenUI Lang.

## Component Strategy

The component library is the design boundary. Agents compose components; this repo owns the actual React implementation and styling.

Every new component should be registered in `src/library.ts`, `src/server/genui/component-catalog.ts`, docs, and tests when behavior is user-visible.

## Renderer Stability

Popup previews are constrained by a dedicated renderer wrapper. The renderer applies:

- container-query aware spacing;
- stable scroll boundaries;
- media max-width and aspect-ratio constraints;
- table/pre/code wrapping;
- narrow-container fallback for generated grid layouts.

This is intentionally defensive because agent-authored UI can contain arbitrary component combinations and long text.
