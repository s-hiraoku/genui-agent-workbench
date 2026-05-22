"use client";

import { useEffect, useState } from "react";

/**
 * Returns `true` for the first ~1.6s after mount, then `false`.
 * Attach to a `.app-surface` element as the `frame--intro` class.
 */
export function useFrameIntro(durationMs = 1600): boolean {
  const [intro, setIntro] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setIntro(false), durationMs);
    return () => clearTimeout(t);
  }, [durationMs]);
  return intro;
}
