#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const repoRoot = path.resolve(import.meta.dirname, "..");
const port = process.env.GENUI_VISUAL_PORT || "3100";
const outputDir = path.resolve(repoRoot, process.env.GENUI_VISUAL_OUTPUT_DIR || "output/light-theme-visuals");
const dataDir = mkdtempSync(path.join(os.tmpdir(), "genui-visual-"));

const openuiLang = String.raw`
header = CardHeader("Light Theme Visual Smoke", "Flat canvas surfaces and independent status colors")
m1 = { label: "Tests", value: "68 passed", detail: "green", tone: "positive" }
m2 = { label: "Review", value: "needs review", detail: "blue", tone: "info" }
m3 = { label: "Build", value: "attention", detail: "amber", tone: "warning" }
m4 = { label: "Package", value: "queued", detail: "slate", tone: "neutral" }
metrics = MetricGrid("Summary", "Component tones should not collapse into the accent color", [m1, m2, m3, m4])
c1 = { label: "unit tests", status: "pass", detail: "green row" }
c2 = { label: "eslint", status: "running", detail: "blue row" }
c3 = { label: "electron build", status: "warn", detail: "amber row" }
checks = ChecklistPanel("Checks", "Mixed row states", [c1, c2, c3], "pass / running / warn")
root = Card([header, metrics, checks])
`;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, GENUI_DATA_DIR: dataDir, ...(options.env ?? {}) },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout.trim();
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Server is still starting.
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const escaped = JSON.stringify(openuiLang);
  const artifactId = run("npx", [
    "tsx",
    "-e",
    `import { renderGenUI } from "./src/server/genui/render"; void (async () => { const result = await renderGenUI({ openuiLang: ${escaped}, title: "Light Theme Visual Smoke", agentId: "visual-smoke" }); console.log(result.artifact.artifactId); })();`,
  ]);

  const dev = spawn("npm", ["run", "dev", "--", "--port", port], {
    cwd: repoRoot,
    detached: true,
    env: { ...process.env, GENUI_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let logs = "";
  dev.stdout.on("data", (chunk) => {
    logs += chunk.toString();
  });
  dev.stderr.on("data", (chunk) => {
    logs += chunk.toString();
  });

  try {
    await waitForServer(`http://127.0.0.1:${port}/`);
    for (const visualTheme of ["workbench", "studio", "briefing"]) {
      const url = `http://127.0.0.1:${port}/preview/${artifactId}?theme=light&chrome=hud&size=panel&animation=center&visualTheme=${visualTheme}&themeColor=cyan&agent=visual-smoke`;
      const target = path.join(outputDir, `light-${visualTheme}.png`);
      run("npx", [
        "-y",
        "playwright",
        "screenshot",
        "--browser=chromium",
        "--timeout=15000",
        "--viewport-size=900,760",
        "--wait-for-selector=.lg-preview",
        "--wait-for-timeout=500",
        url,
        target,
      ]);
      console.log(`Wrote ${target}`);
    }
  } finally {
    if (dev.pid) {
      try {
        process.kill(-dev.pid, "SIGTERM");
      } catch {
        dev.kill("SIGTERM");
      }
    }
    rmSync(dataDir, { force: true, recursive: true });
    if (dev.exitCode === null) {
      await Promise.race([
        new Promise((resolve) => dev.once("exit", resolve)),
        sleep(1500),
      ]);
    }
    if (dev.exitCode && dev.exitCode !== 0 && logs) {
      console.error(logs);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
