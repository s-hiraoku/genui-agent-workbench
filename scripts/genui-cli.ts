#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { readBrokerState } from "../src/server/genui/broker-state";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { genUIExamples, getGenUIExample } from "../src/server/genui/examples";
import { OpenUILangValidationError, validateOpenUILang } from "../src/server/genui/render";
import { BROKER_PROTOCOL_VERSION } from "../src/server/genui/version";
import { library, promptOptions } from "../src/library";

type CliOptions = Record<string, string | boolean>;
type BrokerConnection = {
  controlUrl: string;
  controlToken?: string;
};
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv: string[]): { command: string; options: CliOptions } {
  const [command = "help", ...rest] = argv;
  const options: CliOptions = {};

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

async function resolveControlUrl(options: CliOptions): Promise<string> {
  if (typeof options["service-url"] === "string") return options["service-url"];
  if (process.env.GENUI_BROKER_URL) return process.env.GENUI_BROKER_URL;
  if (process.env.GENUI_SERVICE_URL) return process.env.GENUI_SERVICE_URL;

  const state = await readBrokerState();
  return state?.controlUrl ?? "http://127.0.0.1:48231";
}

async function resolveBrokerConnection(options: CliOptions): Promise<BrokerConnection> {
  const state = await readBrokerState();
  return {
    controlUrl: await resolveControlUrl(options),
    controlToken:
      (typeof options["service-token"] === "string" ? options["service-token"] : undefined) ??
      process.env.GENUI_BROKER_TOKEN ??
      state?.controlToken,
  };
}

async function requestJson(
  url: string,
  init?: RequestInit,
  controlToken?: string,
): Promise<Record<string, unknown>> {
  let response: Response;
  const headers = new Headers(init?.headers);
  if (controlToken) {
    headers.set("x-genui-token", controlToken);
  }

  try {
    response = await fetch(url, { ...init, headers });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`GenUI broker is not reachable. Detail: ${detail}`);
  }

  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`GenUI broker returned HTTP ${response.status}. Detail: ${JSON.stringify(body)}`);
  }

  return body;
}

async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf8");
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseJsonObject(label: string, value: string): Record<string, unknown> {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}

async function resolveOpenUILang(options: CliOptions): Promise<string> {
  if (typeof options["openui-lang"] === "string") return options["openui-lang"];
  if (typeof options["openui-lang-file"] === "string") return readTextFile(options["openui-lang-file"]);
  if (options["stdin-openui"] === true || options.stdin === true) return readStdin();
  return "";
}

async function resolveContext(options: CliOptions): Promise<Record<string, unknown> | undefined> {
  const parts: Record<string, unknown>[] = [];

  if (typeof options["context-file"] === "string") {
    parts.push(parseJsonObject("--context-file", await readTextFile(options["context-file"])));
  }

  if (typeof options["context-json"] === "string") {
    parts.push(parseJsonObject("--context-json", options["context-json"]));
  }

  return parts.length === 0 ? undefined : Object.assign({}, ...parts);
}

async function resolvePayload(options: CliOptions): Promise<Record<string, unknown> | undefined> {
  if (typeof options["payload-file"] === "string") {
    return parseJsonObject("--payload-file", await readTextFile(options["payload-file"]));
  }

  if (typeof options["payload-json"] === "string") {
    return parseJsonObject("--payload-json", options["payload-json"]);
  }

  return undefined;
}

async function brokerStatus(connection: BrokerConnection): Promise<Record<string, unknown> | null> {
  try {
    return await requestJson(`${connection.controlUrl}/v1/status`, undefined, connection.controlToken);
  } catch {
    return null;
  }
}

function assertCompatibleBroker(status: Record<string, unknown>): void {
  if (status.brokerProtocolVersion !== BROKER_PROTOCOL_VERSION) {
    throw new Error(
      `GenUI broker protocol mismatch. Expected ${BROKER_PROTOCOL_VERSION}, got ${
        status.brokerProtocolVersion ?? "unknown"
      }. Restart the resident broker.`,
    );
  }
}

