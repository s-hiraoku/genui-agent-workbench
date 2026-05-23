import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import { URL } from "node:url";
import { app, BrowserWindow, Menu, nativeImage, nativeTheme, screen, Tray } from "electron";
import { OpenUILangValidationError, renderGenUI } from "../src/server/genui/render";
import { writeBrokerState } from "../src/server/genui/broker-state";
import { agentUsageGuide } from "../src/server/genui/agent-guide";
import { componentCatalog } from "../src/server/genui/component-catalog";
import { BROKER_APP_VERSION, BROKER_PROTOCOL_VERSION } from "../src/server/genui/version";
import {
  type BrokerSettings,
  readSettings,
  sanitizeSettings,
  writeSettings,
} from "../src/server/genui/settings";
import type { PopupOpenResponse, PopupRecord, PopupStatus, RenderGenUIInput } from "../src/server/genui/types";

type PopupRuntime = PopupRecord & {
  window?: BrowserWindow;
};

const popupRegistry = new Map<string, PopupRuntime>();

let tray: Tray | null = null;
let settingsWindow: BrowserWindow | null = null;
let nextProcess: ChildProcessWithoutNullStreams | null = null;
let nextUrl = process.env.GENUI_NEXT_URL ?? "";
let controlServer: http.Server | null = null;
let controlUrl = "";
let settings: BrokerSettings;

type SizePreset =
  | "compact"
  | "card"
  | "panel"
  | "default"
  | "wide"
  | "tall"
  | "stage"
  | "cinema"
  | "fullscreen";

type WindowGeometry = {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  fullScreen?: boolean;
};

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
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
    await waitForHttp(nextUrl);
    return;
  }

  const preferredPort = settings.nextPort ?? Number(process.env.GENUI_NEXT_PORT ?? 3000);
  const port = await findOpenPort(preferredPort);
  nextUrl = `http://127.0.0.1:${port}`;
  nextProcess = spawn("npm", ["run", "dev", "--", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: process.cwd(),
    env: process.env,
  });

  nextProcess.stdout.on("data", (chunk) => console.log(`[next] ${chunk}`.trimEnd()));
  nextProcess.stderr.on("data", (chunk) => console.error(`[next] ${chunk}`.trimEnd()));
  nextProcess.on("exit", (code) => {
    console.log(`[next] exited with code ${code}`);
    nextProcess = null;
  });

  await waitForHttp(nextUrl);
}

async function startControlApi(): Promise<void> {
  const preferredPort = settings.controlPort ?? Number(process.env.GENUI_CONTROL_PORT ?? 48231);
  const port = await findOpenPort(preferredPort);

  controlServer = http.createServer((req, res) => {
    handleControlRequest(req, res).catch((error) => {
      sendJson(res, 500, { error: error instanceof Error ? error.message : "Unknown error" });
    });
  });

  await new Promise<void>((resolve) => {
    controlServer?.listen(port, "127.0.0.1", resolve);
  });

  controlUrl = `http://127.0.0.1:${port}`;
  await writeBrokerState({
    controlUrl,
    nextUrl,
    pid: process.pid,
    brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
    appVersion: BROKER_APP_VERSION,
    updatedAt: new Date().toISOString(),
  });
}

async function readRequestJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

