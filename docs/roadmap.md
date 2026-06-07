# Roadmap

## Phase 1: CLI-First Popup Runtime

Status: complete for local development.

- Electron tray app starts the local preview/dashboard service.
- Local control API opens and closes popup windows.
- CLI can show agent instructions, prompt spec, component catalog, status, and popups.
- CLI popup accepts caller-provided OpenUI Lang and auto-starts the broker when needed.
- Artifacts are saved under `.genui/artifacts`.
- Broker validates OpenUI Lang before saving artifacts.
- Agent-facing component catalog is exposed.
- Core explanation components exist: `MetricGrid`, `ActionPanel`, `TimelinePanel`, `DecisionMatrix`, `MapView`, `AudioPlayer`, `VideoPlayer`, `VideoPlaylist`.
- Preview renderer has defensive layout rules for agent-authored UI.
- Lint/test/build/electron-build pass.
- Local control API uses a per-run token for private and mutating endpoints.
- Popup wait mode can return explicit completion, cancellation, close, or failure.
- Dashboard can delete artifacts, and the API can prune artifact history.
- CLI can list/inspect/replay artifacts, list runtime popups, and prune saved artifacts.

## Phase 2: Agent Workflow Polish

Status: complete for the initial local workflow.

- Dashboard can inspect artifact metadata, context, and OpenUI Lang.
- Dashboard can replay saved artifacts and close active popups.
- OpenUI Lang examples cover coding, research, support, and data-quality agents.

## Phase 3: Packaging

- Build a local unsigned macOS `.zip` package.
- Keep `.dmg` as an optional host-dependent packaging target.
- Add macOS signing and notarization.
- Add optional login-item auto-start.
- Add installer and first-run onboarding.
