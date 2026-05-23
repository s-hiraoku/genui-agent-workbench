---
name: genui-agent-workbench
description: Use this skill when working on the genui-agent-workbench repository, especially for the Electron GenUI Popup Broker, CLI invocation, or OpenUI artifact rendering.
---

# genui-agent-workbench

## Purpose

This repository is a resident GenUI Popup Broker. Other AI agents call it through the CLI with OpenUI Lang to open Electron popup windows.

OpenUI means the Generative UI framework from `@openuidev`, not the W3C Open UI community/spec project.

The product goal is to make GenUI the visual explanation layer that agents reach for when plain text is not enough.

## Runtime Rules

- Electron owns tray lifecycle, local control API, popup windows, and the Next.js preview service.
- CLI is the supported agent-facing client. It should call the resident broker, not open windows directly.
- Next.js is for dashboard and `/preview/[artifactId]`; it is not the popup lifecycle owner.
- Artifacts live under `.genui/artifacts` and must not be committed.
- Secrets stay out of the repo. Use `.env.example` and `.env.local`.
- Keep agent-facing interfaces aligned: CLI help, `src/server/genui/agent-guide.ts`, component catalog, README, and docs.
- Broker does not call an LLM and does not infer UI from natural-language prompts. Calling agents generate OpenUI Lang.

## Common Commands

- Start broker: `npm run electron:dev`
- Inspect agent instructions: `npm run genui -- agent-instructions`
- Inspect OpenUI prompt spec: `npm run genui -- prompt-spec`
- Open popup: `npm run genui -- popup --openui-lang-file ui.openui --agent-id codex`
- Close popup: `npm run genui -- close --popup-id "<popupId>"`
- Inspect agent guide: `npm run genui -- guide`
- Inspect components: `npm run genui -- components`
- Verify: `npm run lint`, `npm run test`, `npm run build`, `npm run electron:build`

## Agent-Facing Components

- `MetricGrid`: KPI/status summaries.
- `KeyValuePanel`: compact facts and metadata.
- `AlertList`: risks, warnings, blockers, validation findings.
- `ProgressStepper`: staged workflows and approvals.
- `BarChart` / `LineChart`: comparison and trend charts.
- `ResourceList`: files, URLs, docs, references, artifacts.
- `FormPanel`: input review and missing-field checks.
- `ActionPanel`: next actions and handoffs.
- `TimelinePanel`: chronological explanations.
- `DecisionMatrix`: comparisons and recommendations.
- `DataTable`: structured rows, evidence, tickets, file lists.
- `TaskBoard`: queues, plans, triage lanes, agent handoffs.
- `CodeDiff`: code/config/prompt/document change review.
- `MapView`: locations, routes, sites, and incidents.
- `AudioPlayer`: music, voice notes, podcasts, recordings.
- `VideoPlayer`: demos, clips, tutorials, walkthroughs.

## Implementation Guidance

- Prefer small changes around OpenUI Lang validation, artifact persistence, or popup lifecycle.
- Prefer `--context-file` for real data instead of embedding large JSON in OpenUI Lang.
- Do not describe a generated popup as complete until Electron has opened a BrowserWindow or the control API returned a clear error.
- Document architectural changes in `docs/`.
- When adding a GenUI component, update `src/library.ts`, `src/server/genui/component-catalog.ts`, tests, README, and `docs/agent-interface.md`.
- Keep generated UI resilient in small popups: avoid fixed viewport assumptions, preserve aspect ratios, and make overflow scroll predictably.
