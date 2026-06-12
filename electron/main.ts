import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import { URL } from "node:url";
import { app, BrowserWindow, Menu, nativeImage, nativeTheme, screen, shell, Tray } from "electron";
import { deleteArtifact, listArtifacts, loadArtifact, pruneArtifacts } from "../src/server/genui/artifacts";
import { OpenUILangValidationError, renderGenUI, validateOpenUILang } from "../src/server/genui/render";
import { writeBrokerState } from "../src/server/genui/broker-state";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { buildAgentInstructions, buildPromptSpec } from "../src/server/genui/cli-guidance";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { genUIExamples, getGenUIExample } from "../src/server/genui/examples";
import { BROKER_APP_VERSION, BROKER_PROTOCOL_VERSION } from "../src/server/genui/version";
import {
  coerceSizePreset,
  resolveResizePreset,
  resolveWindowGeometry,
  SIZE_PRESET_MIN,
  SIZE_PRESET_RATIOS,
  type WindowGeometry,
  WINDOW_SIZE_PRESETS,
} from "../src/server/genui/window-size";
import {
  type BrokerSettings,
  readSettings,
  sanitizeSettings,
  writeSettings,
} from "../src/server/genui/settings";
import type {
  GenUIArtifact,
  GenUISizePreset,
  PopupInteractionEvent,
  PopupInteractionEventKind,
  PopupOpenResponse,
  PopupRecord,
  PopupStatus,
  RenderGenUIInput,
} from "../src/server/genui/types";

type PopupRuntime = PopupRecord & {
  window?: BrowserWindow;
};

const popupRegistry = new Map<string, PopupRuntime>();
const MAX_REQUEST_BYTES = 1024 * 1024;
const GENUI_DATA_DIR_NAME = "genui-agent-workbench";
const ACTIVE_POPUP_STATUSES = new Set<PopupStatus>(["opening", "open"]);

function activePopupCount(): number {
  return [...popupRegistry.values()].filter((popup) => ACTIVE_POPUP_STATUSES.has(popup.status)).length;
}

function getDefaultGenUIDataDir(): string {
  return path.join(app.getPath("appData"), GENUI_DATA_DIR_NAME, "genui-data");
}

// Route external links (target="_blank", window.open) from popup/settings
// windows to the OS default browser, instead of spawning new floating
// BrowserWindows inside Electron. Internal navigations (same Next.js
// origin) are left alone.
function routeExternalLinks(window: BrowserWindow): void {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    const current = window.webContents.getURL();
    try {
      const target = new URL(url);
      const here = new URL(current);
      if (target.origin !== here.origin && /^https?:$/i.test(target.protocol)) {
        event.preventDefault();
        void shell.openExternal(url);
      }
    } catch {
      // ignore bad URLs
    }
  });
}

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let nextProcess: ChildProcessWithoutNullStreams | null = null;
let nextUrl = process.env.GENUI_NEXT_URL ?? "";
let controlServer: http.Server | null = null;
let controlUrl = "";
let controlToken = process.env.GENUI_BROKER_TOKEN ?? "";
let settings: BrokerSettings;
let isQuitting = false;
let isRestartingService = false;
let nextServiceStatus: "starting" | "ready" | "stopped" | "failed" = "stopped";
let nextRestartCount = 0;

class ControlHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ControlHttpError";
  }
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeJsonValue(value: unknown, depth = 0): unknown {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeJsonValue(item, depth + 1));
  }
  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [key, sanitizeJsonValue(item, depth + 1)]),
    );
  }
  return String(value);
}

