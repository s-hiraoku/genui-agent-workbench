"use client";

import { ChevronRight } from "lucide-react";
import { LiquidGlassSurface } from "./_ui/LiquidGlassSurface";

type Artifact = {
  artifactId: string;
  title: string;
  createdAt: string;
};

type HomeClientProps = {
  artifacts: Artifact[];
};

export function HomeClient({ artifacts }: HomeClientProps) {
  const count = artifacts.length;

  return (
    <LiquidGlassSurface>
      <div className="lg-content lg-scroll mx-auto w-full max-w-3xl">
        <header className="flex flex-col gap-3">
          <span className="lg-label">GenUI Popup Broker</span>
          <div className="flex items-baseline gap-3">
            <h1 className="lg-display">{count}</h1>
            <span className="text-[15px] font-medium text-[color:var(--ink-mid)]">
              artifact{count === 1 ? "" : "s"}
            </span>
          </div>
          <p className="lg-meta">
            A resident broker that opens agent-generated UI as local popups.
          </p>
        </header>

        <section className="flex flex-col gap-2">
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
                    {new Date(artifact.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
    </LiquidGlassSurface>
  );
}
