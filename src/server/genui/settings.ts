import { promises as fs } from "node:fs";
import path from "node:path";
import { getGenUIRoot } from "./artifacts";
import type {
  GenUIDesignSettings,
  GenUIGlassPreset,
  GenUILabelInkPreset,
  GenUIThemeColorPreset,
  GenUIVisualThemePreset,
  GenUIWindowAnimationPreset,
} from "./types";

export type AppearanceTheme = "auto" | "dark" | "light";

export type BrokerSettings = {
  theme: AppearanceTheme;
  launchAtLogin: boolean;
  controlPort: number | null;
  nextPort: number | null;
  design: GenUIDesignSettings;
};

const SETTINGS_FILE = "settings.json";

export const DEFAULT_SETTINGS: BrokerSettings = {
  theme: "auto",
  launchAtLogin: false,
  controlPort: null,
  nextPort: null,
  design: {
    visualThemePreset: "hud",
    glassPreset: "milky",
    labelInkPreset: "green",
    themeColorPreset: "mint",
    windowAnimationPreset: "center",
  },
};

export function getSettingsPath(): string {
  return path.join(getGenUIRoot(), SETTINGS_FILE);
}

export async function readSettings(): Promise<BrokerSettings> {
  try {
    const raw = await fs.readFile(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<BrokerSettings>;
    return sanitizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
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

const GLASS_PRESETS = new Set<GenUIGlassPreset>(["clear", "pane", "milky", "dense", "mint", "sky", "rose", "amber"]);
const LABEL_INK_PRESETS = new Set<GenUILabelInkPreset>(["green", "slate", "white", "blue", "amber", "red"]);
const VISUAL_THEME_PRESETS = new Set<GenUIVisualThemePreset>(["hud", "workbench", "studio", "briefing"]);
const THEME_COLOR_PRESETS = new Set<GenUIThemeColorPreset>([
  "blue",
  "azure",
  "cyan",
  "violet",
  "mint",
  "rose",
  "amber",
  "white",
  "midnight",
  "forest",
  "crimson",
  "graphite",
]);
const WINDOW_ANIMATION_PRESETS = new Set<GenUIWindowAnimationPreset>(["center", "left", "right", "top", "fade"]);

function sanitizeDesign(value: unknown): GenUIDesignSettings {
  const input = typeof value === "object" && value !== null ? (value as Partial<GenUIDesignSettings>) : {};
  const visualThemePreset = VISUAL_THEME_PRESETS.has(input.visualThemePreset as GenUIVisualThemePreset)
    ? (input.visualThemePreset as GenUIVisualThemePreset)
    : DEFAULT_SETTINGS.design.visualThemePreset;
  const glassPreset = GLASS_PRESETS.has(input.glassPreset as GenUIGlassPreset)
    ? (input.glassPreset as GenUIGlassPreset)
    : DEFAULT_SETTINGS.design.glassPreset;
  const labelInkPreset = LABEL_INK_PRESETS.has(input.labelInkPreset as GenUILabelInkPreset)
    ? (input.labelInkPreset as GenUILabelInkPreset)
    : DEFAULT_SETTINGS.design.labelInkPreset;
  const themeColorPreset = THEME_COLOR_PRESETS.has(input.themeColorPreset as GenUIThemeColorPreset)
    ? (input.themeColorPreset as GenUIThemeColorPreset)
    : DEFAULT_SETTINGS.design.themeColorPreset;
  const windowAnimationPreset = WINDOW_ANIMATION_PRESETS.has(input.windowAnimationPreset as GenUIWindowAnimationPreset)
    ? (input.windowAnimationPreset as GenUIWindowAnimationPreset)
    : DEFAULT_SETTINGS.design.windowAnimationPreset;
  return { visualThemePreset, glassPreset, labelInkPreset, themeColorPreset, windowAnimationPreset };
}

export function sanitizeSettings(
  input: Partial<Omit<BrokerSettings, "design">> & { design?: Partial<GenUIDesignSettings> },
): BrokerSettings {
  const theme: AppearanceTheme =
    input.theme === "dark" || input.theme === "light" || input.theme === "auto" ? input.theme : DEFAULT_SETTINGS.theme;
  return {
    theme,
    launchAtLogin: Boolean(input.launchAtLogin),
    controlPort: sanitizePort(input.controlPort),
    nextPort: sanitizePort(input.nextPort),
    design: sanitizeDesign(input.design),
  };
}
