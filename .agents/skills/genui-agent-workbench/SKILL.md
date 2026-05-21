---
name: genui-agent-workbench
description: Use this skill when working on the genui-agent-workbench repository, especially for the Electron GenUI Popup Broker, CLI/MCP invocation, or OpenUI artifact rendering.
---

# genui-agent-workbench

## Purpose

This repository is a resident GenUI Popup Broker. Other AI agents call it through CLI or MCP to generate UI and open that UI in Electron popup windows.

OpenUI means the Generative UI framework from `@openuidev`, not the W3C Open UI community/spec project.

## Runtime Rules

- Electron owns tray lifecycle, local control API, popup windows, and the Next.js preview service.
- CLI and MCP are thin clients. They should call the resident broker, not open windows directly.
- Next.js is for dashboard and `/preview/[artifactId]`; it is not the popup lifecycle owner.
- Artifacts live under `.genui/artifacts` and must not be committed.
- Secrets stay out of the repo. Use `.env.example` and `.env.local`.

## Common Commands

- Start broker: `npm run electron:dev`
- Open popup: `npm run genui -- popup --prompt "..." --agent-id codex`
- Close popup: `npm run genui -- close --popup-id "<popupId>"`
- Start MCP: `npm run genui:mcp`
- Verify: `npm run lint`, `npm run test`, `npm run build`, `npm run electron:build`

## Implementation Guidance

- Prefer small changes around `renderGenUI`, artifact persistence, or popup lifecycle.
- Keep MCP tool schemas aligned with CLI inputs.
- Do not describe a generated popup as complete until Electron has opened a BrowserWindow or the control API returned a clear error.
- Document architectural changes in `docs/`.
