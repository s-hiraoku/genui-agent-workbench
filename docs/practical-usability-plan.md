# Practical Usability Plan

This document captures why GenUI Agent Workbench is not yet practical for
day-to-day use, and a prioritized plan to make it usable at a production level.

The analysis was driven by two reported pain points:

1. **UI quality / expressiveness** — popups don't always meet expectations.
2. **Weak agent integration** — hard for agents to discover, call, and author for.

Primary target use cases:

- **Agent work-review UI** — show build results, diffs, progress, and approvals.
- **General on-demand UI** — let an agent build whatever UI fits the moment.

## Implementation status

This plan has been implemented as the baseline practical workflow:

- Popups can now send interaction events back to the broker through
  `POST /v1/popups/:popupId/event`.
- `ConfirmDialog`, `FormPanel`, `WizardForm`, and `MessageThread` can use
  `actionId` to report button choices, form values, and messages.
- `genui popup --wait` returns recorded interaction data in
  `completion.payload`.
- A stdio MCP server is available through `npm run genui:mcp`.
- Validation errors include line-oriented context and component-name
  suggestions where possible.
- `CodeBlock` has lightweight syntax highlighting and line numbers.
- A `review` size preset supports diff/code/approval workflows.

The sections below remain useful as design rationale and future QA checklist.

## Why it was not practical before this implementation

### 1. The interaction loop is not closed (most critical)

Previously, the popup was effectively **display-only**. The work-review use case
could not work because the agent never learned what the user did inside the
popup.

- `ConfirmDialog` (Confirm/Cancel), `FormPanel` inputs, and `MessageThread`
  composer buttons needed handlers that report back to the broker.
- The only thing a user can return is the window-chrome **Complete** button,
  which yields a coarse `completed | cancelled | closed | failed` outcome.
  - Source: `electron/main.ts` `completePopup()`; CLI `waitForPopup()` in
    `scripts/genui-cli.ts`; states in `src/server/genui/types.ts`.
- The agent could not tell **which button was pressed** or **what was typed**.

### 2. No path for agents to discover and call the tool

- **No MCP server.** Clients like Claude Code could not auto-discover the tool;
  every use needed hand-written instructions.
- The agent must **hand-write raw OpenUI Lang** (`root =`, nested arrays and
  object literals) exactly. It is easy to get rejected by validation, and the
  error messages are unfriendly — no line numbers, no typo suggestions.
  - Source: `src/server/genui/render.ts` `validateOpenUILang()` /
    `validationSummary()`.

### 3. Expressiveness gaps for the target use cases

- `CodeBlock` needed syntax highlighting for code-review readability.
- The popup size presets needed a diff/review-oriented fixed-width option.
- `WizardForm` needed real step navigation and submission behavior.
- Some contrast issues remain beyond the recently-fixed chart tooltip
  (e.g. HUD-theme glass labels, long-text tables).

## Improvement plan (prioritized)

| # | Action | Effect | Size |
|---|--------|--------|------|
| # | Action | Status |
|---|--------|--------|
| **1** | Return interaction results to the agent. | Implemented |
| **2** | Ship an MCP server. | Implemented |
| **3** | Improve validation feedback. | Implemented |
| **4** | `CodeBlock` syntax highlighting + diff-oriented fixed-width size preset. | Implemented |
| **5** | Finish placeholder components and clear remaining contrast issues. | Implemented for WizardForm/TreeView/AnimationCard baseline; continue visual QA as components evolve. |

**Start with #1 (bidirectional interaction).** Without it, no amount of visual
polish makes the popup work as an "agent work-review UI." Implementing it raises
the tool's value immediately.

### #1 design sketch (for when implementation begins)

- **Broker:** new `POST /v1/popups/:popupId/event` endpoint that records UI
  events (`actionId`, value) onto the popup runtime; keep `complete` for the
  terminal outcome. (`electron/main.ts`)
- **Component library:** add an optional `actionId` (and for inputs, a field
  key) to interactive components; wire real `onClick`/`onChange` handlers in
  `ConfirmDialog`, `FormPanel`, `MessageThread`. Post events to the broker via
  the same control URL + token already used by `PreviewClient.tsx`.
- **CLI:** `waitForPopup()` returns `completion.payload` carrying the last/most
  relevant event(s) — the pressed button and collected field values.
  (`scripts/genui-cli.ts`)
- **Types:** extend `PopupCompletion.payload` shape and document it.
  (`src/server/genui/types.ts`)
- **Docs:** update `docs/agent-interface.md` and CLI guidance so agents know
  the result is now actionable.

## Quality notes from the review

- UI quality score today: ~7.5/10 (design strong; interaction + a few
  components weak).
- `npm run build` currently passes; placeholder components compile because they
  are schema-only and have stub `component` functions.
