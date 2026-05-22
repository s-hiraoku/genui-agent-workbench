# Roadmap

## Phase 1: Product-Level MVP Scaffold

Status: in progress.

- Electron tray app starts the local preview/dashboard service.
- Local control API opens and closes popup windows.
- CLI and MCP can request UI popups.
- Artifacts are saved under `.genui/artifacts`.
- Agent-facing component catalog is exposed.
- Agent usage guide is exposed through CLI and MCP.
- Core explanation components exist: `MetricGrid`, `ActionPanel`, `TimelinePanel`, `DecisionMatrix`, `MapView`, `AudioPlayer`, `VideoPlayer`.
- Preview renderer has defensive layout rules for generated UI.
- Lint/test/build/electron-build pass.

## Phase 2: Agent Workflow Polish

- Add popup completion semantics separate from window close.
- Add optional `wait` mode for agents that need user completion.
- Add dashboard controls for replaying, closing, and inspecting artifacts.
- Add richer examples for common agents: coding agent, research agent, support agent, data agent.

## Phase 3: Tool-Backed GenUI

- Add real tool providers behind OpenUI `Query()` / `Mutation()`.
- Replace mock data with MCP-backed business tools.
- Add preview-time toolProvider support where interactive UI needs live data.
- Add safe permissions and provenance labels for tool-sourced data.

## Phase 4: Packaging

- Harden production Next service startup inside packaged Electron.
- Add macOS signing and notarization.
- Add optional login-item auto-start.
- Add installer and first-run onboarding.