async function handleControlRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", controlUrl || "http://127.0.0.1");
  const popupMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)$/);
  const popupCloseMatch = url.pathname.match(/^\/v1\/popups\/([^/]+)\/close$/);

  if (req.method === "GET" && url.pathname === "/v1/status") {
    sendJson(res, 200, {
      status: "ok",
      brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
      appVersion: BROKER_APP_VERSION,
      controlUrl,
      nextUrl,
      pid: process.pid,
      popupCount: popupRegistry.size,
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

  if (req.method === "GET" && url.pathname === "/v1/guide") {
    sendJson(res, 200, agentUsageGuide);
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/sizes") {
    const display = screen.getPrimaryDisplay().workAreaSize;
    sendJson(res, 200, {
      brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
      workArea: display,
      presets: (Object.keys(PRESET_RATIOS) as SizePreset[]).map((p) => ({
        id: p,
        ratio: PRESET_RATIOS[p],
        min: PRESET_MIN[p],
        approxPx: {
          width: Math.max(PRESET_MIN[p].w, Math.floor(display.width * PRESET_RATIOS[p].w)),
          height: Math.max(PRESET_MIN[p].h, Math.floor(display.height * PRESET_RATIOS[p].h)),
        },
      })),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/v1/settings") {
    sendJson(res, 200, { settings, themeResolved: resolveTheme(settings.theme) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/settings") {
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

  if (req.method === "GET" && popupMatch) {
    const popup = popupRegistry.get(popupMatch[1]);
    if (!popup) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, serializePopup(popup));
    return;
  }

  if (req.method === "POST" && popupCloseMatch) {
    const popup = closePopup(popupCloseMatch[1], "closed");
    if (!popup) {
      sendJson(res, 404, { error: "Popup not found" });
      return;
    }

    sendJson(res, 200, serializePopup(popup));
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

const PRESET_RATIOS: Record<SizePreset, { w: number; h: number }> = {
  compact:    { w: 0.22, h: 0.30 },
  card:       { w: 0.32, h: 0.46 },
  panel:      { w: 0.42, h: 0.58 },
  default:    { w: 0.56, h: 0.66 },
  wide:       { w: 0.72, h: 0.58 },
  tall:       { w: 0.40, h: 0.86 },
  stage:      { w: 0.78, h: 0.78 },
  cinema:     { w: 0.92, h: 0.82 },
  fullscreen: { w: 1.00, h: 1.00 },
};

const PRESET_MIN: Record<SizePreset, { w: number; h: number }> = {
  compact:    { w: 320, h: 280 },
  card:       { w: 380, h: 420 },
  panel:      { w: 520, h: 480 },
  default:    { w: 640, h: 520 },
  wide:       { w: 760, h: 480 },
  tall:       { w: 440, h: 640 },
  stage:      { w: 880, h: 640 },
  cinema:     { w: 1024, h: 640 },
  fullscreen: { w: 800, h: 600 },
};

function pickPreset(input: RenderGenUIInput): SizePreset {
  const raw = (input as { size?: unknown; preset?: unknown }).size ?? (input as { preset?: unknown }).preset;
  if (typeof raw === "string" && raw in PRESET_RATIOS) {
    return raw as SizePreset;
  }
  return "default";
}

function geometryForPreset(preset: SizePreset, override?: { width?: unknown; height?: unknown }): WindowGeometry {
  const display = screen.getPrimaryDisplay().workAreaSize;
  const ratio = PRESET_RATIOS[preset];
  const min = PRESET_MIN[preset];
  const w = Math.max(min.w, Math.floor(display.width * ratio.w));
  const h = Math.max(min.h, Math.floor(display.height * ratio.h));

  const explicitW = Number(override?.width);
  const explicitH = Number(override?.height);
  const width = Number.isFinite(explicitW) && explicitW >= 240 ? Math.min(display.width, Math.floor(explicitW)) : w;
  const height = Number.isFinite(explicitH) && explicitH >= 200 ? Math.min(display.height, Math.floor(explicitH)) : h;

  return {
    width,
    height,
    minWidth: min.w,
    minHeight: min.h,
    fullScreen: preset === "fullscreen",
  };
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
  const popupId = createId("pop");
  const title = input.title ?? `${input.agentId ?? "Agent"} GenUI`;
  const theme = resolveTheme(settings.theme);
  const preset = pickPreset(input);
  const geometry = geometryForPreset(preset, input as { width?: unknown; height?: unknown });
  const pos = nextWindowPosition(geometry);

  const previewUrl =
    `${nextUrl}${result.previewPath}` +
    `?popupId=${encodeURIComponent(popupId)}` +
    `&controlUrl=${encodeURIComponent(controlUrl)}` +
    `&theme=${theme}` +
    `&chrome=hud` +
    `&size=${preset}` +
    `&animation=${settings.design.windowAnimationPreset}` +
    `&themeColor=${settings.design.themeColorPreset}` +
    `&agent=${encodeURIComponent(input.agentId ?? "agent")}`;

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

  if (geometry.fullScreen) {
    window.setFullScreen(true);
  }
  const popup: PopupRuntime = {
    popupId,
    artifactId: result.artifact.artifactId,
    agentId: input.agentId,
    title,
    status: "opening",
    previewUrl,
    createdAt: new Date().toISOString(),
    generationMode: result.artifact.generationMode,
    window,
  };

  popupRegistry.set(popupId, popup);

  window.on("closed", () => {
    popup.status = "closed";
    popup.closedAt = popup.closedAt ?? new Date().toISOString();
    popup.window = undefined;
  });

  window.show();
  await window.loadURL(previewUrl);
  window.focus();
  popup.status = "open";

  return serializePopup(popup);
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

function serializePopup(popup: PopupRuntime): PopupOpenResponse {
  return {
    popupId: popup.popupId,
    artifactId: popup.artifactId,
    previewUrl: popup.previewUrl,
    status: popup.status,
    generationMode: popup.generationMode,
    brokerProtocolVersion: BROKER_PROTOCOL_VERSION,
  };
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  setCorsHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }

  const theme = resolveTheme(settings.theme);
  settingsWindow = new BrowserWindow({
    title: "GenUI Broker — Settings",
    width: 560,
    height: 640,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: true,
    frame: false,
    transparent: true,
    hasShadow: true,
    backgroundColor: "#00000000",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  const settingsUrl =
    `${nextUrl}/settings` +
    `?controlUrl=${encodeURIComponent(controlUrl)}` +
    `&theme=${theme}` +
    `&animation=${settings.design.windowAnimationPreset}` +
    `&themeColor=${settings.design.themeColorPreset}` +
    `&chrome=hud`;
  void settingsWindow.loadURL(settingsUrl);
}

async function restartService(): Promise<void> {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }

  nextUrl = "";
  await startNextService();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    const theme = resolveTheme(settings.theme);
    settingsWindow.loadURL(
      `${nextUrl}/settings?controlUrl=${encodeURIComponent(controlUrl)}&theme=${theme}&animation=${settings.design.windowAnimationPreset}&themeColor=${settings.design.themeColorPreset}&chrome=hud`,
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

  await startNextService();
  await startControlApi();
  buildTray();
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
  for (const popup of popupRegistry.values()) {
    if (popup.window && !popup.window.isDestroyed()) {
      popup.window.destroy();
    }
  }

  controlServer?.close();
  nextProcess?.kill();
});
