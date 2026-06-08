"use client";

import { type ReactNode } from "react";

type LiquidGlassSurfaceProps = {
  animation?: string;
  children: ReactNode;
  opaque?: boolean;
  themeColor?: string;
  visualTheme?: string;
};

const animationPresets = new Set(["center", "left", "right", "top", "fade"]);
const visualThemePresets = new Set(["hud", "workbench", "studio", "briefing"]);
const themeColorPresets = new Set([
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

export function LiquidGlassSurface({ animation, children, opaque, themeColor, visualTheme }: LiquidGlassSurfaceProps) {
  const animationPreset = animationPresets.has(animation ?? "") ? animation : "center";
  const visualThemePreset = visualThemePresets.has(visualTheme ?? "") ? visualTheme : "hud";
  const themeColorPreset = themeColorPresets.has(themeColor ?? "") ? themeColor : "mint";

  return (
    <div
      className="lg-shell"
      data-opaque={opaque ? "true" : "false"}
      data-theme-color={themeColorPreset}
      data-visual-theme={visualThemePreset}
    >
      <div className="lg-wallpaper" />
      <div className="lg-center">
        <div className="lg-window-frame" data-animation={animationPreset}>
          <div className="lg-glass-window">{children}</div>
        </div>
      </div>
    </div>
  );
}
