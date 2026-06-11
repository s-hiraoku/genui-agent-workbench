#!/usr/bin/env node
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const EXPECTED_PROTOCOL_VERSION = "0.3.0";
const DEFAULT_CONTROL_URL = "http://127.0.0.1:48231";
const DEFAULT_APP_NAME = "GenUI Popup Broker";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const AGENT_WHEN_TO_USE = [
  "The user needs to inspect more than a few facts, rows, risks, options, or steps.",
  "A visual layout would make a decision, review, status report, or handoff clearer than prose.",
  "The task involves approvals, forms, checklists, diffs, maps, media, timelines, dashboards, or structured evidence.",
  "The agent should keep working in text while giving the user a separate local popup to review.",
];
const AGENT_WHEN_NOT_TO_USE = [
  "The answer is a single sentence or a short plain-text explanation.",
  "The user asked only for code edits, shell output, or a file change and no visual review is useful.",
  "The UI would contain secrets or sensitive data that should not be written to a local artifact.",
  "The agent cannot provide concrete data for the popup and would only show generic filler.",
];
const AGENT_COMMANDS = {
  doctor: "genui doctor --json",
  agentSnippet: "genui agent-snippet",
  agentInstructions: "genui agent-instructions",
  promptSpec: "genui prompt-spec",
  examples: "genui examples",
  validate: "genui validate --openui-lang-file ui.openui",
  components: "genui components",
  open: 'genui popup --agent-id <agent> --title <title> --size review --openui-lang-file ui.openui',
  openAndWait: 'genui popup --agent-id <agent> --title <title> --openui-lang-file ui.openui --wait',
  resize: "genui resize --popup-id <popupId> --size wide",
};

function agentSnippet() {
  return `## GenUI Popup Broker

If the \`genui\` CLI is available, use it when a local visual popup would make the answer easier to inspect: status dashboards, risks, decisions, checklists, tables, diffs, maps, media, diagnostics, insights, or approvals.

Paste this block into project instructions such as \`AGENTS.md\` when you want agents to discover and use GenUI automatically.

Before first use, run \`genui doctor --json\` to check availability. For authoring, run \`genui prompt-spec\` and generate OpenUI Lang directly; do not send natural-language UI requests to GenUI. Validate with \`genui validate --openui-lang-file <file>\`, then open with \`genui popup --openui-lang-file <file> --title "<title>" --agent-id "<agent-id>"\`.

Do not use GenUI for a short plain-text answer or generic placeholder UI. Never include secrets in OpenUI Lang or context.`;
}

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function shouldSkipBrokerStateError(error) {
  return error?.code === "ENOENT" || error instanceof SyntaxError;
}

