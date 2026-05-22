#!/usr/bin/env tsx
import { readBrokerState } from "../src/server/genui/broker-state";
import { BROKER_PROTOCOL_VERSION } from "../src/server/genui/version";

type CliOptions = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; options: CliOptions } {
  const [command = "help", ...rest] = argv;
  const options: CliOptions = {};

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      continue;
    }

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
  if (typeof options["service-url"] === "string") {
    return options["service-url"];
  }

  if (process.env.GENUI_BROKER_URL) {
    return process.env.GENUI_BROKER_URL;
  }

  if (process.env.GENUI_SERVICE_URL) {
    return process.env.GENUI_SERVICE_URL;
  }

  const state = await readBrokerState();
  return state?.controlUrl ?? "http://127.0.0.1:48231";
}

async function requestJson(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetch(url, init);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`GenUI broker is not reachable. Start it with npm run electron:dev. Detail: ${detail}`);
  }

  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`GenUI broker returned HTTP ${response.status}. Detail: ${JSON.stringify(body)}`);
  }

  return body;
}

async function ensureCompatibleBroker(controlUrl: string): Promise<void> {
  let status: Record<string, unknown>;

  try {
    status = await requestJson(`${controlUrl}/v1/status`);
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

async function popup(options: CliOptions): Promise<unknown> {
  if (typeof options.prompt !== "string" || options.prompt.trim().length === 0) {
    throw new Error("--prompt is required");
  }

  const controlUrl = await resolveControlUrl(options);
  await ensureCompatibleBroker(controlUrl);
  const sizeOption = typeof options.size === "string" ? options.size : undefined;
  const widthOption = typeof options.width === "string" ? Number(options.width) : undefined;
  const heightOption = typeof options.height === "string" ? Number(options.height) : undefined;
  return requestJson(`${controlUrl}/v1/popups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: options.prompt,
      agentId: options["agent-id"],
      title: options.title,
      locale: options.locale,
      mockData: options["mock-data"],
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
  await ensureCompatibleBroker(controlUrl);
  return requestJson(`${controlUrl}/v1/popups/${options["popup-id"]}/close`, { method: "POST" });
}

async function status(options: CliOptions): Promise<unknown> {
  const controlUrl = await resolveControlUrl(options);
  try {
    return await requestJson(`${controlUrl}/v1/status`);
  } catch (error) {
    throw new Error(
      `GenUI broker status is unavailable. Restart it with npm run electron:dev. Detail: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function components(options: CliOptions): Promise<unknown> {
  const controlUrl = await resolveControlUrl(options);
  await ensureCompatibleBroker(controlUrl);
  return requestJson(`${controlUrl}/v1/components`);
}

function printHelp(): void {
  console.log(`GenUI Popup Broker CLI

Usage:
  npm run genui -- popup --prompt "..." --agent-id codex
  npm run genui -- close --popup-id "<popupId>"
  npm run genui -- status
  npm run genui -- components

Options:
  --service-url <url>  Override broker control URL
  --title <title>      Popup window title
  --mock-data <mode>   auto | sales | support | none
  --locale <locale>    auto | ja | en
  --size <preset>      compact | card | panel | default | wide | tall | stage | cinema | fullscreen
  --width <px>         Override window width (>= 240)
  --height <px>        Override window height (>= 200)
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
    console.log(JSON.stringify(await components(options), null, 2));
    return;
  }

  printHelp();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