function startBrokerProcess(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "electron:dev"], {
      cwd: repoRoot,
      detached: true,
      env: process.env,
      stdio: "ignore",
    });

    child.once("error", reject);
    child.once("spawn", () => {
      console.error(`[genui] starting broker with "npm run electron:dev" in ${repoRoot}`);
      child.unref();
      resolve();
    });
  });
}

async function ensureBroker(options: CliOptions): Promise<BrokerConnection> {
  let connection = await resolveBrokerConnection(options);
  let status = await brokerStatus(connection);
  if (status) {
    assertCompatibleBroker(status);
    return connection;
  }

  if (options["no-start"] === true) {
    throw new Error("GenUI broker is not reachable. Start it with npm run electron:dev.");
  }

  try {
    await startBrokerProcess();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to start GenUI broker with "npm run electron:dev" in ${repoRoot}. Detail: ${detail}`);
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await sleep(750);
    connection = await resolveBrokerConnection(options);
    status = await brokerStatus(connection);
    if (status) {
      assertCompatibleBroker(status);
      return connection;
    }
  }

  throw new Error(
    `GenUI broker did not become ready within 30 seconds. Try running "npm run electron:dev" manually in ${repoRoot} to see startup logs.`,
  );
}

async function popup(options: CliOptions): Promise<unknown> {
  const openuiLang = (await resolveOpenUILang(options)).trim();
  if (openuiLang.length === 0) {
    throw new Error("--openui-lang, --openui-lang-file, or --stdin-openui is required");
  }

  const connection = await ensureBroker(options);
  const context = await resolveContext(options);
  const sizeOption = typeof options.size === "string" ? options.size : undefined;
  const widthOption = typeof options.width === "string" ? Number(options.width) : undefined;
  const heightOption = typeof options.height === "string" ? Number(options.height) : undefined;
  const result = await requestJson(`${connection.controlUrl}/v1/popups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      openuiLang,
      agentId: options["agent-id"],
      title: options.title,
      context,
      locale: options.locale,
      size: sizeOption,
      width: Number.isFinite(widthOption) ? widthOption : undefined,
      height: Number.isFinite(heightOption) ? heightOption : undefined,
    }),
  }, connection.controlToken);

  if (options.wait === true) {
    return waitForPopup(connection, result, options);
  }

  return result;
}

async function close(options: CliOptions): Promise<unknown> {
  if (typeof options["popup-id"] !== "string" || options["popup-id"].trim().length === 0) {
    throw new Error("--popup-id is required");
  }

  const connection = await resolveBrokerConnection(options);
  const status = await brokerStatus(connection);
  if (!status) throw new Error("GenUI broker is not reachable.");
  assertCompatibleBroker(status);
  return requestJson(`${connection.controlUrl}/v1/popups/${options["popup-id"]}/close`, { method: "POST" }, connection.controlToken);
}

