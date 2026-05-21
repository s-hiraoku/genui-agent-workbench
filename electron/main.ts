import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import path from "node:path";
import { URL } from "node:url";
import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";
import { renderGenUI } from "../src/server/genui/render";
import { writeBrokerState } from "../src/server/genui/broker-state";
import type { PopupOpenResponse, PopupRecord, PopupStatus, RenderGenUIInput } from "../src/server/genui/types";

type PopupRuntime = PopupRecord & {
  window?: BrowserWindow;
};

const popupRegistry = new Map<string, PopupRuntime>();

let tray: Tray | null = null;
let dashboardWindow: BrowserWindow | null = null;
let nextProcess: ChildProcessWithoutNullStreams | null = null;
let nextUrl = process.env.GENUI_NEXT_URL ?? "";
let controlServer: http.Server | null = null;
let controlUrl = "";

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

function createTrayImage() {
  return nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAAKUlEQVR4AWMYBaNgFIyCUTAKRsEoGAXD////Gf4TjIJRMApGwSgYBQMAst0EJ5s8bZkAAAAASUVORK5CYII=",
  );
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

  const port = await findOpenPort(Number(process.env.GENUI_NEXT_PORT ?? 3000));
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
  const port = await findOpenPort(Number(process.env.GENUI_CONTROL_PORT ?? 48231));

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

  if (req.method === "POST" && url.pathname === "/v1/popups") {
    const body = await readRequestJson(req);
    const opened = await openPopup(body as RenderGenUIInput);
    sendJson(res, 200, opened);
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

async function openPopup(input: RenderGenUIInput): Promise<PopupOpenResponse> {
  const result = await renderGenUI(input);
  const popupId = createId("pop");
  const title = input.title ?? `${input.agentId ?? "Agent"} GenUI`;
  const previewUrl = `${nextUrl}${result.previewPath}?popupId=${encodeURIComponent(popupId)}&controlUrl=${encodeURIComponent(
    controlUrl,
  )}`;
  const window = new BrowserWindow({
    title,
    width: 980,
    height: 760,
    minWidth: 560,
    minHeight: 420,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  const popup: PopupRuntime = {
    popupId,
    artifactId: result.artifact.artifactId,
    agentId: input.agentId,
    title,
    status: "opening",
    previewUrl,
    createdAt: new Date().toISOString(),
    window,
  };

  popupRegistry.set(popupId, popup);

  window.on("closed", () => {
    popup.status = "closed";
    popup.closedAt = popup.closedAt ?? new Date().toISOString();
    popup.window = undefined;
  });

  await window.loadURL(previewUrl);
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

function openDashboard(): void {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.focus();
    return;
  }

  dashboardWindow = new BrowserWindow({
    title: "GenUI Popup Broker",
    width: 1120,
    height: 820,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  dashboardWindow.on("closed", () => {
    dashboardWindow = null;
  });
  dashboardWindow.loadURL(nextUrl);
}

function openLatestPreview(): void {
  const latest = [...popupRegistry.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) {
    openDashboard();
    return;
  }

  const window = new BrowserWindow({
    title: latest.title,
    width: 980,
    height: 760,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  window.loadURL(latest.previewUrl);
}

async function restartService(): Promise<void> {
  if (nextProcess) {
    nextProcess.kill();
    nextProcess = null;
  }

  nextUrl = "";
  await startNextService();
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.loadURL(nextUrl);
  }
}

function buildTray(): void {
  tray = new Tray(createTrayImage());
  tray.setToolTip(`GenUI Popup Broker\nControl: ${controlUrl}\nNext: ${nextUrl}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open Dashboard", click: openDashboard },
      { label: "Open Latest Preview", click: openLatestPreview },
      { type: "separator" },
      { label: "Restart Service", click: () => void restartService() },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
}

async function boot(): Promise<void> {
  await startNextService();
  await startControlApi();
  buildTray();
  openDashboard();
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