function requestTimeoutMs() {
  const configured = Number(process.env.GENUI_CLI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REQUEST_TIMEOUT_MS;
}

function brokerStatePaths() {
  const home = os.homedir();
  return unique([
    process.env.GENUI_BROKER_STATE_FILE,
    process.env.GENUI_DATA_DIR ? path.join(process.env.GENUI_DATA_DIR, "broker.json") : "",
    home ? path.join(home, "Library", "Application Support", "GenUI Popup Broker", "genui-data", "broker.json") : "",
    home
      ? path.join(home, "Library", "Application Support", "genui-agent-workbench", "genui-data", "broker.json")
      : "",
    path.join(process.cwd(), ".genui", "broker.json"),
  ]);
}

async function readBrokerStates() {
  if (process.env.GENUI_BROKER_STATE_FILE) {
    try {
      const statePath = process.env.GENUI_BROKER_STATE_FILE;
      const state = JSON.parse(await fs.readFile(statePath, "utf8"));
      return state?.controlUrl ? [{ ...state, statePath, stateMtimeMs: Number.MAX_SAFE_INTEGER }] : [];
    } catch (error) {
      if (!shouldSkipBrokerStateError(error)) {
        throw error;
      }
    }
  }

  const states = [];
  for (const statePath of brokerStatePaths()) {
    try {
      const stat = await fs.stat(statePath);
      const state = JSON.parse(await fs.readFile(statePath, "utf8"));
      if (state?.controlUrl) {
        states.push({ ...state, statePath, stateMtimeMs: stat.mtimeMs });
      }
    } catch (error) {
      if (!shouldSkipBrokerStateError(error)) {
        throw error;
      }
    }
  }

  return states.sort((a, b) => b.stateMtimeMs - a.stateMtimeMs);
}

async function candidateConnections(options) {
  const token =
    (typeof options["service-token"] === "string" ? options["service-token"] : undefined) ??
    process.env.GENUI_BROKER_TOKEN;
  const urls = [
    typeof options["service-url"] === "string" ? options["service-url"] : "",
    process.env.GENUI_BROKER_URL,
    process.env.GENUI_SERVICE_URL,
  ].filter(Boolean);

  if (urls.length > 0) {
    return urls.map((controlUrl) => ({ controlUrl, controlToken: token }));
  }

  const states = await readBrokerStates();
  const fromState = states.map((state) => ({
    controlUrl: state.controlUrl,
    controlToken: token ?? state.controlToken,
    statePath: state.statePath,
  }));

  return [...fromState, { controlUrl: DEFAULT_CONTROL_URL, controlToken: token }];
}

async function requestRaw(url, init = {}, controlToken) {
  const headers = new Headers(init.headers);
  if (controlToken) {
    headers.set("x-genui-token", controlToken);
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), requestTimeoutMs());
  let response;
  try {
    response = await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`GenUI broker request timed out after ${requestTimeoutMs()}ms.`);
    }
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`GenUI broker is not reachable. Detail: ${detail}`);
  } finally {
    globalThis.clearTimeout(timeout);
  }

  const text = await response.text();
  if (!response.ok) {
    let detail = text;
    try {
      detail = JSON.stringify(JSON.parse(text));
    } catch {
      // Keep the plain text response.
    }
    throw new Error(`GenUI broker returned HTTP ${response.status}. Detail: ${detail}`);
  }

  return { response, text };
}

async function requestJson(url, init = {}, controlToken) {
  const { text } = await requestRaw(url, init, controlToken);
  return JSON.parse(text);
}

async function requestText(url, init = {}, controlToken) {
  const { text } = await requestRaw(url, init, controlToken);
  return text;
}

async function brokerStatus(connection) {
  try {
    return await requestJson(`${connection.controlUrl}/v1/status`, undefined, connection.controlToken);
  } catch {
    return null;
  }
}

function assertCompatibleBroker(status) {
  if (status.brokerProtocolVersion !== EXPECTED_PROTOCOL_VERSION) {
    throw new Error(
      `GenUI broker protocol mismatch. Expected ${EXPECTED_PROTOCOL_VERSION}, got ${
        status.brokerProtocolVersion ?? "unknown"
      }. Restart or update GenUI Popup Broker.`,
    );
  }
}

async function findReachableConnection(options) {
  for (const connection of await candidateConnections(options)) {
    const status = await brokerStatus(connection);
    if (status) {
      assertCompatibleBroker(status);
      return connection;
    }
  }

  return null;
}

function startBrokerProcess() {
  return new Promise((resolve, reject) => {
    if (process.platform !== "darwin") {
      reject(new Error("Auto-start is currently supported only on macOS."));
      return;
    }

    const appTarget = process.env.GENUI_BROKER_APP_PATH;
    const args = appTarget ? [appTarget] : ["-a", DEFAULT_APP_NAME];
    const child = spawn("open", args, {
      detached: true,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      console.error(`[genui] starting broker with "open ${args.join(" ")}"`);
      child.unref();
      resolve();
    });
  });
}