function createTrayImage() {
  // Monochrome HUD reticle — 18x18 @1x and 36x36 @2x PNGs (template image).
  // PNGs are required: nativeImage does not rasterize SVG, which produces an
  // invisible tray icon on macOS.
  const png1x =
    "iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAQAAAD8x0bcAAAA" +
    "kklEQVR4AbWSwQ2AIAxFv6QH9OQEDuAATuI" +
    "Ajgh3JziCC6gjuI+1qaQUaIRDX9LSpv9fkpZAcQEPxoIIYBjOgUwInIDhAA5kQHEABZIc" +
    "qIBEoB5oASRA5UANEAEKAFQAAKACdABEAAQAEAACgAAAAAARAAAAAAB/8DfMQDgyAAAA" +
    "AElFTkSuQmCC";

  // Fallback: programmatic raster — 18x18 RGBA reticle. Keeps the icon
  // visible even if the base64 above is rejected on some macOS builds.
  const size = 18;
  const buffer = Buffer.alloc(size * size * 4, 0);
  const setPixel = (x: number, y: number, a: number) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    buffer[i] = 0;
    buffer[i + 1] = 0;
    buffer[i + 2] = 0;
    buffer[i + 3] = a;
  };
  const cx = 8.5;
  const cy = 8.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - cx, y - cy);
      // outer ring
      if (d > 5.0 && d < 6.2) setPixel(x, y, 230);
      // center dot
      if (d < 1.6) setPixel(x, y, 255);
    }
  }
  // tick marks N/S/E/W
  for (let i = 0; i < 3; i += 1) {
    setPixel(Math.round(cx), i, 230);
    setPixel(Math.round(cx), size - 1 - i, 230);
    setPixel(i, Math.round(cy), 230);
    setPixel(size - 1 - i, Math.round(cy), 230);
  }
  const raster = nativeImage.createFromBitmap(buffer, { width: size, height: size });

  let img = nativeImage.createFromDataURL(`data:image/png;base64,${png1x}`);
  if (img.isEmpty()) {
    img = raster;
  }
  img.setTemplateImage(true);
  return img;
}

async function findOpenPort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port += 1) {
    if (await isPortOpen(port)) {
      return port;
    }
  }

  throw new Error(`No open port found from ${startPort}`);
}

function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function waitForHttp(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function startNextService(): Promise<void> {
  if (nextUrl) {
    nextServiceStatus = "starting";
    await waitForHttp(nextUrl);
    nextServiceStatus = "ready";
    return;
  }

  nextServiceStatus = "starting";
  const preferredPort = settings.nextPort ?? Number(process.env.GENUI_NEXT_PORT ?? 3000);
  const port = await findOpenPort(preferredPort);
  nextUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    GENUI_DATA_DIR: process.env.GENUI_DATA_DIR ?? getDefaultGenUIDataDir(),
    HOSTNAME: "127.0.0.1",
    PORT: String(port),
  };

  if (app.isPackaged) {
    // The standalone server is unpacked from the asar (see build.asarUnpack)
    // so it can be spawned as a real file/dir. app.getAppPath() points at
    // app.asar, which is a file, not a directory — using it as cwd yields
    // ENOTDIR. Redirect to the .unpacked sibling.
    const standaloneDir = path
      .join(app.getAppPath(), ".next", "standalone")
      .replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    const serverPath = path.join(standaloneDir, "server.js");
    nextProcess = spawn(process.execPath, [serverPath], {
      cwd: standaloneDir,
      env: {
        ...env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_ENV: "production",
      },
    });
  } else {
    nextProcess = spawn("npm", ["run", "dev", "--", "--port", String(port), "--hostname", "127.0.0.1"], {
      cwd: process.cwd(),
      env,
    });
  }

  nextProcess.stdout.on("data", (chunk) => console.log(`[next] ${chunk}`.trimEnd()));
  nextProcess.stderr.on("data", (chunk) => console.error(`[next] ${chunk}`.trimEnd()));
  nextProcess.on("exit", (code) => {
    console.log(`[next] exited with code ${code}`);
    nextProcess = null;
    if (!isQuitting && !isRestartingService) {
      nextServiceStatus = "failed";
      nextUrl = "";
      scheduleNextRestart();
    }
  });

  await waitForHttp(nextUrl);
  nextServiceStatus = "ready";
  if (controlUrl) {
    await persistBrokerState();
  }
}

