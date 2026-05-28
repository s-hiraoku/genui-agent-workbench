"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Trash2, X } from "lucide-react";
import { LiquidGlassSurface } from "./_ui/LiquidGlassSurface";
import { NativeSelect } from "./_ui/NativeSelect";

type Artifact = {
  artifactId: string;
  title: string;
  createdAt: string;
};

type HomeClientProps = {
  artifacts: Artifact[];
  controlUrl: string;
  controlToken: string;
};

type GlassPreset = "clear" | "pane" | "milky" | "dense" | "mint" | "sky" | "rose" | "amber";
type LabelInkPreset = "green" | "slate" | "white" | "blue" | "amber" | "red";
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
  glassPreset: GlassPreset;
  labelInkPreset: LabelInkPreset;
  themeColorPreset: ThemeColorPreset;
  windowAnimationPreset: WindowAnimationPreset;
  opaque: boolean;
};
type SettingsResponse = {
  settings: {
    design?: Partial<DesignSettings>;
  };
};

const DESIGN_DEFAULTS: DesignSettings = {
  glassPreset: "milky",
  labelInkPreset: "green",
  themeColorPreset: "mint",
  windowAnimationPreset: "center",
  opaque: false,
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

export function HomeClient({ artifacts, controlUrl, controlToken }: HomeClientProps) {
  const [visibleArtifacts, setVisibleArtifacts] = useState(artifacts);
  const count = visibleArtifacts.length;
  const [design, setDesign] = useState<DesignSettings>(DESIGN_DEFAULTS);
  const [error, setError] = useState<string | null>(null);
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

  const saveDesign = async (patch: Partial<DesignSettings>) => {
    const next = { ...design, ...patch };
    const previous = design;
    setDesign(next);
    setError(null);
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
    } catch (e: unknown) {
      setDesign(previous);
      setError(e instanceof Error ? e.message : "Failed to save design settings");
    }
  };
  const deleteArtifact = async (artifactId: string) => {
    const previous = visibleArtifacts;
    setVisibleArtifacts((items) => items.filter((item) => item.artifactId !== artifactId));
    setError(null);
    if (!controlUrl) return;
    try {
      const res = await fetch(`${controlUrl}/v1/artifacts/${artifactId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
      }
    } catch (e: unknown) {
      setVisibleArtifacts(previous);
      setError(e instanceof Error ? e.message : "Failed to delete artifact");
    }
  };
  const close = () => window.close();

  return (
    <LiquidGlassSurface opaque={design.opaque} themeColor={design.themeColorPreset}>
      <div className="lg-content lg-content-scrollable lg-scroll mx-auto w-full max-w-3xl">
        <section className="lg-glass-card-wrap">
          <div className="lg-card-content flex flex-col gap-5 p-6" data-variant="sunk">
            <header className="flex flex-col gap-4">
              <div className="lg-drag flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="lg-label">GenUI Popup Broker</span>
                  <h1 className="lg-title truncate">Artifact Workbench</h1>
                </div>
                <div className="lg-window-drag-grip" aria-hidden="true" />
                <div className="flex shrink-0 items-start gap-3">
                  <div className="rounded-[18px] border border-white/45 bg-white/20 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl">
                    <div className="lg-display">{count}</div>
                    <div className="lg-meta">
                      artifact{count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <button
                    className="lg-icon-button"
                    onClick={close}
                    type="button"
                    aria-label="Close"
                  >
                    <X size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <p className="lg-meta max-w-xl">
                A resident broker that opens agent-generated UI as local popups.
              </p>
            </header>

            <section className="flex flex-col gap-2">
              <div className="lg-row flex-col gap-3" style={{ alignItems: "stretch" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="lg-label">Design Defaults</span>
                    <span className="lg-meta-faint">
                      Applies to newly generated Liquid Glass popups.
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
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
                        onValueChange={(value) => saveDesign({ windowAnimationPreset: value as WindowAnimationPreset })}
                      />
                    </label>
                  </div>
                  <label className="lg-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="lg-label">Default opacity</span>
                      <span className="lg-meta-faint">Open new popups in opaque mode by default</span>
                    </span>
                    <button
                      aria-pressed={design.opaque}
                      className="lg-switch"
                      data-on={design.opaque}
                      onClick={() => saveDesign({ opaque: !design.opaque })}
                      type="button"
                    />
                  </label>
                </div>
                {error && (
                  <span className="lg-meta-faint" style={{ color: "var(--danger)" }}>
                    {error}
                  </span>
                )}
              </div>

              {visibleArtifacts.length === 0 ? (
                <div className="lg-row justify-center">
                  <span className="lg-meta">No artifacts yet.</span>
                </div>
              ) : (
                visibleArtifacts.slice(0, 6).map((artifact) => (
                  <div
                    key={artifact.artifactId}
                    className="lg-row"
                  >
                    <a className="flex min-w-0 flex-1 items-center justify-between gap-3" href={`/preview/${artifact.artifactId}`}>
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-[15px] font-medium text-[color:var(--ink)]">
                          {artifact.title}
                        </span>
                        <span className="lg-meta-faint" data-mono>
                          {artifactDateFormatter.format(new Date(artifact.createdAt))}
                        </span>
                      </div>
                      <ChevronRight
                        size={18}
                        strokeWidth={1.5}
                        className="shrink-0 text-[color:var(--ink-mid)]"
                      />
                    </a>
                    <button
                      aria-label={`Delete ${artifact.title}`}
                      className="lg-icon-button"
                      disabled={!controlUrl}
                      onClick={() => deleteArtifact(artifact.artifactId)}
                      title="Delete artifact"
                      type="button"
                    >
                      <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                  </div>
                ))
              )}
            </section>
          </div>
        </section>
      </div>
    </LiquidGlassSurface>
  );
}
