import type { GenUISizePreset } from "./types";

export type WindowDisplaySize = {
  width: number;
  height: number;
};

export type WindowGeometry = {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  fullScreen?: boolean;
};

export const WINDOW_SIZE_PRESETS: GenUISizePreset[] = [
  "compact",
  "card",
  "panel",
  "default",
  "wide",
  "review",
  "tall",
  "stage",
  "cinema",
  "fullscreen",
];

export const SIZE_PRESET_RATIOS: Record<GenUISizePreset, { w: number; h: number }> = {
  compact: { w: 0.22, h: 0.30 },
  card: { w: 0.32, h: 0.46 },
  panel: { w: 0.42, h: 0.58 },
  default: { w: 0.56, h: 0.66 },
  wide: { w: 0.72, h: 0.58 },
  review: { w: 0.78, h: 0.72 },
  tall: { w: 0.40, h: 0.86 },
  stage: { w: 0.78, h: 0.78 },
  cinema: { w: 0.92, h: 0.82 },
  fullscreen: { w: 1.00, h: 1.00 },
};

export const SIZE_PRESET_MIN: Record<GenUISizePreset, { w: number; h: number }> = {
  compact: { w: 320, h: 280 },
  card: { w: 380, h: 420 },
  panel: { w: 520, h: 480 },
  default: { w: 640, h: 520 },
  wide: { w: 760, h: 480 },
  review: { w: 960, h: 620 },
  tall: { w: 440, h: 640 },
  stage: { w: 880, h: 640 },
  cinema: { w: 1024, h: 640 },
  fullscreen: { w: 800, h: 600 },
};

export function coerceSizePreset(value: unknown, fallback: GenUISizePreset = "default"): GenUISizePreset {
  return typeof value === "string" && WINDOW_SIZE_PRESETS.includes(value as GenUISizePreset)
    ? (value as GenUISizePreset)
    : fallback;
}

export function resolveWindowGeometry(
  display: WindowDisplaySize,
  preset: GenUISizePreset,
  override?: { width?: unknown; height?: unknown },
): WindowGeometry {
  const ratio = SIZE_PRESET_RATIOS[preset];
  const min = SIZE_PRESET_MIN[preset];
  const w = Math.max(min.w, Math.floor(display.width * ratio.w));
  const h = Math.max(min.h, Math.floor(display.height * ratio.h));

  const explicitW = Number(override?.width);
  const explicitH = Number(override?.height);
  const width = Number.isFinite(explicitW) && explicitW >= 240 ? Math.min(display.width, Math.floor(explicitW)) : w;
  const height = Number.isFinite(explicitH) && explicitH >= 200 ? Math.min(display.height, Math.floor(explicitH)) : h;

  const minWidth = Number.isFinite(explicitW) && explicitW >= 240 ? Math.min(min.w, width) : min.w;
  const minHeight = Number.isFinite(explicitH) && explicitH >= 200 ? Math.min(min.h, height) : min.h;

  return {
    width,
    height,
    minWidth,
    minHeight,
    fullScreen: preset === "fullscreen",
  };
}
