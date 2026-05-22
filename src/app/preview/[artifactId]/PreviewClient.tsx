"use client";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";

import { useCallback, useEffect } from "react";
import { Renderer } from "@openuidev/react-lang";
import { library } from "@/library";
import { useFrameIntro } from "@/app/useFrameIntro";

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
  artifactId,
  agentLabel,
  popupId,
  controlUrl,
  size,
}: PreviewClientProps) {
  const intro = useFrameIntro();

  const closePopup = useCallback(async () => {
    if (popupId && controlUrl) {
      try {
        await fetch(`${controlUrl}/v1/popups/${popupId}/close`, { method: "POST" });
        return;
      } catch {
        /* fall through to window.close */
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

  const shortId = artifactId.slice(-6).toUpperCase();
  const agent = (agentLabel ?? "agent").toUpperCase();
  const preset = (size ?? "default").toUpperCase();

  return (
    <div
      className={`app-surface hud-frame flex h-screen w-screen flex-col${intro ? " frame--intro" : ""}`}
    >
      <span className="hud-corner" aria-hidden />

      <div className="app-content flex h-full flex-col">
        <header className="app-drag flex shrink-0 flex-col gap-1 px-6 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <span className="hud-eyebrow truncate">
              <b>{agent}</b> &nbsp;//&nbsp; ID {shortId} &nbsp;//&nbsp; {preset}
            </span>
            <button
              className="app-close"
              onClick={closePopup}
              type="button"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                <path
                  d="M1 1 L9 9 M9 1 L1 9"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <span className="status-reticle" aria-hidden />
            <h1 className="hud-title truncate text-[16px]">{artifactTitle}</h1>
          </div>

          <div className="hud-divider mt-2" />
        </header>

        <main className="app-scroll genui-preview-scroll flex-1 overflow-auto px-6 py-5">
          <div className="genui-render-root">
            <Renderer response={openuiLang} library={library} />
          </div>
        </main>
      </div>
    </div>
  );
}
