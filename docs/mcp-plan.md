# MCP Integration

MCP is now an implemented entrypoint, but it remains a thin adapter over the resident Electron broker.

## Tools

- `genui.open_popup`
  - Input: `{ prompt, agentId?, title?, context?, mockData?, locale? }`
  - Output: `{ popupId, artifactId, previewUrl, status }`
- `genui.close_popup`
  - Input: `{ popupId }`
  - Output: `{ popupId, artifactId, previewUrl, status }`
- `genui.list_components`
  - Input: `{}`
  - Output: `{ brokerProtocolVersion, components }`

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

Electron must be running before an MCP client calls the tools.

## Future Work

- Add structured popup completion events.
- Add authentication or origin restrictions if the broker leaves localhost.
- Add richer tool schemas for agent-specific UI patterns.
