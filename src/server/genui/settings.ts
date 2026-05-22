import { promises as fs } from "node:fs";
import path from "node:path";
import { getGenUIRoot } from "./artifacts";

export type AppearanceTheme = "auto" | "dark" | "light";

export type BrokerSettings = {
  theme: AppearanceTheme;
  launchAtLogin: boolean;
  controlPort: number | null;
  nextPort: number | null;
};

const SETTINGS_FILE = "settings.json";

export const DEFAULT_SETTINGS: BrokerSettings = {
  theme: "auto",
  launchAtLogin: false,
  controlPort: null,
  nextPort: null,
};

export function getSettingsPath(): string {
  return path.join(getGenUIRoot(), SETTINGS_FILE);
}

export async function readSettings(): Promise<BrokerSettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<BrokerSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_SETTINGS };
    }
    throw error;
  }
}

export async function writeSettings(settings: BrokerSettings): Promise<void> {
  await fs.mkdir(getGenUIRoot(), { recursive: true });
  await fs.writeFile(getSettingsPath(), JSON.stringify(settings, null, 2), "utf8");
}

export function sanitizePort(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1024 || n > 65535) return null;
  return Math.floor(n);
}

export function sanitizeSettings(input: Partial<BrokerSettings>): BrokerSettings {
  const theme: AppearanceTheme =
    input.theme === "dark" || input.theme === "light" || input.theme === "auto" ? input.theme : DEFAULT_SETTINGS.theme;
  return {
    theme,
    launchAtLogin: Boolean(input.launchAtLogin),
    controlPort: sanitizePort(input.controlPort),
    nextPort: sanitizePort(input.nextPort),
  };
}
