"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Eye, RotateCcw, Square, Trash2, X } from "lucide-react";
import { LiquidGlassSurface } from "./_ui/LiquidGlassSurface";
import { NativeSelect } from "./_ui/NativeSelect";

type Artifact = {
  artifactId: string;
  agentId?: string;
  title: string;
  openuiLang: string;
  createdAt: string;
  generationMode: string;
  locale: string;
  context?: Record<string, unknown>;
};

type Popup = {
  popupId: string;
  artifactId: string;
  agentId?: string;
  title: string;
  status: string;
  previewUrl: string;
  createdAt: string;
  closedAt?: string;
};

type HomeClientProps = {
  artifacts: Artifact[];
  controlUrl: string;
  controlToken: string;
};

type GlassPreset = "clear" | "pane" | "milky" | "dense" | "mint" | "sky" | "rose" | "amber";
type LabelInkPreset = "green" | "slate" | "white" | "blue" | "amber" | "red";
type VisualThemePreset = "hud" | "workbench" | "studio" | "briefing";
type ThemeColorPreset =
  | "blue"
  | "azure"
  | "cyan"
  | "violet"
  | "mint"
  | "rose"
  | "amber"
  | "white"
  | "midnight"
  | "forest"
  | "crimson"
  | "graphite";
type WindowAnimationPreset = "center" | "left" | "right" | "top" | "fade";
type DesignSettings = {
  visualThemePreset: VisualThemePreset;
  glassPreset: GlassPreset;
  labelInkPreset: LabelInkPreset;
  themeColorPreset: ThemeColorPreset;
  windowAnimationPreset: WindowAnimationPreset;
};
type SettingsResponse = {
  settings: {
    design?: Partial<DesignSettings>;
  };
};
type PopupsResponse = {
  popups?: Popup[];
};
type ReplayResponse = Popup;

const DESIGN_DEFAULTS: DesignSettings = {
  visualThemePreset: "hud",
  glassPreset: "milky",
  labelInkPreset: "green",
  themeColorPreset: "mint",
  windowAnimationPreset: "center",
};

