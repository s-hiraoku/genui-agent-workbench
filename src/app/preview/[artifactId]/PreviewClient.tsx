"use client";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";
import "leaflet/dist/leaflet.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { Download, X } from "lucide-react";
import {
  GenUIRuntimeDataContext,
  library,
  PopupEventContext,
  type PopupEventInput,
  type PopupEventOptions,
} from "@/library";
import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";
import {
  POPUP_DESIGN_SETTINGS_GLOBAL,
  POPUP_DESIGN_SETTINGS_EVENT,
  readLiveDesignSettings,
  type LiveDesignSettings,
} from "@/app/preview/live-design-settings";

declare global {
  interface Window {
    __genuiLiveDesignSettings?: unknown;
  }
}

type PreviewClientProps = {
  openuiLang: string;
  artifactTitle: string;
  artifactId: string;
  agentLabel?: string;
  animation?: string;
  popupId?: string;
  controlUrl?: string;
  controlToken?: string;
  artifactContext?: Record<string, unknown>;
  size?: string;
  theme?: string;
  themeColor?: string;
  visualTheme?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function sanitizeFilename(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return sanitized || "genui-popup";
}

function readDocumentStyles(): string {
  return Array.from(document.styleSheets)
    .map((sheet) => {
      try {
        return Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n");
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

function htmlAttributesFor(element: Element | null): string {
  if (!element) return "";

  return Array.from(element.attributes)
    .map((attribute) => `${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join(" ");
}

function safeDocumentBaseHref(): string {
  try {
    const url = new URL(document.baseURI);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${window.location.origin}${window.location.pathname}`;
  }
}

export function PreviewClient({
  openuiLang,
  artifactTitle,
  artifactId,
  animation,
  popupId,
  controlUrl,
  controlToken,
  artifactContext,
  theme,
  themeColor,
  visualTheme,
}: PreviewClientProps) {
  const authHeaders = useMemo(() => (controlToken ? { "x-genui-token": controlToken } : undefined), [controlToken]);
  const previewRef = useRef<HTMLElement>(null);
  const [liveDesignSettings, setLiveDesignSettings] = useState<LiveDesignSettings>(() => ({
    appearanceTheme: theme,
    animation,
    themeColor,
    visualTheme,
  }));

  const closePopup = useCallback(async () => {
    if (popupId && controlUrl) {
      try {
        const res = await fetch(
          `${controlUrl}/v1/popups/${popupId}/close`,
          { method: "POST", headers: authHeaders },
        );
        if (res.ok) return;
        // Non-2xx (e.g. broker restarted, popup id stale) — fall through
        // to window.close() so the popup never gets stuck open.
      } catch {
        /* network error — fall through */
      }
    }
    window.close();
  }, [authHeaders, popupId, controlUrl]);

  const reportPopupEvent = useCallback(
    async (event: PopupEventInput, options?: PopupEventOptions) => {
      if (!popupId || !controlUrl) return;
      try {
        await fetch(`${controlUrl}/v1/popups/${popupId}/event`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(authHeaders ?? {}) },
          body: JSON.stringify({
            ...event,
            complete: options?.complete === true,
            outcome: options?.outcome,
          }),
        });
      } catch {
        /* event reporting should not make the popup unusable */
      }
    },
    [authHeaders, popupId, controlUrl],
  );

  const downloadHtmlSnapshot = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;

    const shell = preview.closest(".lg-shell");
    const frame = preview.closest(".lg-window-frame");
    const shellAttributes = htmlAttributesFor(shell) || 'class="lg-shell"';
    const frameAttributes = htmlAttributesFor(frame) || 'class="lg-window-frame"';
    const styles = readDocumentStyles().replaceAll("</style", "<\\/style");
    const html = `<!doctype html>
<html lang="${escapeAttribute(document.documentElement.lang || "en")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="${escapeAttribute(safeDocumentBaseHref())}">
  <title>${escapeHtml(artifactTitle)}</title>
  <style>
${styles}
  </style>
</head>
<body>
  <div ${shellAttributes}>
    <div class="lg-wallpaper"></div>
    <div class="lg-center">
      <div ${frameAttributes}>
        <div class="lg-glass-window">
          <div class="lg-content h-full">
            <header class="lg-drag flex shrink-0 items-center justify-between gap-3 px-2 pt-1 pb-3">
              <h1 class="lg-title min-w-0 truncate">${escapeHtml(artifactTitle)}</h1>
              <div class="lg-window-drag-grip" aria-hidden="true"></div>
            </header>
            <main class="${escapeAttribute(preview.className)}">
${preview.innerHTML}
            </main>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`;

    const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFilename(artifactTitle || artifactId)}.html`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [artifactId, artifactTitle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void closePopup();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closePopup]);

  useEffect(() => {
    const applyDesignSettings = (detail: unknown) => {
      const next = readLiveDesignSettings(detail);
      if (!next) return;
      setLiveDesignSettings((current) => ({ ...current, ...next }));
    };
    const onDesignSettingsChanged = (event: Event) => {
      applyDesignSettings((event as CustomEvent<unknown>).detail);
    };

    applyDesignSettings(window[POPUP_DESIGN_SETTINGS_GLOBAL]);
    window.addEventListener(POPUP_DESIGN_SETTINGS_EVENT, onDesignSettingsChanged);
    return () => window.removeEventListener(POPUP_DESIGN_SETTINGS_EVENT, onDesignSettingsChanged);
  }, []);

  return (
    <LiquidGlassSurface
      appearanceTheme={liveDesignSettings.appearanceTheme}
      animation={liveDesignSettings.animation}
      themeColor={liveDesignSettings.themeColor}
      visualTheme={liveDesignSettings.visualTheme}
    >
      <div className="lg-content h-full">
        <header className="lg-drag flex shrink-0 items-center justify-between gap-3 px-2 pt-1 pb-3">
          <h1 className="lg-title min-w-0 truncate">{artifactTitle}</h1>
          <div className="lg-window-drag-grip" aria-hidden="true" />
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="lg-icon-button"
              onClick={downloadHtmlSnapshot}
              type="button"
              aria-label="Download HTML"
              title="Download HTML"
            >
              <Download size={16} strokeWidth={1.5} />
            </button>
            <button
              className="lg-icon-button"
              onClick={closePopup}
              type="button"
              aria-label="Close"
              title="Close"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <main ref={previewRef} className="lg-scroll lg-preview flex-1 overflow-auto">
          <GenUIRuntimeDataContext.Provider value={artifactContext ?? null}>
            <PopupEventContext.Provider value={reportPopupEvent}>
              <Renderer response={openuiLang} library={library} />
            </PopupEventContext.Provider>
          </GenUIRuntimeDataContext.Provider>
        </main>
      </div>
    </LiquidGlassSurface>
  );
}
