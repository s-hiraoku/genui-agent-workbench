"use client";

import "@openuidev/react-ui/components.css";
import "@openuidev/react-ui/styles/index.css";
import "leaflet/dist/leaflet.css";

import { useCallback, useEffect, useMemo, useRef } from "react";
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

const standaloneInteractionScript = String.raw`
(() => {
  const ready = (fn) => {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
      return;
    }
    fn();
  };
  const escapeAttribute = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
  const setText = (root, selector, value) => {
    const node = root.querySelector(selector);
    if (!node) return;
    node.textContent = value || "";
    node.hidden = !value;
  };
  const markSelected = (buttons, selected) => {
    buttons.forEach((button) => {
      const isSelected = button === selected;
      button.toggleAttribute("data-lg-selected", isSelected);
      if (isSelected) button.setAttribute("aria-current", button.getAttribute("aria-current") || "true");
      else button.removeAttribute("aria-current");
    });
  };
  const writeLocalStatus = (target, text) => {
    let status = target.querySelector(":scope > [data-lg-local-status]");
    if (!status) {
      status = document.createElement("p");
      status.dataset.lgLocalStatus = "true";
      status.setAttribute("role", "status");
      target.append(status);
    }
    status.textContent = text;
  };

  ready(() => {
    const style = document.createElement("style");
    style.textContent = ".lg-preview [data-lg-selected=\"true\"] { outline: 2px solid var(--focus-ring, #4aaed0); outline-offset: 2px; }\n"
      + ".lg-preview [data-lg-standalone-clicked=\"true\"] { filter: brightness(1.08); }\n"
      + ".lg-preview [data-lg-local-status] { color: var(--lg-component-text-mid, currentColor); font-size: 12px; margin: 6px 0 0; }";
    document.head.append(style);

    document.querySelectorAll('[role="tablist"]').forEach((tablist) => {
      const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
      const selectTab = (tab) => {
        tabs.forEach((candidate) => {
          const selected = candidate === tab;
          candidate.setAttribute("aria-selected", selected ? "true" : "false");
          candidate.tabIndex = selected ? 0 : -1;
          const panelId = candidate.getAttribute("aria-controls");
          const panel = panelId ? document.getElementById(panelId) : null;
          if (panel) panel.hidden = !selected;
        });
      };
      tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => selectTab(tab));
        tab.addEventListener("keydown", (event) => {
          const offset = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
          if (!offset) return;
          event.preventDefault();
          const next = tabs[(index + offset + tabs.length) % tabs.length];
          selectTab(next);
          next.focus();
        });
      });
      selectTab(tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0]);
    });

    document.querySelectorAll('button[aria-controls][aria-expanded]').forEach((button) => {
      const panel = document.getElementById(button.getAttribute("aria-controls") || "");
      if (!panel) return;
      const sync = (expanded) => {
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
        panel.hidden = !expanded;
      };
      button.addEventListener("click", () => sync(button.getAttribute("aria-expanded") !== "true"));
      sync(button.getAttribute("aria-expanded") === "true");
    });

    document.querySelectorAll('[data-lg-widget="audio-player"]').forEach((root) => {
      const buttons = Array.from(root.querySelectorAll("[data-lg-audio-track]"));
      const audio = root.querySelector("audio");
      const cover = root.querySelector("[data-lg-audio-cover]");
      const selectTrack = (button) => {
        markSelected(buttons, button);
        setText(root, "[data-lg-audio-title]", button.dataset.lgTitle);
        setText(root, "[data-lg-audio-artist]", button.dataset.lgArtist);
        setText(root, "[data-lg-audio-description]", button.dataset.lgDescription);
        if (audio && button.dataset.lgSrc) {
          audio.pause();
          audio.src = button.dataset.lgSrc;
          audio.load();
        }
        if (cover) {
          cover.hidden = !button.dataset.lgCover;
          if (button.dataset.lgCover) cover.setAttribute("src", button.dataset.lgCover);
        }
      };
      buttons.forEach((button) => button.addEventListener("click", () => selectTrack(button)));
    });

    document.querySelectorAll('[data-lg-widget="video-playlist"]').forEach((root) => {
      const buttons = Array.from(root.querySelectorAll("[data-lg-video-item]"));
      const surface = root.querySelector("[data-lg-video-surface]");
      const selectVideo = (button) => {
        markSelected(buttons, button);
        setText(root, "[data-lg-video-title]", button.dataset.lgTitle);
        setText(root, "[data-lg-video-channel]", button.dataset.lgChannel);
        setText(root, "[data-lg-video-description]", button.dataset.lgDescription);
        setText(root, "[data-lg-video-reason]", button.dataset.lgReason);
        if (!surface || !button.dataset.lgEmbedSrc) return;
        const title = escapeAttribute(button.dataset.lgTitle);
        const src = escapeAttribute(button.dataset.lgEmbedSrc);
        if (button.dataset.lgEmbedKind === "iframe") {
          surface.innerHTML = '<iframe title="' + title + '" src="' + src + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="aspect-ratio:16 / 9;border:0;border-radius:8px;display:block;width:100%"></iframe>';
        } else {
          const poster = button.dataset.lgPoster ? ' poster="' + escapeAttribute(button.dataset.lgPoster) + '"' : "";
          surface.innerHTML = '<video controls preload="metadata"' + poster + ' style="aspect-ratio:16 / 9;background:#0a0a0a;border-radius:8px;display:block;width:100%"><source src="' + src + '"></video>';
        }
      };
      buttons.forEach((button) => button.addEventListener("click", () => selectVideo(button)));
    });

    document.querySelectorAll('[data-lg-widget="image-gallery"]').forEach((root) => {
      const buttons = Array.from(root.querySelectorAll("[data-lg-gallery-item]"));
      const image = root.querySelector("[data-lg-gallery-image]");
      const selectImage = (button) => {
        markSelected(buttons, button);
        if (image && button.dataset.lgSrc) {
          image.setAttribute("src", button.dataset.lgSrc);
          image.setAttribute("alt", button.dataset.lgAlt || button.dataset.lgCaption || "");
        }
        setText(root, "[data-lg-gallery-caption]", button.dataset.lgCaption || button.dataset.lgAlt);
      };
      buttons.forEach((button) => button.addEventListener("click", () => selectImage(button)));
    });

    document.querySelectorAll(".lg-preview form").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        writeLocalStatus(form, "入力内容はこのダウンロードHTML内で保持されています。");
      });
    });

    document.querySelectorAll(".lg-preview button").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.closest("[data-lg-widget]") || button.getAttribute("role") === "tab") return;
        button.dataset.lgStandaloneClicked = "true";
        if (!button.hasAttribute("aria-pressed")) button.setAttribute("aria-pressed", "true");
      });
    });
  });
})();
`;

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
    const interactionScript = standaloneInteractionScript.replaceAll("</script", "<\\/script");
    const html = `<!doctype html>
<html lang="${escapeAttribute(document.documentElement.lang || "en")}">
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="light dark">
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
  <script>
${interactionScript}
  </script>
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

  return (
    <LiquidGlassSurface
      appearanceTheme={theme}
      animation={animation}
      themeColor={themeColor}
      visualTheme={visualTheme}
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
