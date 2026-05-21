#!/usr/bin/env tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readBrokerState } from "../src/server/genui/broker-state";

async function resolveControlUrl(): Promise<string> {
  if (process.env.GENUI_BROKER_URL) {
    return process.env.GENUI_BROKER_URL;
  }

  if (process.env.GENUI_SERVICE_URL) {
    return process.env.GENUI_SERVICE_URL;
  }

  const state = await readBrokerState();
  return state?.controlUrl ?? "http://127.0.0.1:48231";
}

async function requestBroker(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const controlUrl = await resolveControlUrl();

  try {
    const response = await fetch(`${controlUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      throw new Error(JSON.stringify(payload));
    }

    return payload;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`GenUI broker is not reachable. Start it with npm run electron:dev. Detail: ${detail}`);
  }
}

const server = new McpServer({
  name: "genui-popup-broker",
  version: "0.1.0",
});

server.registerTool(
  "genui.open_popup",
  {
    description: "Generate a GenUI artifact and open it in a resident Electron popup.",
    inputSchema: {
      prompt: z.string().min(1),
      agentId: z.string().optional(),
      title: z.string().optional(),
      context: z.record(z.string(), z.unknown()).optional(),
      mockData: z.enum(["auto", "sales", "support", "none"]).optional(),
      locale: z.enum(["auto", "ja", "en"]).optional(),
    },
  },
  async (input) => {
    const result = await requestBroker("/v1/popups", input);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  "genui.close_popup",
  {
    description: "Close a GenUI popup by popupId.",
    inputSchema: {
      popupId: z.string().min(1),
    },
  },
  async ({ popupId }) => {
    const result = await requestBroker(`/v1/popups/${popupId}/close`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