function scheduleNextRestart(): void {
  nextRestartCount += 1;
  const delayMs = Math.min(30_000, 1_000 * nextRestartCount);
  setTimeout(() => {
    if (isQuitting || nextProcess || nextUrl) return;
    startNextService().catch((error) => {
      nextServiceStatus = "failed";
      console.error("[genui] failed to restart Next service:", error);
      scheduleNextRestart();
    });
  }, delayMs);
}

async function startControlApi(): Promise<void> {
  const preferredPort = settings.controlPort ?? Number(process.env.GENUI_CONTROL_PORT ?? 48231);
  const port = await findOpenPort(preferredPort);

  controlServer = http.createServer((req, res) => {
    handleControlRequest(req, res).catch((error) => {
      setCorsHeaders(req, res);
      if (error instanceof ControlHttpError) {
        sendJson(res, error.statusCode, { error: error.message });
        return;
      }
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    });
  });

  await new Promise<void>((resolve) => {
    controlServer?.listen(port, "127.0.0.1", resolve);
  });

  controlUrl = `http://127.0.0.1:${port}`;
  await persistBrokerState();
}

async function persistBrokerState(): Promise<void> {
  await writeBrokerState({
    controlUrl,
    nextUrl,
    pid: process.pid,
    brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
    appVersion: BROKER_APP_VERSION,
    controlToken,
    updatedAt: new Date().toISOString(),
  });
}

async function readRequestJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new ControlHttpError(413, `Request body exceeds ${MAX_REQUEST_BYTES} bytes`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ControlHttpError(400, "Request body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ControlHttpError) throw error;
    throw new ControlHttpError(400, "Request body must be valid JSON");
  }
}