const glassPresetOptions: Array<{ value: GlassPreset; label: string }> = [
  { value: "clear", label: "Clear" },
  { value: "pane", label: "Pane" },
  { value: "milky", label: "Milky" },
  { value: "dense", label: "Dense" },
  { value: "mint", label: "Mint" },
  { value: "sky", label: "Sky" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
];

const labelInkOptions: Array<{ value: LabelInkPreset; label: string }> = [
  { value: "green", label: "Green" },
  { value: "slate", label: "Slate" },
  { value: "white", label: "White" },
  { value: "blue", label: "Blue" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
];

const visualThemeOptions: Array<{ value: VisualThemePreset; label: string; description: string }> = [
  { value: "hud", label: "HUD Glass", description: "Holographic overlay for live agent signals" },
  { value: "workbench", label: "Workbench", description: "Operations grid for queues, tables, and status" },
  { value: "studio", label: "Studio", description: "Editor console for review, media, and creation" },
  { value: "briefing", label: "Briefing", description: "Report document for decisions and summaries" },
];

const themeColorOptions: Array<{ value: ThemeColorPreset; label: string }> = [
  { value: "blue", label: "Blue" },
  { value: "azure", label: "Bright Blue" },
  { value: "cyan", label: "Cyan" },
  { value: "violet", label: "Violet" },
  { value: "mint", label: "Tactical" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" },
  { value: "white", label: "White" },
  { value: "midnight", label: "Midnight" },
  { value: "forest", label: "Forest" },
  { value: "crimson", label: "Crimson" },
  { value: "graphite", label: "Graphite" },
];

const windowAnimationOptions: Array<{ value: WindowAnimationPreset; label: string }> = [
  { value: "center", label: "Center" },
  { value: "left", label: "Left reveal" },
  { value: "right", label: "Right reveal" },
  { value: "top", label: "Top reveal" },
  { value: "fade", label: "Fade" },
];

const artifactDateFormatter = new Intl.DateTimeFormat("ja-JP", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tokyo",
});

function metadataValue(value: string | undefined): string {
  return value && value.trim().length > 0 ? value : "unknown";
}

function jsonPreview(value: unknown): string {
  if (value === undefined) return "{}";
  return JSON.stringify(value, null, 2);
}

function isLivePopup(popup: Popup): boolean {
  return popup.status === "opening" || popup.status === "open";
}

export function HomeClient({ artifacts, controlUrl, controlToken }: HomeClientProps) {
  const [visibleArtifacts, setVisibleArtifacts] = useState(artifacts);
  const [selectedArtifactId, setSelectedArtifactId] = useState(artifacts[0]?.artifactId ?? "");
  const [popups, setPopups] = useState<Popup[]>([]);
  const [design, setDesign] = useState<DesignSettings>(DESIGN_DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const count = visibleArtifacts.length;
  const activePopups = popups.filter(isLivePopup);
  const selectedArtifact =
    visibleArtifacts.find((artifact) => artifact.artifactId === selectedArtifactId) ?? visibleArtifacts[0];
  const authHeaders = useMemo(() => (controlToken ? { "x-genui-token": controlToken } : undefined), [controlToken]);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    fetch(`${controlUrl}/v1/settings`, { headers: authHeaders })
      .then((r) => r.json() as Promise<SettingsResponse>)
      .then((data) => {
        if (cancelled) return;
        setDesign({ ...DESIGN_DEFAULTS, ...data.settings.design });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to read design settings");
      });
    return () => {
      cancelled = true;
    };
  }, [authHeaders, controlUrl]);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    const refreshPopups = async () => {
      try {
        const res = await fetch(`${controlUrl}/v1/popups`, { headers: authHeaders });
        if (!res.ok) throw new Error(`Popup refresh failed: ${res.status} ${res.statusText}`);
        const data = (await res.json()) as PopupsResponse;
        if (!cancelled) setPopups(data.popups ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to read popups");
      }
    };
    void refreshPopups();
    const intervalId = window.setInterval(refreshPopups, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [authHeaders, controlUrl]);

  const saveDesign = async (patch: Partial<DesignSettings>) => {
    const next = { ...design, ...patch };
    const previous = design;
    setDesign(next);
    setError(null);
    setMessage(null);
    if (!controlUrl) return;
    try {
      const res = await fetch(`${controlUrl}/v1/settings`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(authHeaders ?? {}) },
        body: JSON.stringify({ design: next }),
      });
      if (!res.ok) {
        throw new Error(`Save failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as SettingsResponse;
      setDesign({ ...DESIGN_DEFAULTS, ...data.settings.design });
      setMessage("Design defaults saved");
    } catch (e: unknown) {
      setDesign(previous);
      setError(e instanceof Error ? e.message : "Failed to save design settings");
    }
  };

  const deleteArtifact = async (artifactId: string) => {
    const previous = visibleArtifacts;
    setBusyId(artifactId);
    setVisibleArtifacts((items) => items.filter((item) => item.artifactId !== artifactId));
    setError(null);
    setMessage(null);
    if (!controlUrl) return;
    try {
      const res = await fetch(`${controlUrl}/v1/artifacts/${artifactId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
      }
      setMessage("Artifact deleted");
    } catch (e: unknown) {
      setVisibleArtifacts(previous);
      setError(e instanceof Error ? e.message : "Failed to delete artifact");
    } finally {
      setBusyId(null);
    }
  };

  const replayArtifact = async (artifact: Artifact) => {
    setBusyId(artifact.artifactId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${controlUrl}/v1/artifacts/${artifact.artifactId}/replay`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(authHeaders ?? {}) },
        body: JSON.stringify({ title: artifact.title, agentId: artifact.agentId }),
      });
      if (!res.ok) throw new Error(`Replay failed: ${res.status} ${res.statusText}`);
      const replayed = (await res.json()) as ReplayResponse;
      setPopups((items) => [replayed, ...items.filter((item) => item.popupId !== replayed.popupId)]);
      setMessage(`Replayed ${artifact.title}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to replay artifact");
    } finally {
      setBusyId(null);
    }
  };

  const closePopup = async (popup: Popup) => {
    setBusyId(popup.popupId);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`${controlUrl}/v1/popups/${encodeURIComponent(popup.popupId)}/close`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Close failed: ${res.status} ${res.statusText}`);
      const closed = (await res.json()) as Popup;
      setPopups((items) => items.map((item) => (item.popupId === closed.popupId ? closed : item)));
      setMessage(`Closed ${popup.title}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to close popup");
    } finally {
      setBusyId(null);
    }
  };

  const closeAllPopups = async () => {
    const targets = activePopups;
    if (targets.length === 0) return;
    setBusyId("active-popups");
    setError(null);
    setMessage(null);
    try {
      const closed = await Promise.all(
        targets.map(async (popup) => {
          const res = await fetch(`${controlUrl}/v1/popups/${encodeURIComponent(popup.popupId)}/close`, {
            method: "POST",
            headers: authHeaders,
          });
          if (!res.ok) throw new Error(`Close failed: ${res.status} ${res.statusText}`);
          return (await res.json()) as Popup;
        }),
      );
      setPopups((items) =>
        items.map((item) => closed.find((popup) => popup.popupId === item.popupId) ?? item),
      );
      setMessage(`Closed ${closed.length} active popup${closed.length === 1 ? "" : "s"}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to close active popups");
    } finally {
      setBusyId(null);
    }
  };

  const close = () => window.close();

  return (
    <LiquidGlassSurface
      animation={design.windowAnimationPreset}
      themeColor={design.themeColorPreset}
      visualTheme={design.visualThemePreset}
    >
      <div className="lg-content h-full mx-auto w-full max-w-5xl">
        <section className="lg-glass-card-wrap min-h-0 flex-1">
          <div className="lg-card-content flex h-full min-h-0 flex-col gap-5 p-6" data-variant="sunk">
            <header className="flex shrink-0 flex-col gap-4">
              <div className="lg-drag flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="lg-label">GenUI Popup Broker</span>
                  <h1 className="lg-title truncate">Artifact Workbench</h1>
                </div>
                <div className="lg-window-drag-grip hidden sm:block" aria-hidden="true" />
                <div className="flex w-full shrink-0 items-start justify-between gap-3 sm:w-auto sm:justify-start">
                  <div className="rounded-[18px] border border-white/45 bg-white/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                    <div className="lg-display">{count}</div>
                    <div className="lg-meta">artifact{count === 1 ? "" : "s"}</div>
                  </div>
                  <div className="rounded-[18px] border border-white/45 bg-white/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                    <div className="lg-display">{activePopups.length}</div>
                    <div className="lg-meta">active</div>
                  </div>
                  <button className="lg-icon-button" onClick={close} type="button" aria-label="Close">
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <p className="lg-meta max-w-xl">
                Inspect saved OpenUI Lang, replay prior artifacts, and close active local popups.
              </p>
            </header>

            <main className="lg-scroll min-h-0 flex-1 overflow-auto">
              <div className="flex min-w-0 flex-col gap-5">
            {(error || message) && (
              <div className="lg-row">
                <span className="lg-meta-faint" style={{ color: error ? "var(--danger)" : "var(--ink-mid)" }}>
                  {error ?? message}
                </span>
              </div>
            )}

            <section className="flex flex-col gap-2">
              <div className="lg-row flex-col gap-3" style={{ alignItems: "stretch" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="lg-label">Design Defaults</span>
                    <span className="lg-meta-faint">Applies to newly generated Liquid Glass popups.</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="lg-meta-faint">Popup visual theme</span>
                    <div className="lg-visual-theme-grid" aria-label="Popup visual theme">
                      {visualThemeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="lg-visual-theme-card"
                          data-visual-theme-option={option.value}
                          data-selected={design.visualThemePreset === option.value}
                          aria-pressed={design.visualThemePreset === option.value}
                          onClick={() => saveDesign({ visualThemePreset: option.value })}
                        >
                          <span className="lg-visual-theme-preview" aria-hidden="true" />
                          <span className="min-w-0">
                            <span>{option.label}</span>
                            <span>{option.description}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="lg-meta-faint">Theme color preset</span>
                    <div className="lg-theme-swatch-grid" aria-label="Theme color preset">
                      {themeColorOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className="lg-theme-swatch"
                          data-color={option.value}
                          data-selected={design.themeColorPreset === option.value}
                          aria-pressed={design.themeColorPreset === option.value}
                          onClick={() => saveDesign({ themeColorPreset: option.value })}
                        >
                          <span className="lg-theme-swatch-mark" aria-hidden="true" />
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="lg-meta-faint">Glass preset</span>
                      <NativeSelect
                        ariaLabel="Glass preset"
                        options={glassPresetOptions}
                        value={design.glassPreset}
                        onValueChange={(value) => saveDesign({ glassPreset: value as GlassPreset })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="lg-meta-faint">Label ink</span>
                      <NativeSelect
                        ariaLabel="Label ink"
                        options={labelInkOptions}
                        value={design.labelInkPreset}
                        onValueChange={(value) => saveDesign({ labelInkPreset: value as LabelInkPreset })}
                      />
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="lg-meta-faint">Open animation</span>
                      <NativeSelect
                        ariaLabel="Window animation"
                        options={windowAnimationOptions}
                        value={design.windowAnimationPreset}
                        onValueChange={(value) =>
                          saveDesign({ windowAnimationPreset: value as WindowAnimationPreset })
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex items-end justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="lg-label">Artifacts</span>
                    <span className="lg-meta-faint">Newest saved OpenUI Lang artifacts</span>
                  </div>
                </div>
                {visibleArtifacts.length === 0 ? (
                  <div className="lg-row justify-center">
                    <span className="lg-meta">No artifacts yet.</span>
                  </div>
                ) : (
                  visibleArtifacts.map((artifact) => (
                    <div key={artifact.artifactId} className="lg-row" data-selected={selectedArtifact?.artifactId === artifact.artifactId}>
                      <button
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                        onClick={() => setSelectedArtifactId(artifact.artifactId)}
                        type="button"
                      >
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-[15px] font-medium text-[color:var(--ink)]">
                            {artifact.title}
                          </span>
                          <span className="lg-meta-faint" data-mono>
                            {artifactDateFormatter.format(new Date(artifact.createdAt))} - {metadataValue(artifact.agentId)}
                          </span>
                        </div>
                        <ChevronRight size={18} strokeWidth={1.5} className="shrink-0 text-[color:var(--ink-mid)]" />
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <a
                          aria-label={`Preview ${artifact.title}`}
                          className="lg-icon-button"
                          href={`/preview/${artifact.artifactId}`}
                          title="Preview artifact"
                        >
                          <Eye size={15} strokeWidth={1.5} />
                        </a>
                        <button
                          aria-label={`Replay ${artifact.title}`}
                          className="lg-icon-button"
                          disabled={!controlUrl || busyId === artifact.artifactId}
                          onClick={() => replayArtifact(artifact)}
                          title="Replay artifact"
                          type="button"
                        >
                          <RotateCcw size={15} strokeWidth={1.5} />
                        </button>
                        <button
                          aria-label={`Delete ${artifact.title}`}
                          className="lg-icon-button"
                          disabled={!controlUrl || busyId === artifact.artifactId}
                          onClick={() => deleteArtifact(artifact.artifactId)}
                          title="Delete artifact"
                          type="button"
                        >
                          <Trash2 size={15} strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="lg-label">Active Popups</span>
                      <span className="lg-meta-faint">
                        {activePopups.length} active / {popups.length} known runtime windows
                      </span>
                    </div>
                    <button
                      aria-label="Close all active popups"
                      className="lg-icon-button"
                      disabled={!controlUrl || activePopups.length === 0 || busyId === "active-popups"}
                      onClick={closeAllPopups}
                      title="Close all active popups"
                      type="button"
                    >
                      <Square size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                  {activePopups.length === 0 ? (
                    <div className="lg-row">
                      <span className="lg-meta">No active popups.</span>
                    </div>
                  ) : (
                    activePopups.map((popup) => (
                      <div key={popup.popupId} className="lg-row">
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="truncate text-[15px] font-medium text-[color:var(--ink)]">
                            {popup.title}
                          </span>
                          <span className="lg-meta-faint" data-mono>
                            {popup.status} - {popup.popupId}
                          </span>
                        </div>
                        <button
                          aria-label={`Close ${popup.title}`}
                          className="lg-icon-button"
                          disabled={!controlUrl || busyId === popup.popupId}
                          onClick={() => closePopup(popup)}
                          title="Close popup"
                          type="button"
                        >
                          <Square size={14} strokeWidth={1.5} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {selectedArtifact && (
                  <div className="lg-row flex-col gap-3" style={{ alignItems: "stretch" }}>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="lg-label">Inspect Artifact</span>
                        <span className="truncate text-[17px] font-semibold text-[color:var(--ink)]">
                          {selectedArtifact.title}
                        </span>
                      </div>
                      <button
                        aria-label={`Replay ${selectedArtifact.title}`}
                        className="lg-icon-button"
                        disabled={!controlUrl || busyId === selectedArtifact.artifactId}
                        onClick={() => replayArtifact(selectedArtifact)}
                        title="Replay artifact"
                        type="button"
                      >
                        <RotateCcw size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <span className="lg-meta-faint" data-mono>
                        artifact: {selectedArtifact.artifactId}
                      </span>
                      <span className="lg-meta-faint" data-mono>
                        agent: {metadataValue(selectedArtifact.agentId)}
                      </span>
                      <span className="lg-meta-faint" data-mono>
                        mode: {selectedArtifact.generationMode}
                      </span>
                      <span className="lg-meta-faint" data-mono>
                        locale: {selectedArtifact.locale}
                      </span>
                    </div>
                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="lg-meta-faint">Context</span>
                        <pre className="lg-code-pane lg-scroll">{jsonPreview(selectedArtifact.context)}</pre>
                      </div>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="lg-meta-faint">OpenUI Lang</span>
                        <pre className="lg-code-pane lg-scroll">{selectedArtifact.openuiLang}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
              </div>
            </main>
          </div>
        </section>
      </div>
    </LiquidGlassSurface>
  );
}