async function complete(options: CliOptions): Promise<unknown> {
  if (typeof options["popup-id"] !== "string" || options["popup-id"].trim().length === 0) {
    throw new Error("--popup-id is required");
  }

  const connection = await resolveBrokerConnection(options);
  const status = await brokerStatus(connection);
  if (!status) throw new Error("GenUI broker is not reachable.");
  assertCompatibleBroker(status);

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

async function status(options: CliOptions): Promise<unknown> {
  const connection = await resolveBrokerConnection(options);
  const result = await brokerStatus(connection);
  if (!result) throw new Error("GenUI broker status is unavailable.");
  return result;
}

async function waitForPopup(
  connection: BrokerConnection,
  opened: Record<string, unknown>,
  options: CliOptions,
): Promise<Record<string, unknown>> {
  const popupId = typeof opened.popupId === "string" ? opened.popupId : "";
  if (!popupId) return opened;

  const timeoutMs =
    typeof options["wait-timeout-ms"] === "string" ? Number(options["wait-timeout-ms"]) : 0;
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

async function validateCommand(options: CliOptions): Promise<unknown> {
  const openuiLang = (await resolveOpenUILang(options)).trim();
  if (openuiLang.length === 0) {
    throw new Error("--openui-lang, --openui-lang-file, or --stdin-openui is required");
  }

  try {
    validateOpenUILang(openuiLang);
    return { valid: true };
  } catch (error) {
    if (error instanceof OpenUILangValidationError) {
      return { valid: false, error: error.message };
    }
    throw error;
  }
}

function examples(options: CliOptions): unknown {
  if (typeof options.name === "string") {
    const example = getGenUIExample(options.name);
    if (!example) {
      throw new Error(`Unknown example "${options.name}". Available: ${genUIExamples.map((item) => item.name).join(", ")}`);
    }
    return options.json === true ? example : example.openuiLang;
  }

  return {
    examples: genUIExamples.map(({ name, title, description, size }) => ({
      name,
      title,
      description,
      size,
      command: `npm run --silent genui -- examples --name ${name} > ${name}.openui`,
    })),
  };
}

function promptSpec(): string {
  return [
    "You are generating OpenUI Lang for GenUI Popup Broker.",
    "Return only OpenUI Lang code. Do not return Markdown prose.",
    "The broker will validate the output and render it in an Electron popup.",
    "",
    library.prompt(promptOptions),
  ].join("\n");
}

function agentInstructions(): string {
  return `You have access to the GenUI CLI.

Use GenUI when a visual popup helps the user inspect status, risks, decisions, task boards, tables, diffs, maps, media, diagnostics, or approvals.

Workflow:
1. Run \`npm run genui -- prompt-spec\` and use that output as your OpenUI Lang authoring guide.
2. Generate OpenUI Lang yourself using only the listed components.
3. Open the popup with \`npm run genui -- popup --openui-lang-file <file> --title "<title>" --agent-id "<agent-id>"\`.
4. Validate before opening with \`npm run genui -- validate --openui-lang-file <file>\`.
5. Use \`npm run genui -- examples\` and \`npm run genui -- components\` for examples and the concise component catalog.
6. Add \`--wait\` when you need a completed, cancelled, closed, or failed result.

Do not send natural-language prompts to GenUI. The CLI/broker is an OpenUI Lang popup runtime, not a UI-planning LLM.
Never include secrets in OpenUI Lang or context.`;
}

function printHelp(): void {
  console.log(`GenUI Popup Broker CLI

Usage:
  npm run genui -- agent-instructions
  npm run genui -- prompt-spec
  npm run genui -- components
  npm run genui -- examples
  npm run --silent genui -- examples --name build-review > ui.openui
  npm run genui -- validate --openui-lang-file ui.openui
  npm run genui -- popup --openui-lang-file ui.openui --agent-id codex --title "Build Review"
  npm run genui -- popup --openui-lang-file ui.openui --wait
  npm run genui -- complete --popup-id "<popupId>" --outcome completed
  npm run genui -- close --popup-id "<popupId>"
  npm run genui -- status

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
  --size <preset>           compact | card | panel | default | wide | tall | stage | cinema | fullscreen
  --width <px>              Override window width (>= 240)
  --height <px>             Override window height (>= 200)
  --no-start                Do not auto-start the broker for popup
  --wait                    Wait until the popup is completed, cancelled, closed, or failed
  --wait-timeout-ms <ms>    Timeout for --wait. Omit for no timeout
  --outcome <outcome>       completed | cancelled | failed
  --name <example>          Select an example for the examples command
  --json                    Return selected example as JSON
`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "popup") {
    console.log(JSON.stringify(await popup(options), null, 2));
    return;
  }

  if (command === "validate") {
    const result = await validateCommand(options);
    console.log(JSON.stringify(result, null, 2));
    if ((result as { valid?: unknown }).valid === false) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "close") {
    console.log(JSON.stringify(await close(options), null, 2));
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
    console.log(JSON.stringify({ brokerProtocolVersion: BROKER_PROTOCOL_VERSION, components: componentCatalog }, null, 2));
    return;
  }

  if (command === "examples") {
    const result = examples(options);
    if (typeof result === "string") {
      console.log(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  if (command === "guide") {
    console.log(JSON.stringify(agentUsageGuide, null, 2));
    return;
  }

  if (command === "prompt-spec") {
    console.log(promptSpec());
    return;
  }

  if (command === "agent-instructions") {
    console.log(agentInstructions());
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
