# MCP Integration

MCP is implemented as a thin adapter over the resident Electron broker. MCP clients do not render UI and do not own windows; they ask the broker to generate artifacts and open popups.

## Tools

- `genui.open_popup`
  - Input: `{ prompt, agentId?, title?, context?, mockData?, locale?, size?, width?, height? }`
  - Output: `{ popupId, artifactId, previewUrl, status, generationMode, brokerProtocolVersion }`
- `genui.close_popup`
  - Input: `{ popupId }`
  - Output: popup metadata with `status`
- `genui.list_components`
  - Input: `{}`
  - Output: `{ brokerProtocolVersion, components }`
- `genui.usage_guide`
  - Input: `{}`
  - Output: agent-oriented CLI/MCP guide, prompt patterns, component suggestions, and guardrails

## Operation

Run:

```bash
npm run genui:mcp
```

The MCP server resolves the broker URL from:

1. `GENUI_BROKER_URL`
2. `GENUI_SERVICE_URL`
3. `.genui/broker.json`
4. `http://127.0.0.1:48231`

Electron must be running before an MCP client calls `open_popup`, `close_popup`, or `list_components`.

## Agent Guidance

Agents should call `genui.usage_guide` once during setup or when unsure how to shape a visual explanation. For UI selection, call `genui.list_components`, then request a popup with a prompt that names the outcome:

```txt
この調査結果をKPI、リスク、次アクションで視覚化して。
```

```txt
候補案を比較して、推奨案と理由を視覚的に説明して。
```

## Protocol Compatibility

The MCP server checks `brokerProtocolVersion` before mutating popup state. If the resident app is running older code, restart it with:

```bash
npm run electron:dev
```

## Future Work

- Add structured popup completion events.
- Add optional agent-side `wait` mode.
- Add authenticated local access if the broker ever leaves localhost.
- Add deeper MCP-backed live data providers behind OpenUI `Query()` / `Mutation()`.
