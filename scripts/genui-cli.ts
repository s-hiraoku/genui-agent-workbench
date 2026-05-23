#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { readBrokerState } from "../src/server/genui/broker-state";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { BROKER_PROTOCOL_VERSION } from "../src/server/genui/version";
import { library, promptOptions } from "../src/library";

type CliOptions = Record<string, string | boolean>;

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

async function requestJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetch(url, init);
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

async function brokerStatus(controlUrl: string): Promise<Record<string, unknown> | null> {
  try {
    return await requestJson(`${controlUrl}/v1/status`);
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

function startBrokerProcess(): void {
  const child = spawn("npm", ["run", "electron:dev"], {
    cwd: process.cwd(),
    detached: true,
    env: process.env,
    stdio: "ignore",
  });
  child.unref();
}

async function ensureBroker(options: CliOptions): Promise<string> {
  let controlUrl = await resolveControlUrl(options);
  let status = await brokerStatus(controlUrl);
  if (status) {
    assertCompatibleBroker(status);
    return controlUrl;
  }

  if (options["no-start"] === true) {
    throw new Error("GenUI broker is not reachable. Start it with npm run electron:dev.");
  }

  startBrokerProcess();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await sleep(750);
    controlUrl = await resolveControlUrl(options);
    status = await brokerStatus(controlUrl);
    if (status) {
      assertCompatibleBroker(status);
      return controlUrl;
    }
  }

  throw new Error("GenUI broker did not become ready within 30 seconds.");
}

async function popup(options: CliOptions): Promise<unknown> {
  const openuiLang = (await resolveOpenUILang(options)).trim();
  if (openuiLang.length === 0) {
    throw new Error("--openui-lang, --openui-lang-file, or --stdin-openui is required");
  }

  const controlUrl = await ensureBroker(options);
  const context = await resolveContext(options);
  const sizeOption = typeof options.size === "string" ? options.size : undefined;
  const widthOption = typeof options.width === "string" ? Number(options.width) : undefined;
  const heightOption = typeof options.height === "string" ? Number(options.height) : undefined;
  return requestJson(`${controlUrl}/v1/popups`, {
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
  });
}

async function close(options: CliOptions): Promise<unknown> {
  if (typeof options["popup-id"] !== "string" || options["popup-id"].trim().length === 0) {
    throw new Error("--popup-id is required");
  }

  const controlUrl = await resolveControlUrl(options);
  const status = await brokerStatus(controlUrl);
  if (!status) throw new Error("GenUI broker is not reachable.");
  assertCompatibleBroker(status);
  return requestJson(`${controlUrl}/v1/popups/${options["popup-id"]}/close`, { method: "POST" });
}

async function status(options: CliOptions): Promise<unknown> {
  const controlUrl = await resolveControlUrl(options);
  const result = await brokerStatus(controlUrl);
  if (!result) throw new Error("GenUI broker status is unavailable.");
  return result;
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
4. Use \`npm run genui -- components\` for the concise component catalog.

Do not send natural-language prompts to GenUI. The CLI/broker is an OpenUI Lang popup runtime, not a UI-planning LLM.
Never include secrets in OpenUI Lang or context.`;
}

function printHelp(): void {
  console.log(`GenUI Popup Broker CLI

Usage:
  npm run genui -- agent-instructions
  npm run genui -- prompt-spec
  npm run genui -- components
  npm run genui -- popup --openui-lang-file ui.openui --agent-id codex --title "Build Review"
  npm run genui -- close --popup-id "<popupId>"
  npm run genui -- status

Options:
  --service-url <url>       Override broker control URL
  --openui-lang <code>      Inline OpenUI Lang
  --openui-lang-file <path> Read OpenUI Lang from a UTF-8 text file
  --stdin-openui            Read OpenUI Lang from stdin
  --context-json <json>     Attach structured context as a JSON object
  --context-file <path>     Attach structured context from a JSON file
  --title <title>           Popup window title
  --locale <locale>         auto | ja | en
  --size <preset>           compact | card | panel | default | wide | tall | stage | cinema | fullscreen
  --width <px>              Override window width (>= 240)
  --height <px>             Override window height (>= 200)
  --no-start                Do not auto-start the broker for popup
`);
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "popup") {
    console.log(JSON.stringify(await popup(options), null, 2));
    return;
  }

  if (command === "close") {
    console.log(JSON.stringify(await close(options), null, 2));
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
