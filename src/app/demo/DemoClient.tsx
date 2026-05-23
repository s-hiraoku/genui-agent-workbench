"use client";

import { LiquidGlassSurface } from "@/app/_ui/LiquidGlassSurface";

export function DemoClient() {
  return (
    <LiquidGlassSurface>
      <main className="lg-content" style={{ justifyContent: "center" }}>
        <section className="lg-glass-card-wrap" style={{ marginInline: "auto", maxWidth: 520 }}>
          <div className="lg-card-content" style={{ gap: 18, padding: 24 }}>
            <header className="lg-card-header">
              <h2>Aether Liquid Glass</h2>
              <p>CSS-only frosted window and card material.</p>
            </header>
            <div>
              <div className="lg-label">Swap from</div>
              <div className="lg-display">2,300</div>
              <div className="lg-meta">$2,300.12 / 0.0014 ETH</div>
            </div>
          </div>
        </section>
      </main>
    </LiquidGlassSurface>
  );
}
