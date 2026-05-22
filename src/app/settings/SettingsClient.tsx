"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";

type BrokerSettings = {
  launchAtLogin: boolean;
  controlPort: number | null;
  nextPort: number | null;
};

type ApiResponse = {
  settings: BrokerSettings & { theme?: string };
};

const DEFAULTS: BrokerSettings = {
  launchAtLogin: false,
  controlPort: null,
  nextPort: null,
};

export function SettingsClient({ controlUrl }: { controlUrl: string }) {
  const [settings, setSettings] = useState<BrokerSettings>(DEFAULTS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!controlUrl) return;
    let cancelled = false;
    fetch(`${controlUrl}/v1/settings`)
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((data) => {
        if (cancelled) return;
        const { launchAtLogin, controlPort, nextPort } = data.settings;
        setSettings({ launchAtLogin, controlPort, nextPort });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to read settings");
      });
    return () => {
      cancelled = true;
    };
  }, [controlUrl]);

  const save = async (patch: Partial<BrokerSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setError(null);
    try {
      const res = await fetch(`${controlUrl}/v1/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as ApiResponse;
      const { launchAtLogin, controlPort, nextPort } = data.settings;
      setSettings({ launchAtLogin, controlPort, nextPort });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    }
  };

  const close = () => window.close();
  const portValue = (n: number | null) => (n === null ? "" : String(n));

  return (
    <LiquidGlassSurface>
      <div className="lg-content h-full mx-auto w-full max-w-lg">
          <header className="lg-drag flex shrink-0 items-center justify-between gap-3 px-2 pt-1 pb-2">
            <div className="flex flex-col">
              <span className="lg-label">Broker</span>
              <h1 className="lg-title">Settings</h1>
            </div>
            <button
              className="lg-icon-button"
              onClick={close}
              type="button"
              aria-label="Close"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </header>

          <main className="lg-scroll flex-1 overflow-auto">
            <div className="flex flex-col gap-2">
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
                  data-mono
                />
              </Field>

              <Field label="Next.js port" hint="Empty = auto">
                <input
                  className="lg-input"
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
                  data-mono
                />
              </Field>

              {error && (
                <p className="lg-meta" style={{ color: "rgb(255, 96, 128)" }}>
                  {error}
                </p>
              )}
            </div>
          </main>
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
    <label className="lg-row">
      <span className="flex min-w-0 flex-col gap-1">
        <span className="lg-label">{label}</span>
        {hint && <span className="lg-meta-faint">{hint}</span>}
      </span>
      <span className="min-w-[160px] shrink-0">{children}</span>
    </label>
  );
}