async function ensureBroker(options) {
  const current = await findReachableConnection(options);
  if (current) return current;

  if (options["no-start"] === true) {
    throw new Error(`GenUI broker is not reachable. Start ${DEFAULT_APP_NAME}.`);
  }

  try {
    await startBrokerProcess();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to start ${DEFAULT_APP_NAME}. Detail: ${detail}`);
  }

  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    await sleep(750);
    const connection = await findReachableConnection(options);
    if (connection) return connection;
  }

  throw new Error(`GenUI broker did not become ready within 45 seconds. Open ${DEFAULT_APP_NAME} manually.`);
}

async function readTextFile(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJsonObject(label, value) {
  const parsed = JSON.parse(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed;
}

async function resolveOpenUILang(options) {
  if (typeof options["openui-lang"] === "string") return options["openui-lang"];
  if (typeof options["openui-lang-file"] === "string") return readTextFile(options["openui-lang-file"]);
  if (options["stdin-openui"] === true || options.stdin === true) return readStdin();
  return "";
}

async function resolveContext(options) {
  const parts = [];

  if (typeof options["context-file"] === "string") {
    parts.push(parseJsonObject("--context-file", await readTextFile(options["context-file"])));
  }

  if (typeof options["context-json"] === "string") {
    parts.push(parseJsonObject("--context-json", options["context-json"]));
  }

  return parts.length === 0 ? undefined : Object.assign({}, ...parts);
}

async function resolvePayload(options) {
  if (typeof options["payload-file"] === "string") {
    return parseJsonObject("--payload-file", await readTextFile(options["payload-file"]));
  }

  if (typeof options["payload-json"] === "string") {
    return parseJsonObject("--payload-json", options["payload-json"]);
  }

  return undefined;
}

async function validateCommand(options) {
  const openuiLang = (await resolveOpenUILang(options)).trim();
  if (openuiLang.length === 0) {
    throw new Error("--openui-lang, --openui-lang-file, or --stdin-openui is required");
  }

  const connection = await ensureBroker(options);
  return requestJson(
    `${connection.controlUrl}/v1/validate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openuiLang }),
    },
    connection.controlToken,
  );
}

async function popup(options) {
  const openuiLang = (await resolveOpenUILang(options)).trim();
  if (openuiLang.length === 0) {
    throw new Error("--openui-lang, --openui-lang-file, or --stdin-openui is required");
  }

  const connection = await ensureBroker(options);
  const context = await resolveContext(options);
  const widthOption = typeof options.width === "string" ? Number(options.width) : undefined;
  const heightOption = typeof options.height === "string" ? Number(options.height) : undefined;
  const result = await requestJson(
    `${connection.controlUrl}/v1/popups`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openuiLang,
        agentId: options["agent-id"],
        title: options.title,
        context,
        locale: options.locale,
        size: typeof options.size === "string" ? options.size : undefined,
        width: Number.isFinite(widthOption) ? widthOption : undefined,
        height: Number.isFinite(heightOption) ? heightOption : undefined,
      }),
    },
    connection.controlToken,
  );

  if (options.wait === true) {
    return waitForPopup(connection, result, options);
  }

  return result;
}

async function close(options) {
  if (typeof options["popup-id"] !== "string" || options["popup-id"].trim().length === 0) {
    throw new Error("--popup-id is required");
  }

  const connection = await findReachableConnection(options);
  if (!connection) throw new Error("GenUI broker is not reachable.");
  return requestJson(
    `${connection.controlUrl}/v1/popups/${options["popup-id"]}/close`,
    { method: "POST" },
    connection.controlToken,
  );
}

async function resize(options) {
  if (typeof options["popup-id"] !== "string" || options["popup-id"].trim().length === 0) {
    throw new Error("--popup-id is required");
  }

  const connection = await findReachableConnection(options);
  if (!connection) throw new Error("GenUI broker is not reachable.");
  const widthOption = typeof options.width === "string" ? Number(options.width) : undefined;
  const heightOption = typeof options.height === "string" ? Number(options.height) : undefined;
  return requestJson(
    `${connection.controlUrl}/v1/popups/${encodeURIComponent(options["popup-id"])}/resize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        size: typeof options.size === "string" ? options.size : undefined,
        width: Number.isFinite(widthOption) ? widthOption : undefined,
        height: Number.isFinite(heightOption) ? heightOption : undefined,
      }),
    },
    connection.controlToken,
  );
}

async function complete(options) {
  if (typeof options["popup-id"] !== "string" || options["popup-id"].trim().length === 0) {
    throw new Error("--popup-id is required");
  }

  const connection = await findReachableConnection(options);
  if (!connection) throw new Error("GenUI broker is not reachable.");
  const outcome =
    options.outcome === "cancelled" || options.outcome === "failed" || options.outcome === "completed"
      ? options.outcome
      : "completed";
  const payload = await resolvePayload(options);

  return requestJson(
    `${connection.controlUrl}/v1/popups/${options["popup-id"]}/complete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome, payload }),
    },
    connection.controlToken,
  );
}

