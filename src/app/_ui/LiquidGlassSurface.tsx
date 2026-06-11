"use client";

import { type ReactNode, useEffect, useState } from "react";

type LiquidGlassSurfaceProps = {
  appearanceTheme?: string;
  animation?: string;
  children: ReactNode;
  themeColor?: string;
  visualTheme?: string;
};

const appearanceThemes = new Set(["auto", "dark", "light"]);
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

type ResolvedAppearanceTheme = "dark" | "light";

function readResolvedAppearanceTheme(): ResolvedAppearanceTheme {
  if (typeof document !== "undefined") {
    const documentAppearance = document.documentElement.getAttribute("data-appearance");
    if (documentAppearance === "dark" || documentAppearance === "light") return documentAppearance;
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function LiquidGlassSurface({
  appearanceTheme,
  animation,
  children,
  themeColor,
  visualTheme,
}: LiquidGlassSurfaceProps) {
  const appearanceThemePreset = appearanceThemes.has(appearanceTheme ?? "") ? appearanceTheme : "auto";
  const [systemAppearanceTheme, setSystemAppearanceTheme] = useState<ResolvedAppearanceTheme>(() =>
    readResolvedAppearanceTheme(),
  );
  const animationPreset = animationPresets.has(animation ?? "") ? animation : "center";
  const visualThemePreset = visualThemePresets.has(visualTheme ?? "") ? visualTheme : "hud";
  const themeColorPreset = themeColorPresets.has(themeColor ?? "") ? themeColor : "mint";
  const resolvedAppearanceTheme =
    appearanceThemePreset === "auto" ? systemAppearanceTheme : (appearanceThemePreset as ResolvedAppearanceTheme);

  useEffect(() => {
    if (appearanceThemePreset !== "auto" || typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemAppearanceTheme(readResolvedAppearanceTheme());
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [appearanceThemePreset]);

  return (
    <div
      className="lg-shell"
      data-appearance-theme={resolvedAppearanceTheme}
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
