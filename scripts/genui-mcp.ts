#!/usr/bin/env tsx
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readBrokerState } from "../src/server/genui/broker-state";
import { BROKER_PROTOCOL_VERSION } from "../src/server/genui/version";

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

async function requestBroker(path: string, body?: unknown, method = "POST"): Promise<Record<string, unknown>> {
  const controlUrl = await resolveControlUrl();
  let response: Response;

  try {
    response = await fetch(`${controlUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`GenUI broker is not reachable. Start it with npm run electron:dev. Detail: ${detail}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`GenUI broker returned HTTP ${response.status}. Detail: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function ensureCompatibleBroker(): Promise<void> {
  let status: Record<string, unknown>;

  try {
    status = await requestBroker("/v1/status", undefined, "GET");
  } catch (error) {
    throw new Error(
      `GenUI broker is running but does not expose the current status contract. Restart it with npm run electron:dev. Detail: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (status.brokerProtocolVersion !== BROKER_PROTOCOL_VERSION) {
    throw new Error(
      `GenUI broker protocol mismatch. Expected ${BROKER_PROTOCOL_VERSION}, got ${
        status.brokerProtocolVersion ?? "unknown"
      }. Restart the resident broker with npm run electron:dev.`,
    );
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
      size: z
        .enum([
          "compact",
          "card",
          "panel",
          "default",
          "wide",
          "tall",
          "stage",
          "cinema",
          "fullscreen",
        ])
        .optional()
        .describe("Size preset. Omit to let the broker pick from the prompt."),
      width: z.number().int().min(240).max(4096).optional(),
      height: z.number().int().min(200).max(4096).optional(),
    },
  },
  async (input) => {
    await ensureCompatibleBroker();
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
    await ensureCompatibleBroker();
    const result = await requestBroker(`/v1/popups/${popupId}/close`);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  "genui.list_components",
  {
    description: "List GenUI custom components available in the resident broker.",
    inputSchema: {},
  },
  async () => {
    await ensureCompatibleBroker();
    const result = await requestBroker("/v1/components", undefined, "GET");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
