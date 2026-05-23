"use client";

import { type ReactNode } from "react";

type LiquidGlassSurfaceProps = {
  animation?: string;
  children: ReactNode;
  themeColor?: string;
};

const animationPresets = new Set(["center", "left", "right", "top", "fade"]);
const themeColorPresets = new Set([
  "tactical",
  "blue",
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

export function LiquidGlassSurface({ animation, children, themeColor }: LiquidGlassSurfaceProps) {
  const animationPreset = animationPresets.has(animation ?? "") ? animation : "center";
  const themeColorPreset = themeColorPresets.has(themeColor ?? "") ? themeColor : "tactical";

  return (
    <div className="lg-shell" data-theme-color={themeColorPreset}>
      <div className="lg-wallpaper" />
      <div className="lg-center">
        <div className="lg-window-frame" data-animation={animationPreset}>
          <div className="lg-glass-window">{children}</div>
        </div>
      </div>
    </div>
  );
}