async function status(options) {
  const connection = await findReachableConnection(options);
  if (!connection) throw new Error("GenUI broker status is unavailable.");
  const result = await brokerStatus(connection);
  if (!result) throw new Error("GenUI broker status is unavailable.");
  return result;
}

async function waitForPopup(connection, opened, options) {
  const popupId = typeof opened.popupId === "string" ? opened.popupId : "";
  if (!popupId) return opened;

  const timeoutMs = typeof options["wait-timeout-ms"] === "string" ? Number(options["wait-timeout-ms"]) : 0;
  const deadline = timeoutMs > 0 ? Date.now() + timeoutMs : Number.POSITIVE_INFINITY;
  const terminalStates = new Set(["completed", "cancelled", "closed", "failed"]);

  while (Date.now() < deadline) {
    const current = await requestJson(
      `${connection.controlUrl}/v1/popups/${popupId}`,
      undefined,
      connection.controlToken,
    );
    if (typeof current.status === "string" && terminalStates.has(current.status)) {
      return current;
    }
    await sleep(750);
  }

  throw new Error(`Timed out waiting for popup ${popupId} after ${timeoutMs}ms.`);
}

async function textCommand(options, endpoint) {
  const connection = await ensureBroker(options);
  return requestText(`${connection.controlUrl}${endpoint}`, undefined, connection.controlToken);
}

async function jsonCommand(options, endpoint) {
  const connection = await ensureBroker(options);
  return requestJson(`${connection.controlUrl}${endpoint}`, undefined, connection.controlToken);
}

async function examples(options) {
  if (typeof options.name === "string") {
    const query = new URLSearchParams({ name: options.name });
    if (options.json === true) query.set("json", "1");
    const connection = await ensureBroker(options);
    if (options.json === true) {
      return requestJson(`${connection.controlUrl}/v1/examples?${query}`, undefined, connection.controlToken);
    }
    return requestText(`${connection.controlUrl}/v1/examples?${query}`, undefined, connection.controlToken);
  }

  return jsonCommand(options, "/v1/examples");
}

async function doctor(options) {
  let connection = await findReachableConnection(options);
  let broker = connection ? await brokerStatus(connection) : null;
  let brokerError;

  if (!broker && options.start === true) {
    try {
      connection = await ensureBroker(options);
      broker = await brokerStatus(connection);
    } catch (error) {
      brokerError = error instanceof Error ? error.message : String(error);
    }
  }

  const fallbackConnection = (await candidateConnections(options))[0] ?? { controlUrl: DEFAULT_CONTROL_URL };
  return {
    ok: true,
    cli: "genui",
    installed: true,
    brokerReachable: Boolean(broker),
    brokerProtocolVersion: EXPECTED_PROTOCOL_VERSION,
    controlUrl: connection?.controlUrl ?? fallbackConnection.controlUrl,
    canAutoStartBroker: process.platform === "darwin",
    broker,
    brokerError,
    whenToUse: AGENT_WHEN_TO_USE,
    whenNotToUse: AGENT_WHEN_NOT_TO_USE,
    quickStart: [
      "Run `genui prompt-spec` for the exact OpenUI Lang syntax and component signatures.",
      "Run `genui examples` to pick a starter, or `genui examples --name build-review > ui.openui`.",
      "Validate with `genui validate --openui-lang-file ui.openui`.",
      "Open with `genui popup --openui-lang-file ui.openui --title \"Status\" --agent-id <agent>`.",
    ],
    commands: AGENT_COMMANDS,
    nextSteps: broker
      ? [
          "Run `genui prompt-spec` for syntax.",
          "Generate OpenUI Lang and validate with `genui validate --openui-lang-file ui.openui`.",
          "Open with `genui popup --openui-lang-file ui.openui --title \"Status\" --agent-id <agent>`.",
        ]
      : [
          "The CLI is installed but the broker is not reachable yet.",
          "Run `genui doctor --start --json` to try starting it, or run `genui popup ...` which also auto-starts the broker.",
          "If startup fails, open GenUI Popup Broker manually and rerun `genui doctor --json`.",
        ],
  };
}

