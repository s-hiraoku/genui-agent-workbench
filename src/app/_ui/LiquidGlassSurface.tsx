"use client";

import { useRef, type ReactNode } from "react";
import LiquidGlass from "liquid-glass-react";

type LiquidGlassSurfaceProps = {
  children: ReactNode;
};

/**
 * Window-as-glass: a fullscreen <LiquidGlass> sits behind the content
 * layer. The content is rendered as a separate sibling so it isn't
 * subject to the library's internal layout (which only handles small
 * card-sized children).
 */
export function LiquidGlassSurface({ children }: LiquidGlassSurfaceProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      {/* The glass itself — fills the viewport, no children inside */}
      <LiquidGlass
        mouseContainer={ref}
        displacementScale={70}
        blurAmount={0.05}
        saturation={140}
        aberrationIntensity={2}
        elasticity={0.05}
        cornerRadius={10}
        mode="standard"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
        }}
      >
        {/* invisible placeholder so the library still mounts */}
        <div style={{ width: "100vw", height: "100vh" }} />
      </LiquidGlass>

      {/* Content layer sits on top of the glass and takes care of its
          own layout. Pointer events pass through to the glass except
          on actual interactive controls. */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10,
          overflow: "auto",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto", minHeight: "100%" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
