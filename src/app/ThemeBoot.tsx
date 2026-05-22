"use client";

import { useEffect } from "react";

function readQueryTheme(): "dark" | "light" | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const t = params.get("theme");
  return t === "dark" || t === "light" ? t : null;
}

function resolveSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeBoot() {
  useEffect(() => {
    const apply = () => {
      const queryTheme = readQueryTheme();
      const theme = queryTheme ?? resolveSystemTheme();
      document.documentElement.dataset.theme = theme;
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return null;
}