async function handleControlRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(req, res);
  if (!isAllowedOrigin(req.headers.origin)) {
    throw new ControlHttpError(403, "Origin is not allowed");
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", controlUrl || "http://127.0.0.1");
  const popupMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)$/);
  const popupEventMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)\/event$/);
  const popupCloseMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)\/close$/);
  const popupResizeMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)\/resize$/);
  const popupCompleteMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)\/complete$/);
  const artifactReplayMatch = url.pathname.match(/^\/v1\/artifacts\/([^/]+)\/replay$/);
  const artifactMatch = url.pathname.match(/^\/v1\/artifacts\/([^/]+)$/);

  if (req.method === "GET" && url.pathname === "/v1/status") {
    sendJson(res, 200, {
      status: "ok",
      brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
      appVersion: BROKER_APP_VERSION,
      controlUrl,
      nextUrl,
      nextServiceStatus,
      nextRestartCount,
      pid: process.pid,
      popupCount: activePopupCount(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/components") {
    sendJson(res, 200, {
      brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
      components: componentCatalog,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/prompt-spec") {
    sendText(res, 200, buildPromptSpec());
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/agent-instructions") {
    sendText(res, 200, buildAgentInstructions());
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/examples") {
    const name = url.searchParams.get("name");
    if (name) {
      const example = getGenUIExample(name);
      if (!example) {
        sendJson(res, 404, {
          error: `Unknown example "${name}".`,
          available: genUIExamples.map((item) => item.name),
        });
        return;
      }
      if (url.searchParams.get("json") === "1") {
        sendJson(res, 200, example);
      } else {
        sendText(res, 200, example.openuiLang);
      }
      return;
    }

    sendJson(res, 200, {
      examples: genUIExamples.map(({ name: exampleName, title, description, size }) => ({
        name: exampleName,
        title,
        description,
        size,
        command: `genui examples --name ${exampleName} > ${exampleName}.openui`,
      })),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/guide") {
    sendJson(res, 200, agentUsageGuide);
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/sizes") {
    const display = screen.getPrimaryDisplay().workAreaSize;
    sendJson(res, 200, {
      brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
      workArea: display,
      presets: WINDOW_SIZE_PRESETS.map((p) => ({
        id: p,
        ratio: SIZE_PRESET_RATIOS[p],
        min: SIZE_PRESET_MIN[p],
        approxPx: {
          width: Math.max(SIZE_PRESET_MIN[p].w, Math.floor(display.width * SIZE_PRESET_RATIOS[p].w)),
          height: Math.max(SIZE_PRESET_MIN[p].h, Math.floor(display.height * SIZE_PRESET_RATIOS[p].h)),
        },
      })),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/settings") {
    requireControlToken(req);
    sendJson(res, 200, { settings, themeResolved: resolveTheme(settings.theme) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/settings") {
    requireControlToken(req);
    const body = await readRequestJson(req);
    const patch = body as Partial<BrokerSettings>;
    const next = sanitizeSettings({
      ...settings,
      ...patch,
      design: {
        ...settings.design,
        ...(typeof patch.design === "object" && patch.design !== null ? patch.design : {}),
      },
    });
    await applySettings(next);
    sendJson(res, 200, { settings, themeResolved: resolveTheme(settings.theme) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/popups") {
    requireControlToken(req);
    try {
      const body = await readRequestJson(req);
      const opened = await openPopup(body as RenderGenUIInput);
      sendJson(res, 200, opened);
    } catch (error) {
      if (error instanceof OpenUILangValidationError) {
        sendJson(res, 400, { error: error.message });
        return;
      }
      throw error;
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/validate") {
    requireControlToken(req);
    const body = await readRequestJson(req);
    const openuiLang = typeof body.openuiLang === "string" ? body.openuiLang : "";
    try {
      validateOpenUILang(openuiLang);
      sendJson(res, 200, { valid: true });
    } catch (error) {
      if (error instanceof OpenUILangValidationError) {
        sendJson(res, 200, { valid: false, error: error.message });
        return;
      }
      throw error;
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/popups") {
    requireControlToken(req);
    sendJson(res, 200, {
      popups: Array.from(popupRegistry.values())
        .map(serializePopup)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
    return;
  }

  if (req.method === "GET" && popupMatch) {
    requireControlToken(req);
    const popup = popupRegistry.get(popupMatch[1]);
    if (!popup) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, serializePopup(popup));
    return;
  }

  if (req.method === "POST" && popupCloseMatch) {
    requireControlToken(req);
    const popup = closePopup(popupCloseMatch[1], "closed");
    if (!popup) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, serializePopup(popup));
    return;
  }

  if (req.method === "POST" && popupResizeMatch) {
    requireControlToken(req);
    const body = await readRequestJson(req);
    const popup = resizePopup(popupResizeMatch[1], body);
    if (!popup) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, serializePopup(popup));
    return;
  }

  if (req.method === "POST" && popupEventMatch) {
    requireControlToken(req);
    const body = await readRequestJson(req);
    const result = recordPopupEvent(popupEventMatch[1], body);
    if (!result) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    if (body.complete === true) {
      const popup = completePopup(popupEventMatch[1], {
        outcome: body.outcome,
        payload: popupPayloadFromEvents(result.popup, result.event),
      });
      sendJson(res, 200, popup ? serializePopup(popup) : { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, {
      event: result.event,
      popup: serializePopup(result.popup),
    });
    return;
  }

  if (req.method === "POST" && popupCompleteMatch) {
    requireControlToken(req);
    const body = await readRequestJson(req);
    const popup = completePopup(popupCompleteMatch[1], body);
    if (!popup) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, serializePopup(popup));
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/artifacts") {
    requireControlToken(req);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    sendJson(res, 200, {
      artifacts: await listArtifacts(Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 20),
    });
    return;
  }

  if (req.method === "GET" && artifactMatch) {
    requireControlToken(req);
    const artifact = await loadArtifact(artifactMatch[1]);
    sendJson(res, artifact ? 200 : 404, artifact ?? { error: "Artifact not found" });
    return;
  }

  if (req.method === "POST" && artifactReplayMatch) {
    requireControlToken(req);
    const artifact = await loadArtifact(artifactReplayMatch[1]);
    if (!artifact) {
      sendJson(res, 404, { error: "Artifact not found" });
      return;
    }
    const body = await readRequestJson(req);
    const replayInput = body as Partial<RenderGenUIInput>;
    const opened = await openArtifactPopup(artifact, {
      ...replayInput,
      agentId: typeof replayInput.agentId === "string" ? replayInput.agentId : artifact.agentId,
      title: typeof replayInput.title === "string" ? replayInput.title : artifact.title,
    });
    sendJson(res, 200, opened);
    return;
  }

  if (req.method === "DELETE" && artifactMatch) {
    requireControlToken(req);
    const deleted = await deleteArtifact(artifactMatch[1]);
    sendJson(res, deleted ? 200 : 404, deleted ? { deleted: true } : { error: "Artifact not found" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/artifacts/prune") {
    requireControlToken(req);
    const body = await readRequestJson(req);
    const maxArtifacts = typeof body.maxArtifacts === "number" ? body.maxArtifacts : Number(body.maxArtifacts);
    sendJson(res, 200, await pruneArtifacts(maxArtifacts));
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function resolveTheme(theme: BrokerSettings["theme"]): "dark" | "light" {
  if (theme === "dark" || theme === "light") return theme;
  return nativeTheme.shouldUseDarkColors ? "dark" : "light";
}

async function applySettings(next: BrokerSettings): Promise<void> {
  const previous = settings;
  settings = next;
  await writeSettings(next);

  if (next.launchAtLogin !== previous.launchAtLogin) {
    try {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, openAsHidden: true });
    } catch (err) {
      console.warn("[genui] failed to set login item:", err);
    }
  }

  nativeTheme.themeSource = next.theme === "auto" ? "system" : next.theme;
}

function pickPreset(input: Partial<RenderGenUIInput>, fallback: GenUISizePreset = "default"): GenUISizePreset {
  const raw = (input as { size?: unknown; preset?: unknown }).size ?? (input as { preset?: unknown }).preset;
  return coerceSizePreset(raw, fallback);
}

const popupOffset = { x: 24, y: 24 };

function nextWindowPosition(geometry: WindowGeometry): { x: number; y: number } {
  const work = screen.getPrimaryDisplay().workArea;
  const baseX = work.x + Math.max(16, Math.floor((work.width - geometry.width) / 2));
  const baseY = work.y + Math.max(16, Math.floor((work.height - geometry.height) / 2));
  const cascade = popupRegistry.size % 8;
  return {
    x: baseX + cascade * popupOffset.x,
    y: baseY + cascade * popupOffset.y,
  };
}

async function openPopup(input: RenderGenUIInput): Promise<PopupOpenResponse> {
  const renderInput: RenderGenUIInput = { ...input, design: input.design ?? settings.design };
  const result = await renderGenUI(renderInput);
  return openArtifactPopup(result.artifact, input);
}

async function openArtifactPopup(
  artifact: GenUIArtifact,
  input: Partial<RenderGenUIInput> = {},
): Promise<PopupOpenResponse> {
  const popupId = createId("pop");
  const title = input.title ?? artifact.title ?? `${input.agentId ?? artifact.agentId ?? "Agent"} GenUI`;
  const theme = resolveTheme(settings.theme);
  const preset = pickPreset(input);
  const geometry = resolveWindowGeometry(screen.getPrimaryDisplay().workAreaSize, preset, input as { width?: unknown; height?: unknown });
  const pos = nextWindowPosition(geometry);

  const previewUrl =
    `${nextUrl}/preview/${artifact.artifactId}` +
    `?popupId=${encodeURIComponent(popupId)}` +
    `&controlUrl=${encodeURIComponent(controlUrl)}` +
    `&theme=${theme}` +
    `&chrome=hud` +
    `&token=${encodeURIComponent(controlToken)}` +
    `&size=${preset}` +
    `&animation=${settings.design.windowAnimationPreset}` +
    `&visualTheme=${settings.design.visualThemePreset}` +
    `&themeColor=${settings.design.themeColorPreset}` +
    `&agent=${encodeURIComponent(input.agentId ?? artifact.agentId ?? "agent")}`;

  // The page renders the Aether-style glass material itself. The
  // BrowserWindow stays transparent so the page-level wallpaper and
  // frosted CSS layers can show through without OS vibrancy.
  const window = new BrowserWindow({
    title,
    width: geometry.width,
    height: geometry.height,
    minWidth: geometry.minWidth,
    minHeight: geometry.minHeight,
    x: pos.x,
    y: pos.y,
    show: false,
    frame: false,
    movable: true,
    resizable: true,
    transparent: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    roundedCorners: true,
    fullscreenable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  routeExternalLinks(window);

  if (geometry.fullScreen) {
    window.setFullScreen(true);
  }
  const popup: PopupRuntime = {
    popupId,
    artifactId: artifact.artifactId,
    agentId: input.agentId ?? artifact.agentId,
    title,
    status: "opening",
    previewUrl,
    createdAt: new Date().toISOString(),
    generationMode: artifact.generationMode,
    size: preset,
    width: geometry.width,
    height: geometry.height,
    window,
  };

  popupRegistry.set(popupId, popup);

  window.on("resize", () => updatePopupBounds(popup));

  window.on("closed", () => {
    if (popup.status === "opening" || popup.status === "open") {
      popup.status = "closed";
    }
    updatePopupBounds(popup);
    popup.closedAt = popup.closedAt ?? new Date().toISOString();
    popup.window = undefined;
  });

  try {
    window.show();
    await window.loadURL(previewUrl);
    window.focus();
    popup.status = "open";
  } catch (error) {
    popup.status = "failed";
    popup.error = error instanceof Error ? error.message : String(error);
    popup.closedAt = new Date().toISOString();
    popup.completion = {
      outcome: "failed",
      payload: { error: popup.error },
      completedAt: popup.closedAt,
    };
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }

  return serializePopup(popup);
}

function updatePopupBounds(popup: PopupRuntime): void {
  if (!popup.window || popup.window.isDestroyed()) return;
  const bounds = popup.window.getBounds();
  popup.width = bounds.width;
  popup.height = bounds.height;
}

function closePopup(popupId: string, status: PopupStatus): PopupRuntime | undefined {
  const popup = popupRegistry.get(popupId);
  if (!popup) {
    return undefined;
  }

  popup.status = status;
  popup.closedAt = popup.closedAt ?? new Date().toISOString();

  if (popup.window && !popup.window.isDestroyed()) {
    popup.window.close();
  }

  popup.window = undefined;
  return popup;
}

function resizePopup(popupId: string, body: Record<string, unknown>): PopupRuntime | undefined {
  const popup = popupRegistry.get(popupId);
  if (!popup) {
    return undefined;
  }
  if (!popup.window || popup.window.isDestroyed()) {
    throw new ControlHttpError(409, "Popup window is not open");
  }

  const rawPreset = (body as { size?: unknown; preset?: unknown }).size ?? (body as { preset?: unknown }).preset;
  const hasPreset = typeof rawPreset === "string";
  const explicitWidth = Number(body.width);
  const explicitHeight = Number(body.height);
  const hasCustomDimension =
    (Number.isFinite(explicitWidth) && explicitWidth >= 240) ||
    (Number.isFinite(explicitHeight) && explicitHeight >= 200);
  const preset = resolveResizePreset(rawPreset, popup.size ?? "default", hasCustomDimension);
  const override = hasPreset
    ? { width: body.width, height: body.height }
    : {
        width: Object.prototype.hasOwnProperty.call(body, "width") ? body.width : popup.width,
        height: Object.prototype.hasOwnProperty.call(body, "height") ? body.height : popup.height,
      };
  const geometry = resolveWindowGeometry(screen.getPrimaryDisplay().workAreaSize, preset, override);

  popup.size = preset;
  popup.window.setMinimumSize(geometry.minWidth, geometry.minHeight);
  if (geometry.fullScreen) {
    popup.window.setFullScreen(true);
  } else {
    if (popup.window.isFullScreen()) {
      popup.window.setFullScreen(false);
    }
    popup.window.setSize(geometry.width, geometry.height, true);
    popup.window.center();
  }
  popup.window.focus();
  updatePopupBounds(popup);
  return popup;
}

function popupPayloadFromEvents(
  popup: PopupRuntime,
  event = popup.events?.at(-1),
): NonNullable<PopupRuntime["completion"]>["payload"] | undefined {
  const events = popup.events ?? [];
  if (!event && events.length === 0) return undefined;
  return {
    actionId: event?.actionId,
    value: event?.value,
    fields: event?.fields,
    event,
    events,
  };
}

function recordPopupEvent(
  popupId: string,
  body: Record<string, unknown>,
): { popup: PopupRuntime; event: PopupInteractionEvent } | undefined {
  const popup = popupRegistry.get(popupId);
  if (!popup) {
    return undefined;
  }

  const kind = typeof body.kind === "string" ? body.kind : "action";
  const allowedKinds = new Set<PopupInteractionEventKind>(["action", "input", "submit", "message"]);
  const event: PopupInteractionEvent = {
    eventId: createId("evt"),
    kind: allowedKinds.has(kind as PopupInteractionEventKind) ? (kind as PopupInteractionEventKind) : "action",
    component: typeof body.component === "string" && body.component.trim() ? body.component.slice(0, 80) : "Unknown",
    actionId: typeof body.actionId === "string" && body.actionId.trim() ? body.actionId.slice(0, 120) : "default",
    label: typeof body.label === "string" ? body.label.slice(0, 160) : undefined,
    value: Object.prototype.hasOwnProperty.call(body, "value") ? sanitizeJsonValue(body.value) : undefined,
    fields: isJsonRecord(body.fields) ? (sanitizeJsonValue(body.fields) as Record<string, unknown>) : undefined,
    createdAt: new Date().toISOString(),
  };

  popup.events = [...(popup.events ?? []), event].slice(-50);
  return { popup, event };
}

function completePopup(popupId: string, body: Record<string, unknown>): PopupRuntime | undefined {
  const outcome = body.outcome === "cancelled" ? "cancelled" : body.outcome === "failed" ? "failed" : "completed";
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : undefined;
  const popup = popupRegistry.get(popupId);
  if (!popup) {
    return undefined;
  }

  const completedAt = new Date().toISOString();
  popup.status = outcome;
  popup.closedAt = popup.closedAt ?? completedAt;
  popup.completion = { outcome, payload: payload ?? popupPayloadFromEvents(popup), completedAt };

  if (popup.window && !popup.window.isDestroyed()) {
    popup.window.close();
  }

  popup.window = undefined;
  return popup;
}

function serializePopup(popup: PopupRuntime): PopupOpenResponse {
  return {
    popupId: popup.popupId,
    artifactId: popup.artifactId,
    agentId: popup.agentId,
    title: popup.title,
    previewUrl: popup.previewUrl,
    status: popup.status,
    createdAt: popup.createdAt,
    closedAt: popup.closedAt,
    error: popup.error,
    events: popup.events,
    completion: popup.completion,
    generationMode: popup.generationMode,
    size: popup.size,
    width: popup.width,
    height: popup.height,
    brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
  };
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === nextUrl || origin === controlUrl) return true;
  try {
    const incoming = new URL(origin);
    const allowed = [nextUrl, controlUrl].filter(Boolean).map((value) => new URL(value));
    return allowed.some(
      (target) =>
        incoming.protocol === target.protocol &&
        incoming.port === target.port &&
        ["127.0.0.1", "localhost", "::1"].includes(incoming.hostname) &&
        ["127.0.0.1", "localhost", "::1"].includes(target.hostname),
    );
  } catch {
    return false;
  }
}

function requireControlToken(req: IncomingMessage): void {
  if (!controlToken) return;
  const header = req.headers["x-genui-token"];
  const received = Array.isArray(header) ? header[0] : header;
  if (received !== controlToken) {
    throw new ControlHttpError(401, "Invalid or missing GenUI control token");
  }
}

function setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin) && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "content-type,x-genui-token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(body);
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const theme = resolveTheme(settings.theme);
  const workArea = screen.getPrimaryDisplay().workArea;
  const settingsWindowWidth = Math.min(980, Math.max(560, Math.floor(workArea.width - 48)));
  const settingsWindowHeight = Math.min(900, Math.max(560, Math.floor(workArea.height - 48)));
  settingsWindow = new BrowserWindow({
    title: "GenUI Broker — Settings",
    width: settingsWindowWidth,
    height: settingsWindowHeight,
    minWidth: Math.min(560, settingsWindowWidth),
    minHeight: Math.min(560, settingsWindowHeight),
    resizable: true,
    minimizable: false,
    maximizable: false,
    show: true,
    frame: false,
    movable: true,
    transparent: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  routeExternalLinks(settingsWindow);

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  const settingsUrl =
    `${nextUrl}/settings` +
    `?controlUrl=${encodeURIComponent(controlUrl)}` +
    `&token=${encodeURIComponent(controlToken)}` +
    `&theme=${theme}` +
    `&animation=${settings.design.windowAnimationPreset}` +
    `&visualTheme=${settings.design.visualThemePreset}` +
    `&themeColor=${settings.design.themeColorPreset}` +
    `&chrome=hud`;
  void settingsWindow.loadURL(settingsUrl);
}

async function restartService(): Promise<void> {
  if (nextProcess) {
    isRestartingService = true;
    nextProcess.kill();
    nextProcess = null;
  }

  nextUrl = "";
  try {
    await startNextService();
  } finally {
    isRestartingService = false;
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    const theme = resolveTheme(settings.theme);
    settingsWindow.loadURL(
      `${nextUrl}/settings?controlUrl=${encodeURIComponent(controlUrl)}&token=${encodeURIComponent(controlToken)}&theme=${theme}&animation=${settings.design.windowAnimationPreset}&visualTheme=${settings.design.visualThemePreset}&themeColor=${settings.design.themeColorPreset}&chrome=hud`,
    );
  }
}

function buildTray(): void {
  tray = new Tray(createTrayImage());
  tray.setToolTip("GenUI Popup Broker");
  tray.on("click", () => openSettingsWindow());
  tray.on("right-click", () => {
    tray?.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Settings…", click: openSettingsWindow },
        { type: "separator" },
        { label: `Control: ${controlUrl || "—"}`, enabled: false },
        { label: `Next:    ${nextUrl || "—"}`, enabled: false },
        { type: "separator" },
        { label: "Restart Service", click: () => void restartService() },
        { type: "separator" },
        { label: "Quit", click: () => app.quit() },
      ]),
    );
  });
}

async function boot(): Promise<void> {
  process.env.GENUI_DATA_DIR = process.env.GENUI_DATA_DIR ?? getDefaultGenUIDataDir();
  controlToken = controlToken || crypto.randomUUID();
  settings = await readSettings();
  nativeTheme.themeSource = settings.theme === "auto" ? "system" : settings.theme;
  try {
    app.setLoginItemSettings({ openAtLogin: settings.launchAtLogin, openAsHidden: true });
  } catch (err) {
    console.warn("[genui] failed to set login item:", err);
  }
  if (process.platform === "darwin") {
    app.dock?.hide();
  }

  // Build the tray first so the app is always reachable from the menu bar,
  // even if a background service fails to start. Otherwise an early service
  // error leaves the process running with no tray and no dock icon.
  buildTray();

  try {
    await startNextService();
  } catch (err) {
    nextServiceStatus = "failed";
    console.error("[genui] next service failed to start:", err);
    scheduleNextRestart();
  }
  try {
    await startControlApi();
  } catch (err) {
    console.error("[genui] control API failed to start:", err);
  }
  console.log(`[genui] control API: ${controlUrl}`);
  console.log(`[genui] next service: ${nextUrl}`);
}

app.whenReady().then(() => {
  void boot();
});

app.on("window-all-closed", () => {
  // Keep the broker resident in the tray after all windows are closed.
});

app.on("before-quit", () => {
  isQuitting = true;
  for (const popup of popupRegistry.values()) {
    if (popup.window && !popup.window.isDestroyed()) {
      popup.window.destroy();
    }
  }

  controlServer?.close();
  nextProcess?.kill();
});