function printHelp() {
  console.log(`GenUI Popup Broker CLI

Usage:
  genui doctor --json
  genui agent-snippet
  genui agent-instructions
  genui prompt-spec
  genui components
  genui examples
  genui examples --name build-review > ui.openui
  genui validate --openui-lang-file ui.openui
  genui popup --openui-lang-file ui.openui --agent-id codex --title "Build Review"
  genui popup --openui-lang-file ui.openui --wait
  genui complete --popup-id "<popupId>" --outcome completed
  genui close --popup-id "<popupId>"
  genui resize --popup-id "<popupId>" --size wide
  genui status

Options:
  --service-url <url>       Override broker control URL
  --service-token <token>   Override broker control token
  --openui-lang <code>      Inline OpenUI Lang
  --openui-lang-file <path> Read OpenUI Lang from a UTF-8 text file
  --stdin-openui            Read OpenUI Lang from stdin
  --context-json <json>     Attach structured context as a JSON object
  --context-file <path>     Attach structured context from a JSON file
  --payload-json <json>     Complete popup with structured payload JSON
  --payload-file <path>     Complete popup with payload from a JSON file
  --title <title>           Popup window title
  --locale <locale>         auto | ja | en
  --size <preset>           compact | card | panel | default | wide | review | tall | stage | cinema | fullscreen
  --width <px>              Override window width (>= 240)
  --height <px>             Override window height (>= 200)
  --no-start                Do not auto-start the broker for popup, validate, or guide commands
  --wait                    Wait until the popup is completed, cancelled, closed, or failed
  --wait-timeout-ms <ms>    Timeout for --wait. Omit for no timeout
  --outcome <outcome>       completed | cancelled | failed
  --name <example>          Select an example for the examples command
  --json                    Return selected example as JSON
  --start                   For doctor: try to start the broker before reporting

Environment:
  GENUI_BROKER_APP_PATH     Path to GenUI Popup Broker.app for auto-start
  GENUI_BROKER_STATE_FILE   Path to broker.json
  GENUI_DATA_DIR            Directory containing broker.json
  GENUI_CLI_REQUEST_TIMEOUT_MS
                            Broker HTTP request timeout. Default: 30000
`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "popup") {
    console.log(JSON.stringify(await popup(options), null, 2));
    return;
  }

  if (command === "validate") {
    const result = await validateCommand(options);
    console.log(JSON.stringify(result, null, 2));
    if (result.valid === false) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "doctor") {
    console.log(JSON.stringify(await doctor(options), null, 2));
    return;
  }

  if (command === "agent-snippet") {
    console.log(agentSnippet());
    return;
  }

  if (command === "close") {
    console.log(JSON.stringify(await close(options), null, 2));
    return;
  }

  if (command === "resize") {
    console.log(JSON.stringify(await resize(options), null, 2));
    return;
  }

  if (command === "complete") {
    console.log(JSON.stringify(await complete(options), null, 2));
    return;
  }

  if (command === "status") {
    console.log(JSON.stringify(await status(options), null, 2));
    return;
  }

  if (command === "components") {
    console.log(JSON.stringify(await jsonCommand(options, "/v1/components"), null, 2));
    return;
  }

  if (command === "examples") {
    const result = await examples(options);
    if (typeof result === "string") {
      console.log(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (command === "guide") {
    console.log(JSON.stringify(await jsonCommand(options, "/v1/guide"), null, 2));
    return;
  }

  if (command === "prompt-spec") {
    console.log(await textCommand(options, "/v1/prompt-spec"));
    return;
  }

  if (command === "agent-instructions") {
    console.log(await textCommand(options, "/v1/agent-instructions"));
    return;
  }

  printHelp();
  if (command !== "help") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
