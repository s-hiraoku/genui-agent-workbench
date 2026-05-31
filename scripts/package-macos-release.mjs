#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const releaseDir = path.join(repoRoot, "release");
const stableAssetName = "genui-popup-broker-macos-arm64.zip";
const stageDir = path.join(releaseDir, "genui-popup-broker-macos-arm64");
const outputZip = path.join(releaseDir, stableAssetName);
const shellWrapperMarker = "__GENUI_STANDALONE_CLI_JS__";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

async function findAppZip() {
  const entries = await fs.readdir(distDir);
  const matches = entries
    .filter((entry) => /^GenUI Popup Broker-.+-arm64-mac\.zip$/.test(entry))
    .sort()
    .reverse();

  if (matches.length === 0) {
    throw new Error("Could not find an arm64 Electron app zip in dist/.");
  }

  return path.join(distDir, matches[0]);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("macOS release packaging requires ditto and currently runs only on macOS.");
  }

  const appZip = await findAppZip();
  await fs.rm(stageDir, { force: true, recursive: true });
  await fs.mkdir(stageDir, { recursive: true });
  await fs.mkdir(releaseDir, { recursive: true });

  run("ditto", ["-x", "-k", appZip, stageDir]);

  const cliSource = path.join(repoRoot, "scripts", "genui-standalone-cli.mjs");
  const cliTarget = path.join(stageDir, "genui");
  const cliSourceText = await fs.readFile(cliSource, "utf8");
  if (cliSourceText.includes(shellWrapperMarker)) {
    throw new Error(`CLI source must not contain ${shellWrapperMarker}`);
  }
  await fs.writeFile(
    cliTarget,
    [
      "#!/bin/sh",
      "set -eu",
      "",
      'SCRIPT_DIR="$(CDPATH= cd "$(dirname "$0")" && pwd)"',
      'APP_PATH=""',
      'APP_BIN=""',
      'if [ -n "${GENUI_BROKER_APP_PATH:-}" ] && [ -d "${GENUI_BROKER_APP_PATH:-}" ]; then',
      '  APP_PATH="$GENUI_BROKER_APP_PATH"',
      '  APP_BIN="$APP_PATH/Contents/MacOS/GenUI Popup Broker"',
      'elif [ -n "${GENUI_BROKER_APP_PATH:-}" ]; then',
      '  APP_BIN="$GENUI_BROKER_APP_PATH"',
      "fi",
      'if [ -z "$APP_BIN" ] && [ -d "$SCRIPT_DIR/GenUI Popup Broker.app" ]; then',
      '  APP_PATH="$SCRIPT_DIR/GenUI Popup Broker.app"',
      '  APP_BIN="$APP_PATH/Contents/MacOS/GenUI Popup Broker"',
      "fi",
      'if [ -z "$APP_BIN" ] && [ -d "/Applications/GenUI Popup Broker.app" ]; then',
      '  APP_PATH="/Applications/GenUI Popup Broker.app"',
      '  APP_BIN="$APP_PATH/Contents/MacOS/GenUI Popup Broker"',
      "fi",
      'if [ -n "$APP_PATH" ]; then',
      '  export GENUI_BROKER_APP_PATH="$APP_PATH"',
      "fi",
      "",
      "if [ -n \"$APP_BIN\" ]; then",
      '  RUNTIME="$APP_BIN"',
      "  RUN_AS_NODE=1",
      "elif command -v node >/dev/null 2>&1; then",
      '  RUNTIME="$(command -v node)"',
      '  RUN_AS_NODE="${ELECTRON_RUN_AS_NODE:-}"',
      "else",
      '  echo "GenUI CLI needs Node.js or /Applications/GenUI Popup Broker.app." >&2',
      "  exit 1",
      "fi",
      'if [ -n "$RUN_AS_NODE" ]; then',
      '  export ELECTRON_RUN_AS_NODE="$RUN_AS_NODE"',
      "fi",
      'exec "$RUNTIME" --input-type=module - "$@" <<\'' + shellWrapperMarker + "'",
      cliSourceText.replace(/^#!.*\n/, ""),
      shellWrapperMarker,
      "",
    ].join("\n"),
    "utf8",
  );
  await fs.chmod(cliTarget, 0o755);

  await fs.writeFile(
    path.join(stageDir, "INSTALL.txt"),
    [
      "GenUI Popup Broker",
      "",
      "1. Move GenUI Popup Broker.app to /Applications.",
      "2. First launch: right-click the app in Finder and choose Open.",
      "3. Install the CLI:",
      "   mkdir -p ~/.local/bin",
      "   cp ./genui ~/.local/bin/genui",
      "   chmod +x ~/.local/bin/genui",
      "4. Make sure ~/.local/bin is on PATH, then run:",
      "   genui status",
      "   genui prompt-spec",
      "",
      "The CLI runs through the Electron runtime inside /Applications/GenUI Popup Broker.app.",
      "If the app is not installed yet, it can also use Node.js from PATH.",
      "",
      "The CLI reads the broker state from:",
      "  ~/Library/Application Support/GenUI Popup Broker/genui-data/broker.json",
      "",
    ].join("\n"),
    "utf8",
  );

  await fs.rm(outputZip, { force: true });
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--noqtn", stageDir, outputZip]);
  console.log(`Wrote ${outputZip}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
