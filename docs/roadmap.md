# Roadmap

## Phase 1: CLI-First Popup Runtime

Status: in progress.

- Electron tray app starts the local preview/dashboard service.
- Local control API opens and closes popup windows.
- CLI can show agent instructions, prompt spec, component catalog, status, and popups.
- CLI popup accepts caller-provided OpenUI Lang and auto-starts the broker when needed.
- Artifacts are saved under `.genui/artifacts`.
- Broker validates OpenUI Lang before saving artifacts.
- Agent-facing component catalog is exposed.
- Core explanation components exist: `MetricGrid`, `ActionPanel`, `TimelinePanel`, `DecisionMatrix`, `MapView`, `AudioPlayer`, `VideoPlayer`.
- Preview renderer has defensive layout rules for agent-authored UI.
- Lint/test/build/electron-build pass.

## Phase 2: Agent Workflow Polish

- Add popup completion semantics separate from window close.
- Add optional `wait` mode for agents that need user completion.
- Add dashboard controls for replaying, closing, and inspecting artifacts.
- Add richer OpenUI Lang examples for coding, research, support, and data agents.

## Phase 3: Packaging

- Harden production Next service startup inside packaged Electron.
- Add macOS signing and notarization.
- Add optional login-item auto-start.
- Add installer and first-run onboarding.
