#!/usr/bin/env node
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";

const repoRoot = process.cwd();
const terminalStates = new Set(["completed", "cancelled", "closed", "failed"]);

function textResult(text) {
  return { content: [{ type: "text", text }] };
}

function jsonResult(value) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function runGenui(args, stdin) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "genui", "--", ...args], {
      cwd: repoRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `genui exited with code ${code}`));
    });
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

async function readJsonIfExists(file) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function readBrokerState() {
  const candidates = [
    process.env.GENUI_BROKER_STATE_FILE,
    path.join(repoRoot, ".genui", "broker.json"),
    path.join(os.homedir(), "Library", "Application Support", "GenUI Popup Broker", "genui-data", "broker.json"),
    path.join(os.homedir(), "Library", "Application Support", "genui-agent-workbench", "genui-data", "broker.json"),
  ].filter(Boolean);

  const states = [];
  for (const file of candidates) {
    const state = await readJsonIfExists(file);
    if (!state?.controlUrl) continue;
    try {
      const stat = await fs.stat(file);
      states.push({ ...state, stateMtimeMs: stat.mtimeMs });
    } catch {
      states.push(state);
    }
  }
  states.sort((a, b) => (b.stateMtimeMs ?? 0) - (a.stateMtimeMs ?? 0));
  return states[0] ?? null;
}

async function brokerJson(endpoint) {
  const state = await readBrokerState();
  if (!state?.controlUrl) {
    throw new Error("GenUI broker state not found. Start the broker with `npm run electron:dev`.");
  }
  const headers = state.controlToken ? { "x-genui-token": state.controlToken } : undefined;
  const res = await fetch(`${state.controlUrl}${endpoint}`, { headers });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `Broker returned HTTP ${res.status}`);
  return JSON.parse(text);
}

const server = new McpServer({
  name: "genui-agent-workbench",
  version: "0.1.0",
});

server.registerTool(
  "genui_prompt_spec",
  {
    description: "Return the OpenUI Lang prompt spec and GenUI authoring guidance.",
    inputSchema: {},
  },
  async () => textResult(await runGenui(["prompt-spec"])),
);

server.registerTool(
  "genui_validate",
  {
    description: "Validate OpenUI Lang before opening a popup.",
    inputSchema: {
      openuiLang: z.string().describe("OpenUI Lang source to validate."),
    },
  },
  async ({ openuiLang }) => jsonResult(JSON.parse(await runGenui(["validate", "--stdin-openui"], openuiLang))),
);

server.registerTool(
  "genui_popup",
  {
    description: "Open a GenUI popup from OpenUI Lang. Use wait=true for approval/form flows.",
    inputSchema: {
      openuiLang: z.string().describe("OpenUI Lang source to render."),
      title: z.string().optional().describe("Popup title."),
      agentId: z.string().optional().describe("Calling agent id."),
      size: z.enum(["compact", "card", "panel", "default", "wide", "review", "tall", "stage", "cinema", "fullscreen"]).optional(),
      wait: z.boolean().optional().describe("Wait for popup completion and return completion payload."),
      waitTimeoutMs: z.number().int().positive().optional(),
    },
  },
  async ({ openuiLang, title, agentId, size, wait, waitTimeoutMs }) => {
    const args = ["popup", "--stdin-openui"];
    if (title) args.push("--title", title);
    if (agentId) args.push("--agent-id", agentId);
    if (size) args.push("--size", size);
    if (wait) args.push("--wait");
    if (waitTimeoutMs) args.push("--wait-timeout-ms", String(waitTimeoutMs));
    return jsonResult(JSON.parse(await runGenui(args, openuiLang)));
  },
);

server.registerTool(
  "genui_wait",
  {
    description: "Wait for an existing popup id to reach a terminal state and return its completion payload.",
    inputSchema: {
      popupId: z.string(),
      timeoutMs: z.number().int().positive().optional(),
    },
  },
  async ({ popupId, timeoutMs }) => {
    const deadline = timeoutMs ? Date.now() + timeoutMs : Number.POSITIVE_INFINITY;
    while (Date.now() < deadline) {
      const popup = await brokerJson(`/v1/popups/${encodeURIComponent(popupId)}`);
      if (terminalStates.has(popup.status)) return jsonResult(popup);
      await sleep(750);
    }
    throw new Error(`Timed out waiting for popup ${popupId} after ${timeoutMs}ms.`);
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
