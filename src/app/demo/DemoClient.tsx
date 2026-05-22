"use client";

import { useRef } from "react";
import LiquidGlass from "liquid-glass-react";

/**
 * Demo mirroring the rdev/liquid-glass-react reference site:
 * a strong wallpaper underneath, a single LiquidGlass card centered
 * over it. This is the pattern the library is designed for and the
 * one that actually shows visible refraction.
 */
export function DemoClient() {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        // High-contrast wallpaper — refraction needs something to bend.
        backgroundImage:
          "url('https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2000&q=80')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <LiquidGlass
          mouseContainer={ref}
          displacementScale={100}
          blurAmount={0.05}
          saturation={150}
          aberrationIntensity={2.5}
          elasticity={0.2}
          cornerRadius={28}
          mode="standard"
          padding="32px 40px"
        >
          <div
            style={{
              color: "white",
              fontFamily: "ui-sans-serif, system-ui",
              minWidth: 420,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.85, marginBottom: 8 }}>
              Swap from
            </div>
            <div style={{ fontSize: 56, fontWeight: 500, letterSpacing: -1.5, lineHeight: 1 }}>
              2,300
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>
              $2,300.12 &nbsp;·&nbsp; 0.0014 ETH
            </div>
          </div>
        </LiquidGlass>
      </div>
    </div>
  );
}
