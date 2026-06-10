# Practical Usability Plan

This document captures why GenUI Agent Workbench is not yet practical for
day-to-day use, and a prioritized plan to make it usable at a production level.

The analysis was driven by two reported pain points:

1. **UI quality / expressiveness** — popups don't always meet expectations.
2. **Weak agent integration** — hard for agents to discover, call, and author for.

Primary target use cases:

- **Agent work-review UI** — show build results, diffs, progress, and approvals.
- **General on-demand UI** — let an agent build whatever UI fits the moment.

## Why it is not practical today

### 1. The interaction loop is not closed (most critical)

The popup is effectively **display-only**. The work-review use case cannot work
because the agent never learns what the user did inside the popup.

- `ConfirmDialog` (Confirm/Cancel), `FormPanel` inputs, and `MessageThread`
  composer buttons are **non-functional decoration** — they have no handlers
  that report back. In `src/library.ts`, the only `onClick` handlers drive
  local tab/selection state, not agent feedback.
- The only thing a user can return is the window-chrome **Complete** button,
  which yields a coarse `completed | cancelled | closed | failed` outcome.
  - Source: `electron/main.ts` `completePopup()`; CLI `waitForPopup()` in
    `scripts/genui-cli.ts`; states in `src/server/genui/types.ts`.
- The agent therefore cannot tell **which button was pressed** or **what was
  typed** — so "show an approval dialog and branch on the result" and "collect
  values via a form" are impossible.

### 2. No path for agents to discover and call the tool

- **No MCP server.** Clients like Claude Code can't auto-discover the tool;
  every use needs hand-written instructions. (No `mcp` server file exists; see
  `.agents/skills/genui-agent-workbench/SKILL.md`.)
- The agent must **hand-write raw OpenUI Lang** (`root =`, nested arrays and
  object literals) exactly. It is easy to get rejected by validation, and the
  error messages are unfriendly — no line numbers, no typo suggestions.
  - Source: `src/server/genui/render.ts` `validateOpenUILang()` /
    `validationSummary()`.

### 3. Expressiveness gaps for the target use cases

- `CodeBlock` is a plain `<pre>` with **no syntax highlighting** → weak for
  diff/code-review (`src/library.ts`, around the `CodeBlock` definition).
- Window width is `min(100vw - 44px, 100%)` with **no fixed width preset**
  suited to diffs (e.g. 960–1200px) — `src/app/globals.css` `.lg-window-frame`.
- `TreeView`, `WizardForm`, `AnimationCard` are **placeholders / unimplemented**.
- Some contrast issues remain beyond the recently-fixed chart tooltip
  (e.g. HUD-theme glass labels, long-text tables).

## Improvement plan (prioritized)

| # | Action | Effect | Size |
|---|--------|--------|------|
| **1** | **Return interaction results to the agent.** Add `POST /v1/popups/:id/event`; give buttons/forms an `actionId`; send click/input values to the broker; have CLI `--wait` return the pressed button and entered values in `completion.payload`. | Work-review UI becomes **bidirectional**; approvals and form collection become usable. | Large |
| **2** | **Ship an MCP server.** Expose `genui_prompt_spec` / `genui_popup` / `genui_wait` as MCP tools. | Claude Code et al. can **auto-discover and call naturally**. | Medium |
| **3** | **Improve validation feedback.** Add line numbers and component-name typo suggestions to errors. | Higher success rate authoring OpenUI Lang by hand. | Small |
| **4** | **`CodeBlock` syntax highlighting** + diff-oriented fixed-width size preset. | Diff/review use case becomes practical. | Medium |
| **5** | **Finish placeholder components** (TreeView/WizardForm) and clear remaining contrast issues. | Close expressiveness gaps. | Medium |

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
