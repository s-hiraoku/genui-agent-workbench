import type { BrokerSettings } from "./settings";
import type {
  GenUIThemeColorPreset,
  GenUIVisualThemePreset,
  GenUIWindowAnimationPreset,
} from "./types";

export type ResolvedPreviewTheme = "dark" | "light";

export type PreviewThemeParams = {
  animation: GenUIWindowAnimationPreset;
  theme: ResolvedPreviewTheme;
  themeColor: GenUIThemeColorPreset;
  visualTheme: GenUIVisualThemePreset;
};

export function previewThemeParamsFromSettings(
  settings: BrokerSettings,
  theme: ResolvedPreviewTheme,
): PreviewThemeParams {
  return {
    animation: settings.design.windowAnimationPreset,
    theme,
    themeColor: settings.design.themeColorPreset,
    visualTheme: settings.design.visualThemePreset,
  };
}

export function applyPreviewThemeParams(previewUrl: string, params: PreviewThemeParams): string {
  const url = new URL(previewUrl);
  url.searchParams.set("theme", params.theme);
  url.searchParams.set("animation", params.animation);
  url.searchParams.set("visualTheme", params.visualTheme);
  url.searchParams.set("themeColor", params.themeColor);
  return url.toString();
}

export function buildPopupPreviewUrl({
  agentId,
  artifactId,
  controlToken,
  controlUrl,
  nextUrl,
  popupId,
  size,
  themeParams,
}: {
  agentId: string;
  artifactId: string;
  controlToken: string;
  controlUrl: string;
  nextUrl: string;
  popupId: string;
  size: string;
  themeParams: PreviewThemeParams;
}): string {
  const url = new URL(`/preview/${artifactId}`, nextUrl);
  url.searchParams.set("popupId", popupId);
  url.searchParams.set("controlUrl", controlUrl);
  url.searchParams.set("theme", themeParams.theme);
  url.searchParams.set("chrome", "hud");
  url.searchParams.set("token", controlToken);
  url.searchParams.set("size", size);
  url.searchParams.set("animation", themeParams.animation);
  url.searchParams.set("visualTheme", themeParams.visualTheme);
  url.searchParams.set("themeColor", themeParams.themeColor);
  url.searchParams.set("agent", agentId);
  return url.toString();
}
