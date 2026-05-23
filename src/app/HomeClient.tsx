"use client";

import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import { LiquidGlassSurface } from "./_ui/LiquidGlassSurface";

type Artifact = {
  artifactId: string;
  title: string;
  createdAt: string;
};

type HomeClientProps = {
  artifacts: Artifact[];
  controlUrl: string;
};

type GlassPreset = "clear" | "pane" | "milky" | "dense" | "mint" | "sky" | "rose" | "amber";
type LabelInkPreset = "green" | "slate" | "white" | "blue" | "amber" | "red";
type ThemeColorPreset =
  | "tactical"
  | "blue"
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
};
type SettingsResponse = {
  settings: {
    design?: Partial<DesignSettings>;
  };
};

const DESIGN_DEFAULTS: DesignSettings = {
  glassPreset: "milky",
  labelInkPreset: "green",
  themeColorPreset: "tactical",
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

const themeColorOptions: Array<{ value: ThemeColorPreset; label: string }> = [
  { value: "tactical", label: "Tactical" },
  { value: "blue", label: "Blue" },
  { value: "cyan", label: "Cyan" },
  { value: "violet", label: "Violet" },
  { value: "mint", label: "Mint" },
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

export function HomeClient({ artifacts, controlUrl }: HomeClientProps) {
  const count = artifacts.length;
  const [design, setDesign] = useState<DesignSettings>(DESIGN_DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    fetch(`${controlUrl}/v1/settings`)
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
  }, [controlUrl]);

  const saveDesign = async (patch: Partial<DesignSettings>) => {
    const next = { ...design, ...patch };
    const previous = design;
    setDesign(next);
    setError(null);
    if (!controlUrl) return;
    try {
      const res = await fetch(`${controlUrl}/v1/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
  const close = () => window.close();

  return (
    <LiquidGlassSurface themeColor={design.themeColorPreset}>
      <div className="lg-content lg-content-scrollable lg-scroll mx-auto w-full max-w-3xl">
        <section className="lg-glass-card-wrap">
          <div className="lg-card-content flex flex-col gap-5 p-6" data-variant="sunk">
            <header className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                  <span className="lg-label">GenUI Popup Broker</span>
                  <h1 className="lg-title truncate">Artifact Workbench</h1>
                </div>
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
                      <select
                        className="lg-select"
                        value={design.glassPreset}
                        onChange={(e) => saveDesign({ glassPreset: e.target.value as GlassPreset })}
                      >
                        {glassPresetOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="lg-meta-faint">Label ink</span>
                      <select
                        className="lg-select"
                        value={design.labelInkPreset}
                        onChange={(e) => saveDesign({ labelInkPreset: e.target.value as LabelInkPreset })}
                      >
                        {labelInkOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1">
                      <span className="lg-meta-faint">Open animation</span>
                      <select
                        className="lg-select"
                        value={design.windowAnimationPreset}
                        onChange={(e) => saveDesign({ windowAnimationPreset: e.target.value as WindowAnimationPreset })}
                      >
                        {windowAnimationOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
                {error && (
                  <span className="lg-meta-faint" style={{ color: "var(--danger)" }}>
                    {error}
                  </span>
                )}
              </div>

              {artifacts.length === 0 ? (
                <div className="lg-row justify-center">
                  <span className="lg-meta">No artifacts yet.</span>
                </div>
              ) : (
                artifacts.slice(0, 6).map((artifact) => (
                  <a
                    key={artifact.artifactId}
                    className="lg-row"
                    href={`/preview/${artifact.artifactId}`}
                  >
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
                ))
              )}
            </section>
          </div>
        </section>
      </div>
    </LiquidGlassSurface>
  );
}
