# Agent Interface

This project is designed so other AI agents can use GenUI as a local visual explanation tool.

## When Agents Should Use It

Use GenUI Popup Broker when a human would understand faster with UI than with text:

- Status dashboards and KPI summaries.
- Incident timelines and release plans.
- Decision matrices and tradeoff comparisons.
- Maps, locations, routes, and site lists.
- Audio or video review.
- Next-action handoffs and approval prompts.

Do not use it for plain text answers, secrets, or workflows where the user does not need a visual surface.

## Preferred Agent Flow

1. Call `genui.usage_guide` or `npm run genui -- guide` during setup.
2. Call `genui.list_components` or `npm run genui -- components` if choosing a UI shape.
3. Call `genui.open_popup` with an outcome-oriented prompt and structured context.
4. Store `popupId`, `artifactId`, and `previewUrl` in the calling workflow.
5. Call `genui.close_popup` when the popup is no longer useful.

## MCP Contract

### `genui.open_popup`

Input:

```json
{
  "prompt": "この状況をKPI、リスク、次アクションで視覚化して。",
  "agentId": "codex",
  "title": "Status Review",
  "context": {
    "summary": "Optional structured data from the calling agent"
  },
  "mockData": "auto",
  "locale": "ja",
  "size": "panel"
}
```

Output:

```json
{
  "popupId": "pop_...",
  "artifactId": "art_...",
  "previewUrl": "http://127.0.0.1:3000/preview/art_...",
  "status": "open",
  "generationMode": "llm",
  "brokerProtocolVersion": "0.2.0"
}
```

### `genui.close_popup`

Input:

```json
{ "popupId": "pop_..." }
```

### `genui.list_components`

Returns the broker component catalog. Agents should use this when deciding which UI shape to request.

### `genui.usage_guide`

Returns prompt patterns, guardrails, CLI examples, and MCP tool guidance. Agents should use this as their self-serve onboarding document.

## CLI Contract

Open:

```bash
npm run genui -- popup --agent-id codex --title "Decision Review" --size wide --prompt "3つの案を比較して推奨案を出して"
```

Open with file-based context:

```bash
npm run genui -- popup --agent-id codex --prompt-file prompt.txt --context-file context.json --size wide
```

Open with inline context:

```bash
npm run genui -- popup --agent-id codex --prompt "このrowsを表で表示して" --context-json '{"rows":[{"id":"A-1","status":"blocked"}]}'
```

Close:

```bash
npm run genui -- close --popup-id "<popupId>"
```

Inspect:

```bash
npm run genui -- status
npm run genui -- components
npm run genui -- guide
```

## Size Presets

- `compact`: tiny focused confirmation.
- `card`: small explanation or one component.
- `panel`: default work surface for KPI/action UI.
- `wide`: comparison tables and decision matrices.
- `tall`: timelines and long lists.
- `stage`: maps and spatial UI.
- `cinema`: video-heavy UI.
- `fullscreen`: large review sessions.

Prefer presets before custom `width` and `height`.

## Prompt Style

Good prompts tell the broker what the user needs to understand or decide:

```txt
この状況をKPIカード、リスク、次アクションで視覚化して。
```

```txt
障害対応の流れをタイムラインで説明し、今すぐやることを出して。
```

```txt
候補案を比較して、推奨案と理由を視覚的に説明して。
```

```txt
カテゴリ別の件数と直近推移をチャートで表示して。
```

```txt
リスクと警告をseverity別に表示して。各項目に推奨アクションも付けて。
```

```txt
入力内容をフォーム確認UIで表示して。不足項目も示して。
```

```txt
関連ファイルと参考URLをリソース一覧として表示して。
```

```txt
このrowsを表で表示して。重要な行と次アクションも示して。
```

```txt
作業状況をTodo/Doing/Doneのボードで表示して。担当と状態も見せて。
```

```txt
この変更差分をレビュー用UIで表示して。追加・削除と確認ポイントも見せて。
```

Poor prompts are vague:

```txt
いい感じにして
```

## Guardrails

- Never pass secrets in prompt or context.
- Pass concrete data in `context` when available.
- Prefer `--context-file` for larger data; prefer `--context-json` only for small objects.
- Do not claim live data, tools, or MCP-backed sources were used unless the calling agent supplied that data.
- Keep each popup focused on one user decision or explanation.
- Close popups after the workflow no longer needs them.
