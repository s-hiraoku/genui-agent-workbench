export type LiveDesignSettings = {
  appearanceTheme?: string;
  animation?: string;
  themeColor?: string;
  visualTheme?: string;
};

export const POPUP_DESIGN_SETTINGS_EVENT = "genui:design-settings-changed";
export const POPUP_DESIGN_SETTINGS_GLOBAL = "__genuiLiveDesignSettings";

export function readLiveDesignSettings(detail: unknown): LiveDesignSettings | null {
  if (typeof detail !== "object" || detail === null) return null;
  const input = detail as Record<string, unknown>;
  const next: LiveDesignSettings = {};
  if (typeof input.appearanceTheme === "string") next.appearanceTheme = input.appearanceTheme;
  if (typeof input.animation === "string") next.animation = input.animation;
  if (typeof input.themeColor === "string") next.themeColor = input.themeColor;
  if (typeof input.visualTheme === "string") next.visualTheme = input.visualTheme;
  return next;
}
