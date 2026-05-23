"use client";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";
import "leaflet/dist/leaflet.css";

import { useCallback, useEffect, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { X } from "lucide-react";
import { library } from "@/library";
import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";

type PreviewClientProps = {
  openuiLang: string;
  artifactTitle: string;
  artifactId: string;
  agentLabel?: string;
  animation?: string;
  popupId?: string;
  controlUrl?: string;
  size?: string;
  themeColor?: string;
};

export function PreviewClient({
  openuiLang,
  artifactTitle,
  animation,
  popupId,
  controlUrl,
  themeColor,
}: PreviewClientProps) {
  const [opaque, setOpaque] = useState(false);

  const closePopup = useCallback(async () => {
    if (popupId && controlUrl) {
      try {
        const res = await fetch(
          `${controlUrl}/v1/popups/${popupId}/close`,
          { method: "POST" },
        );
        if (res.ok) return;
        // Non-2xx (e.g. broker restarted, popup id stale) — fall through
        // to window.close() so the popup never gets stuck open.
      } catch {
        /* network error — fall through */
      }
    }
    window.close();
  }, [popupId, controlUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void closePopup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePopup]);

  return (
    <LiquidGlassSurface animation={animation} opaque={opaque} themeColor={themeColor}>
      <div className="lg-content h-full">
        <header className="lg-drag flex shrink-0 items-center justify-between gap-3 px-2 pt-1 pb-3">
          <h1 className="lg-title min-w-0 truncate">{artifactTitle}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <label className="lg-opacity-toggle">
              <input
                checked={opaque}
                onChange={(event) => setOpaque(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>Opaque</span>
            </label>
            <button
              className="lg-icon-button"
              onClick={closePopup}
              type="button"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <main className="lg-scroll lg-preview flex-1 overflow-auto">
          <Renderer response={openuiLang} library={library} />
        </main>
      </div>
    </LiquidGlassSurface>
  );
}
