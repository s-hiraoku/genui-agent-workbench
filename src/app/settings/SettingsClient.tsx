"use client";

import { useEffect, useState } from "react";
import { useFrameIntro } from "@/app/useFrameIntro";

type Theme = "auto" | "dark" | "light";

type BrokerSettings = {
  theme: Theme;
  launchAtLogin: boolean;
  controlPort: number | null;
  nextPort: number | null;
};

type SettingsResponse = {
  settings: BrokerSettings;
  themeResolved: "dark" | "light";
};

const DEFAULTS: BrokerSettings = {
  theme: "auto",
  launchAtLogin: false,
  controlPort: null,
  nextPort: null,
};

export function SettingsClient({ controlUrl }: { controlUrl: string }) {
  const intro = useFrameIntro();
  const [settings, setSettings] = useState<BrokerSettings>(DEFAULTS);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">("dark");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    fetch(`${controlUrl}/v1/settings`)
      .then((r) => r.json() as Promise<SettingsResponse>)
      .then((data) => {
        if (cancelled) return;
        setSettings(data.settings);
        setResolvedTheme(data.themeResolved);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to read settings");
      });
    return () => {
      cancelled = true;
    };
  }, [controlUrl]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const save = async (patch: Partial<BrokerSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setError(null);
    try {
      const res = await fetch(`${controlUrl}/v1/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as SettingsResponse;
      setSettings(data.settings);
      setResolvedTheme(data.themeResolved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  const close = () => window.close();
  const portValue = (n: number | null) => (n === null ? "" : String(n));

  return (
    <div
      className={`app-surface hud-frame flex h-screen w-screen flex-col${intro ? " frame--intro" : ""}`}
    >
      <span className="hud-corner" aria-hidden />

      <div className="app-content flex h-full flex-col">
        <header className="app-drag flex shrink-0 flex-col gap-1 px-7 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <span className="hud-eyebrow">
              <b>SYSTEM</b> &nbsp;//&nbsp; CONFIG · PANEL
            </span>
            <button
              className="app-close"
              onClick={close}
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
            <h1 className="hud-title text-[20px]">Settings</h1>
          </div>

          <div className="hud-divider mt-2" />
        </header>

        <main className="app-scroll flex-1 overflow-auto px-7 py-6">
          <div className="mx-auto flex max-w-md flex-col gap-6">
            <section className="flex flex-col gap-3">
              <h2 className="hud-eyebrow">APPEARANCE</h2>

              <div className="hud-field">
                <div className="flex flex-col">
                  <span className="hud-field-label">Theme</span>
                  <span className="hud-field-hint">auto / dark / light</span>
                </div>
                <div className="min-w-[160px]">
                  <select
                    className="app-select"
                    value={settings.theme}
                    onChange={(e) => save({ theme: e.target.value as Theme })}
                  >
                    <option value="auto">Auto</option>
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="hud-eyebrow">SYSTEM</h2>

              <div className="hud-field">
                <div className="flex flex-col">
                  <span className="hud-field-label">Launch at login</span>
                  <span className="hud-field-hint">start broker silently</span>
                </div>
                <button
                  aria-pressed={settings.launchAtLogin}
                  className="app-switch"
                  data-on={settings.launchAtLogin}
                  onClick={() => save({ launchAtLogin: !settings.launchAtLogin })}
                  type="button"
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="hud-eyebrow">NETWORK · PORTS</h2>

              <div className="hud-field">
                <div className="flex flex-col">
                  <span className="hud-field-label">Control API port</span>
                  <span className="hud-field-hint">empty = auto</span>
                </div>
                <div className="min-w-[140px]">
                  <input
                    className="app-input"
                    inputMode="numeric"
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setSettings((s) => ({
                        ...s,
                        controlPort: v === "" ? null : Number(v),
                      }));
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      save({ controlPort: v === "" ? null : Number(v) });
                    }}
                    placeholder="auto"
                    value={portValue(settings.controlPort)}
                  />
                </div>
              </div>

              <div className="hud-field">
                <div className="flex flex-col">
                  <span className="hud-field-label">Next.js port</span>
                  <span className="hud-field-hint">empty = auto</span>
                </div>
                <div className="min-w-[140px]">
                  <input
                    className="app-input"
                    inputMode="numeric"
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setSettings((s) => ({
                        ...s,
                        nextPort: v === "" ? null : Number(v),
                      }));
                    }}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      save({ nextPort: v === "" ? null : Number(v) });
                    }}
                    placeholder="auto"
                    value={portValue(settings.nextPort)}
                  />
                </div>
              </div>
            </section>

            {error && (
              <p
                className="text-sm hud-eyebrow"
                style={{ color: "rgb(var(--danger))" }}
              >
                ERR <b>·</b> {error}
              </p>
            )}

            <div className="hud-divider mt-2" />
            <p className="hud-eyebrow text-center">
              CHANGES <b>·</b> APPLY · INSTANTLY
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
