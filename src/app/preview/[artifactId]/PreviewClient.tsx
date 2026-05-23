"use client";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";

import { useCallback, useEffect } from "react";
import { Renderer } from "@openuidev/react-lang";
import { X } from "lucide-react";
import { library } from "@/library";
import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";

type PreviewClientProps = {
  openuiLang: string;
  artifactTitle: string;
  artifactId: string;
  agentLabel?: string;
  popupId?: string;
  controlUrl?: string;
  size?: string;
};

export function PreviewClient({
  openuiLang,
  artifactTitle,
  popupId,
  controlUrl,
}: PreviewClientProps) {
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
    <LiquidGlassSurface>
      <div className="lg-content h-full">
        <header className="lg-drag flex shrink-0 items-center justify-between gap-3 px-2 pt-1 pb-3">
          <h1 className="lg-title truncate">{artifactTitle}</h1>
          <button
            className="lg-icon-button"
            onClick={closePopup}
            type="button"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </header>

        <main className="lg-scroll flex-1 overflow-auto">
          <Renderer response={openuiLang} library={library} />
        </main>
      </div>
    </LiquidGlassSurface>
  );
}
