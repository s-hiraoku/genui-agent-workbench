"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";
import { NativeSelect } from "@/app/_ui/NativeSelect";

type BrokerSettings = {
  launchAtLogin: boolean;
  controlPort: number | null;
  nextPort: number | null;
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
};
type SettingsState = BrokerSettings & {
  design: DesignSettings;
};

type ApiResponse = {
  settings: BrokerSettings & { design?: Partial<DesignSettings>; theme?: string };
};

const DESIGN_DEFAULTS: DesignSettings = {
  glassPreset: "milky",
  labelInkPreset: "green",
  themeColorPreset: "mint",
  windowAnimationPreset: "center",
};

const DEFAULTS: SettingsState = {
  launchAtLogin: false,
  controlPort: null,
  nextPort: null,
  design: DESIGN_DEFAULTS,
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

export function SettingsClient({ animation, controlUrl, themeColor }: { animation?: string; controlUrl: string; themeColor?: string }) {
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);
  const [opaque, setOpaque] = useState(false);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    fetch(`${controlUrl}/v1/settings`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if (cancelled) return;
        const { launchAtLogin, controlPort, nextPort, design } = data.settings;
        setSettings({
          launchAtLogin,
          controlPort,
          nextPort,
          design: { ...DESIGN_DEFAULTS, ...design },
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to read settings");
      });
    return () => {
      cancelled = true;
    };
  }, [controlUrl]);

  const save = async (patch: Partial<BrokerSettings> & { design?: Partial<DesignSettings> }) => {
    const previous = settings;
    setSettings((s) => ({
      ...s,
      ...patch,
      design: patch.design ? { ...s.design, ...patch.design } : s.design,
    }));
    setError(null);
    try {
      const res = await fetch(`${controlUrl}/v1/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        throw new Error(`Save failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as ApiResponse;
      const { launchAtLogin, controlPort, nextPort, design } = data.settings;
      setSettings({
        launchAtLogin,
        controlPort,
        nextPort,
        design: { ...DESIGN_DEFAULTS, ...design },
      });
    } catch (e: unknown) {
      // Roll back the optimistic update so the UI matches what the
      // broker actually persisted.
      setSettings(previous);
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  const close = () => window.close();
  const portValue = (n: number | null) => (n === null ? "" : String(n));

  // Parse a port input. Returns:
  //   null      → empty (reset to auto)
  //   number    → valid TCP port in [1, 65535]
  //   undefined → invalid input; the caller should skip the save
  const parsePort = (raw: string): number | null | undefined => {
    const v = raw.trim();
    if (v === "") return null;
    if (!/^\d+$/.test(v)) return undefined;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 65535) return undefined;
    return n;
  };

  return (
    <LiquidGlassSurface
      animation={settings.design.windowAnimationPreset ?? animation}
      opaque={opaque}
      themeColor={settings.design.themeColorPreset ?? themeColor}
    >
      <div className="lg-content h-full mx-auto w-full max-w-lg">
        <section className="lg-glass-card-wrap min-h-0 flex-1">
          <div className="lg-card-content flex h-full min-h-0 flex-col gap-4 p-5" data-variant="sunk">
            <header className="lg-drag flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="lg-label">Broker</span>
                <h1 className="lg-title truncate">Settings</h1>
              </div>
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
                  onClick={close}
                  type="button"
                  aria-label="Close"
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            </header>

            <nav className="lg-menu-bar" aria-label="Broker menu">
              <Link className="lg-menu-link" href="/">
                Workbench
              </Link>
              <span className="lg-menu-link" data-active="true">
                Settings
              </span>
            </nav>

            <main className="lg-scroll min-h-0 flex-1 overflow-auto">
              <div className="flex flex-col gap-2">
                <div className="lg-row flex-col gap-3" style={{ alignItems: "stretch" }}>
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="lg-label">Design Defaults</span>
                    <span className="lg-meta-faint">Theme and glass presets for newly generated popups</span>
                  </span>
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
                            data-selected={settings.design.themeColorPreset === option.value}
                            aria-pressed={settings.design.themeColorPreset === option.value}
                            onClick={() => save({ design: { themeColorPreset: option.value } })}
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
                          value={settings.design.glassPreset}
                          onValueChange={(value) => save({ design: { glassPreset: value as GlassPreset } })}
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1">
                        <span className="lg-meta-faint">Label ink</span>
                        <NativeSelect
                          ariaLabel="Label ink"
                          options={labelInkOptions}
                          value={settings.design.labelInkPreset}
                          onValueChange={(value) => save({ design: { labelInkPreset: value as LabelInkPreset } })}
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1">
                        <span className="lg-meta-faint">Open animation</span>
                        <NativeSelect
                          ariaLabel="Window animation"
                          options={windowAnimationOptions}
                          value={settings.design.windowAnimationPreset}
                          onValueChange={(value) => save({ design: { windowAnimationPreset: value as WindowAnimationPreset } })}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <Field label="Launch at login" hint="Start broker silently">
                  <button
                    aria-pressed={settings.launchAtLogin}
                    className="lg-switch"
                    data-on={settings.launchAtLogin}
                    onClick={() => save({ launchAtLogin: !settings.launchAtLogin })}
                    type="button"
                  />
                </Field>

                <Field label="Control API port" hint="Empty = auto">
                  <input
                    className="lg-input"
                    inputMode="numeric"
                    onChange={(e) => {
                      const parsed = parsePort(e.target.value);
                      if (parsed === undefined) return;
                      setSettings((s) => ({ ...s, controlPort: parsed }));
                    }}
                    onBlur={(e) => {
                      const parsed = parsePort(e.target.value);
                      if (parsed === undefined) return;
                      save({ controlPort: parsed });
                    }}
                    placeholder="auto"
                    value={portValue(settings.controlPort)}
                    data-mono
                  />
                </Field>

                <Field label="Next.js port" hint="Empty = auto">
                  <input
                    className="lg-input"
                    inputMode="numeric"
                    onChange={(e) => {
                      const parsed = parsePort(e.target.value);
                      if (parsed === undefined) return;
                      setSettings((s) => ({ ...s, nextPort: parsed }));
                    }}
                    onBlur={(e) => {
                      const parsed = parsePort(e.target.value);
                      if (parsed === undefined) return;
                      save({ nextPort: parsed });
                    }}
                    placeholder="auto"
                    value={portValue(settings.nextPort)}
                    data-mono
                  />
                </Field>

                {error && (
                  <p className="lg-meta" style={{ color: "var(--danger)" }}>
                    {error}
                  </p>
                )}
              </div>
            </main>
          </div>
        </section>
      </div>
    </LiquidGlassSurface>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="lg-row lg-field">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="lg-label">{label}</span>
        {hint && <span className="lg-meta-faint">{hint}</span>}
      </span>
      <span className="lg-field-control">{children}</span>
    </label>
  );
}
