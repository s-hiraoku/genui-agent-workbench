# Roadmap

## Phase 1: Popup Broker MVP

- Electron tray app starts the local preview/dashboard service.
- Local control API opens and closes popup windows.
- CLI and MCP can request UI popups.
- Artifacts are saved under `.genui/artifacts`.

## Phase 2: Popup Workflow State

- Track user completion separately from window close.
- Add popup status history and dashboard controls.
- Add optional agent-side wait mode for long-running workflows.

## Phase 3: Tool-Backed GenUI

- Add real tool providers behind OpenUI `Query()` / `Mutation()`.
- Replace mock data with MCP-backed business tools.
- Add preview-time toolProvider support where interactive UI needs live data.

## Phase 4: Packaging

- Harden production Next service startup inside packaged Electron.
- Add macOS signing and notarization.
- Add optional login-item auto-start.
