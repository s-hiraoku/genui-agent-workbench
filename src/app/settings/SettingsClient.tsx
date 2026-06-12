"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Database,
  Droplets,
  Gauge,
  Layers,
  Monitor,
  Moon,
  Radar,
  RefreshCcw,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TerminalSquare,
  X,
  Zap,
} from "lucide-react";
import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";
import { NativeSelect } from "@/app/_ui/NativeSelect";

type AppearanceTheme = "auto" | "dark" | "light";
type BrokerSettings = {
  theme: AppearanceTheme;
  launchAtLogin: boolean;
  controlPort: number | null;
  nextPort: number | null;
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
type SettingsState = BrokerSettings & {
  design: DesignSettings;
};

type ApiResponse = {
  settings: BrokerSettings & { design?: Partial<DesignSettings> };
};

const DESIGN_DEFAULTS: DesignSettings = {
  visualThemePreset: "hud",
  glassPreset: "milky",
  labelInkPreset: "green",
  themeColorPreset: "cyan",
  windowAnimationPreset: "center",
};

const DEFAULTS: SettingsState = {
  theme: "dark",
  launchAtLogin: false,
  controlPort: null,
  nextPort: null,
  design: DESIGN_DEFAULTS,
};

const appearanceOptions: Array<{ value: AppearanceTheme; label: string; icon: ReactNode }> = [
  { value: "auto", label: "Auto", icon: <Monitor size={17} strokeWidth={1.7} /> },
  { value: "dark", label: "Dark", icon: <Moon size={17} strokeWidth={1.7} /> },
  { value: "light", label: "Light", icon: <Sun size={17} strokeWidth={1.7} /> },
];

const visualThemeOptions: Array<{ value: VisualThemePreset; label: string; description: string }> = [
  { value: "hud", label: "HUD", description: "Live signal overlay" },
  { value: "workbench", label: "Workbench", description: "Queues and tables" },
  { value: "studio", label: "Studio", description: "Editor console" },
  { value: "briefing", label: "Briefing", description: "Report document" },
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

const windowAnimationOptions: Array<{ value: WindowAnimationPreset; label: string }> = [
  { value: "center", label: "Center" },
  { value: "left", label: "Left reveal" },
  { value: "right", label: "Right reveal" },
  { value: "top", label: "Top reveal" },
  { value: "fade", label: "Fade" },
];

const appearanceValues = new Set<AppearanceTheme>(["auto", "dark", "light"]);
const visualThemeValues = new Set<VisualThemePreset>(["hud", "workbench", "studio", "briefing"]);
const themeColorValues = new Set<ThemeColorPreset>(themeColorOptions.map((option) => option.value));
const windowAnimationValues = new Set<WindowAnimationPreset>(windowAnimationOptions.map((option) => option.value));

function isAppearanceTheme(value: string | undefined): value is AppearanceTheme {
  return appearanceValues.has(value as AppearanceTheme);
}

function isVisualThemePreset(value: string | undefined): value is VisualThemePreset {
  return visualThemeValues.has(value as VisualThemePreset);
}

function isThemeColorPreset(value: string | undefined): value is ThemeColorPreset {
  return themeColorValues.has(value as ThemeColorPreset);
}

function isWindowAnimationPreset(value: string | undefined): value is WindowAnimationPreset {
  return windowAnimationValues.has(value as WindowAnimationPreset);
}

function portValue(n: number | null) {
  return n === null ? "" : String(n);
}

function isPortDraft(raw: string) {
  return /^\d*$/.test(raw.trim());
}

function parsePort(raw: string): number | null | undefined {
  const v = raw.trim();
  if (v === "") return null;
  if (!/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1024 || n > 65535) return undefined;
  return n;
}

export function SettingsClient({
  animation,
  controlToken,
  controlUrl,
  theme,
  themeColor,
  visualTheme,
}: {
  animation?: string;
  controlToken: string;
  controlUrl: string;
  theme?: string;
  themeColor?: string;
  visualTheme?: string;
}) {
  const [settings, setSettings] = useState<SettingsState>(() => ({
    ...DEFAULTS,
    theme: isAppearanceTheme(theme) ? theme : DEFAULTS.theme,
    design: {
      ...DEFAULTS.design,
      themeColorPreset: isThemeColorPreset(themeColor) ? themeColor : DEFAULTS.design.themeColorPreset,
      visualThemePreset: isVisualThemePreset(visualTheme) ? visualTheme : DEFAULTS.design.visualThemePreset,
      windowAnimationPreset: isWindowAnimationPreset(animation) ? animation : DEFAULTS.design.windowAnimationPreset,
    },
  }));
  const [controlPortText, setControlPortText] = useState(() => portValue(DEFAULTS.controlPort));
  const [nextPortText, setNextPortText] = useState(() => portValue(DEFAULTS.nextPort));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveSequence = useRef(0);
  const authHeaders = useMemo(() => (controlToken ? { "x-genui-token": controlToken } : undefined), [controlToken]);
  const canSave = Boolean(controlUrl);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    fetch(`${controlUrl}/v1/settings`, { headers: authHeaders })
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if (cancelled) return;
        const { theme, launchAtLogin, controlPort, nextPort, design } = data.settings;
        const nextSettings = {
          theme,
          launchAtLogin,
          controlPort,
          nextPort,
          design: { ...DESIGN_DEFAULTS, ...design },
        };
        setSettings(nextSettings);
        setControlPortText(portValue(nextSettings.controlPort));
        setNextPortText(portValue(nextSettings.nextPort));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to read settings");
      });
    return () => {
      cancelled = true;
    };
  }, [authHeaders, controlUrl]);

  const save = async (patch: Partial<BrokerSettings> & { design?: Partial<DesignSettings> }) => {
    const saveId = saveSequence.current + 1;
    saveSequence.current = saveId;
    const previous = settings;
    const nextOptimistic = {
      ...settings,
      ...patch,
      design: patch.design ? { ...settings.design, ...patch.design } : settings.design,
    };
    setSettings(nextOptimistic);
    setError(null);
    setStatus("saving");
    if (!canSave) {
      setStatus("idle");
      return;
    }
    try {
      const res = await fetch(`${controlUrl}/v1/settings`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(authHeaders ?? {}) },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status} ${res.statusText}`);
      const data = (await res.json()) as ApiResponse;
      if (saveId !== saveSequence.current) return;
      const { theme, launchAtLogin, controlPort, nextPort, design } = data.settings;
      const nextSettings = {
        theme,
        launchAtLogin,
        controlPort,
        nextPort,
        design: { ...DESIGN_DEFAULTS, ...design },
      };
      setSettings(nextSettings);
      setControlPortText(portValue(nextSettings.controlPort));
      setNextPortText(portValue(nextSettings.nextPort));
      setStatus("saved");
      window.setTimeout(() => {
        if (saveId === saveSequence.current) setStatus("idle");
      }, 1200);
    } catch (e: unknown) {
      if (saveId !== saveSequence.current) return;
      setSettings(previous);
      setControlPortText(portValue(previous.controlPort));
      setNextPortText(portValue(previous.nextPort));
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  const close = () => window.close();
  const savePort = (value: string, key: "controlPort" | "nextPort") => {
    const parsed = parsePort(value);
    if (parsed === undefined) {
      setError("Ports must be empty or a number from 1024 to 65535.");
      if (key === "controlPort") setControlPortText(portValue(settings.controlPort));
      if (key === "nextPort") setNextPortText(portValue(settings.nextPort));
      return;
    }

    if (key === "controlPort") {
      void save({ controlPort: parsed });
      return;
    }
    void save({ nextPort: parsed });
  };

  return (
    <LiquidGlassSurface
      appearanceTheme={settings.theme}
      animation={settings.design.windowAnimationPreset}
      themeColor={settings.design.themeColorPreset}
      visualTheme={settings.design.visualThemePreset}
    >
      <div className="lg-content h-full mx-auto w-full max-w-5xl">
        <section className="lg-glass-card-wrap min-h-0 flex-1">
          <div className="lg-card-content lg-ai-settings" data-variant="sunk">
            <aside className="lg-ai-sidebar lg-drag" aria-label="Broker status">
              <div className="lg-ai-brand-mark" aria-hidden="true">G</div>
              <div className="lg-ai-circuit" aria-hidden="true" />
              <StatusBlock icon={<Zap size={18} strokeWidth={1.6} />} label="Status" value={canSave ? "Online" : "Preview"} />
              <StatusBlock label="v0.3.0" value="Protocol" muted />
              <StatusBlock icon={<Gauge size={19} strokeWidth={1.6} />} label="API" value={canSave ? "Ready" : "Local"} />
              <StatusBlock icon={<ShieldCheck size={18} strokeWidth={1.6} />} label="Secure" value={controlToken ? "Token OK" : "No token"} />
              <StatusBlock icon={<Database size={18} strokeWidth={1.6} />} label="Data" value="Local" />
            </aside>

            <section className="lg-ai-console">
              <header className="lg-ai-console-header lg-drag">
                <div>
                  <h1>Settings</h1>
                  <p>
                    GenUI Popup Broker
                    <span aria-hidden="true" />
                    {canSave ? "Running" : "Preview"}
                  </p>
                </div>
                <button className="lg-icon-button" onClick={close} type="button" aria-label="Close">
                  <X size={20} strokeWidth={1.6} />
                </button>
              </header>

              <main className="lg-scroll lg-ai-settings-main">
                {error && <div className="lg-ai-alert" role="alert">{error}</div>}

                <Panel title="Theme">
                  <FieldLabel>Appearance</FieldLabel>
                  <div className="lg-ai-segmented">
                    {appearanceOptions.map((option) => (
                      <button
                        key={option.value}
                        aria-pressed={settings.theme === option.value}
                        data-selected={settings.theme === option.value}
                        onClick={() => save({ theme: option.value })}
                        type="button"
                      >
                        {option.icon}
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <FieldLabel>Visual style</FieldLabel>
                  <div className="lg-ai-visual-grid">
                    {visualThemeOptions.map((option) => (
                      <button
                        key={option.value}
                        aria-pressed={settings.design.visualThemePreset === option.value}
                        className="lg-ai-visual-card"
                        data-selected={settings.design.visualThemePreset === option.value}
                        data-style={option.value}
                        onClick={() => save({ design: { visualThemePreset: option.value } })}
                        type="button"
                      >
                        <span aria-hidden="true" />
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </button>
                    ))}
                  </div>

                  <FieldLabel>Accent color</FieldLabel>
                  <div className="lg-ai-accent-row" aria-label="Accent color">
                    {themeColorOptions.map((option) => (
                      <button
                        key={option.value}
                        aria-label={option.label}
                        aria-pressed={settings.design.themeColorPreset === option.value}
                        className="lg-ai-swatch"
                        data-color={option.value}
                        data-selected={settings.design.themeColorPreset === option.value}
                        onClick={() => save({ design: { themeColorPreset: option.value } })}
                        title={option.label}
                        type="button"
                      >
                        <span aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </Panel>

                <Panel title="Appearance (Advanced)">
                  <div className="lg-ai-control-grid" data-columns="3">
                    <SelectField icon={<SlidersHorizontal size={16} />} label="Glass preset" options={glassPresetOptions} value={settings.design.glassPreset} onChange={(value) => save({ design: { glassPreset: value as GlassPreset } })} />
                    <SelectField icon={<Droplets size={16} />} label="Label ink" options={labelInkOptions} value={settings.design.labelInkPreset} onChange={(value) => save({ design: { labelInkPreset: value as LabelInkPreset } })} />
                    <SelectField icon={<Radar size={16} />} label="Open animation" options={windowAnimationOptions} value={settings.design.windowAnimationPreset} onChange={(value) => save({ design: { windowAnimationPreset: value as WindowAnimationPreset } })} />
                  </div>
                </Panel>

                <Panel title="System">
                  <SystemRow icon={<Rocket size={18} />} label="Launch at login" hint="Start the broker automatically when you log in">
                    <Switch ariaLabel="Launch at login" checked={settings.launchAtLogin} disabled={!canSave} onClick={() => save({ launchAtLogin: !settings.launchAtLogin })} />
                  </SystemRow>
                  <SystemRow icon={<TerminalSquare size={18} />} label="Control API port" hint="Port for local control API">
                    <PortInput
                      ariaLabel="Control API port"
                      value={controlPortText}
                      onBlur={(value) => savePort(value, "controlPort")}
                      onChange={(value) => {
                        if (isPortDraft(value)) {
                          setControlPortText(value);
                          setError(null);
                          return;
                        }
                        setControlPortText(value);
                        setError("Ports must contain digits only.");
                      }}
                    />
                  </SystemRow>
                  <SystemRow icon={<Layers size={18} />} label="Next popup port" hint="Starting port for popup windows">
                    <PortInput
                      ariaLabel="Next popup port"
                      value={nextPortText}
                      onBlur={(value) => savePort(value, "nextPort")}
                      onChange={(value) => {
                        if (isPortDraft(value)) {
                          setNextPortText(value);
                          setError(null);
                          return;
                        }
                        setNextPortText(value);
                        setError("Ports must contain digits only.");
                      }}
                    />
                  </SystemRow>
                </Panel>

                <div className="lg-ai-action-bar">
                  <button
                    className="lg-ai-secondary-action"
                    onClick={() => save({ theme: DEFAULTS.theme, design: DESIGN_DEFAULTS })}
                    type="button"
                  >
                    <RefreshCcw size={17} strokeWidth={1.7} />
                    Reset to defaults
                  </button>
                  <button className="lg-ai-primary-action" onClick={() => save({})} type="button">
                    <Check size={18} strokeWidth={1.9} />
                    {status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Save changes"}
                  </button>
                </div>
              </main>
            </section>
          </div>
        </section>
      </div>
    </LiquidGlassSurface>
  );
}

function StatusBlock({ icon, label, muted, value }: { icon?: ReactNode; label: string; muted?: boolean; value: string }) {
  return (
    <div className="lg-ai-status-block" data-muted={muted}>
      {icon && <span aria-hidden="true">{icon}</span>}
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="lg-ai-panel">
      <h2>{title}</h2>
      <div className="lg-ai-panel-body">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="lg-ai-field-label">{children}</span>;
}

function SelectField({
  icon,
  label,
  onChange,
  options,
  value,
}: {
  icon: ReactNode;
  label: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <label className="lg-ai-select-field">
      <span>{label}</span>
      <span className="lg-ai-select-shell">
        <span aria-hidden="true">{icon}</span>
        <NativeSelect ariaLabel={label} options={options} value={value} onValueChange={onChange} />
      </span>
    </label>
  );
}

function SystemRow({ children, hint, icon, label }: { children: ReactNode; hint: string; icon: ReactNode; label: string }) {
  return (
    <div className="lg-ai-system-row">
      <span aria-hidden="true">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{hint}</small>
      </span>
      {children}
    </div>
  );
}

function Switch({
  ariaLabel,
  checked,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return <button aria-label={ariaLabel} aria-pressed={checked} className="lg-switch" data-on={checked} disabled={disabled} onClick={onClick} type="button" />;
}

function PortInput({
  ariaLabel,
  onBlur,
  onChange,
  value,
}: {
  ariaLabel: string;
  onBlur: (value: string) => void;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="lg-ai-port-input"
      inputMode="numeric"
      onBlur={(event) => onBlur(event.currentTarget.value)}
      onChange={(event) => onChange(event.currentTarget.value)}
      placeholder="auto"
      value={value}
      data-mono
    />
  );
}
