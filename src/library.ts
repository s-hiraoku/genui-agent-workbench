import React from "react";
import { createLibrary, defineComponent, type ComponentGroup, type PromptOptions } from "@openuidev/react-lang";
import { openuiLibrary, openuiPromptOptions } from "@openuidev/react-ui/genui-lib";
import { z } from "zod/v4";

type MapMarker = {
  lat: number;
  lng: number;
  label: string;
  description?: string;
  color?: "red" | "blue" | "green" | "yellow" | "purple" | "gray";
};

const gapMap: Record<string, string> = {
  none: "0",
  xs: "6px",
  s: "8px",
  m: "12px",
  l: "18px",
  xl: "24px",
  "2xl": "36px",
};

const alignMap: Record<string, React.CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
  baseline: "baseline",
};

const justifyMap: Record<string, React.CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
  evenly: "space-evenly",
};

const glassPresets = {
  clear: { color: "white", opacity: 0.18 },
  pane: { color: "white", opacity: 0.34 },
  milky: { color: "white", opacity: 0.52 },
  dense: { color: "white", opacity: 0.68 },
  mint: { color: "rgb(226, 255, 214)", opacity: 0.44 },
  sky: { color: "rgb(224, 244, 255)", opacity: 0.44 },
  rose: { color: "rgb(255, 232, 239)", opacity: 0.46 },
  amber: { color: "rgb(255, 247, 214)", opacity: 0.46 },
} as const;

type GlassPreset = keyof typeof glassPresets;
const labelInkPresets = ["green", "slate", "white", "blue", "amber", "red"] as const;
type LabelInkPreset = (typeof labelInkPresets)[number];

const glassProps = {
  glassPreset: z.enum(["clear", "pane", "milky", "dense", "mint", "sky", "rose", "amber"]).optional(),
  glassColor: z.string().optional(),
  glassOpacity: z.number().min(0).max(1).optional(),
};

type GlassProps = {
  glassPreset?: GlassPreset;
  glassColor?: string;
  glassOpacity?: number;
};

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 0.42;
  return Math.max(0, Math.min(1, value));
}

function glassMix(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(clampOpacity(opacity) * 100)}%, transparent)`;
}

function glassVars(props?: GlassProps, baseOpacity = 0.42): CSSVars {
  if (!props?.glassPreset && !props?.glassColor && props?.glassOpacity === undefined) {
    return {};
  }

  const preset = props.glassPreset ? glassPresets[props.glassPreset] : undefined;
  const color = props.glassColor ?? preset?.color ?? "white";
  const opacity = clampOpacity(props.glassOpacity ?? preset?.opacity ?? baseOpacity);
  return {
    "--aether-card-tint": glassMix(color, opacity),
    "--aether-card-tint-soft": glassMix(color, opacity * 0.42),
    "--glass-pane-wash": glassMix(color, opacity),
    "--glass-pane-wash-soft": glassMix(color, opacity * 0.42),
    "--glass-readable-wash": glassMix(color, Math.max(0.56, opacity + 0.18)),
    "--glass-readable-wash-soft": glassMix(color, Math.max(0.38, opacity + 0.02)),
    "--glass-label-wash": glassMix(color, Math.max(0.62, opacity + 0.22)),
    "--glass-label-wash-soft": glassMix(color, Math.max(0.42, opacity + 0.06)),
  };
}

const Card = defineComponent({
  name: "Card",
  props: z.object({
    children: z.array(z.any()),
    variant: z.enum(["card", "sunk", "clear"]).optional(),
    direction: z.enum(["row", "column"]).optional(),
    wrap: z.boolean().optional(),
    gap: z.enum(["none", "xs", "s", "m", "l", "xl", "2xl"]).optional(),
    align: z.enum(["start", "center", "end", "stretch", "baseline"]).optional(),
    justify: z.enum(["start", "center", "end", "between", "around", "evenly"]).optional(),
    ...glassProps,
  }),
  description:
    'Liquid Glass container. variant: "card" (default glass plate) | "sunk" (slightly denser glass) | "clear" (no inset padding). Always full width. Accepts Stack flex params and glassPreset/glassColor/glassOpacity.',
  component: ({ props, renderNode }) => {
    const isClear = props.variant === "clear";
    return React.createElement(
      "div",
      {
        className: "lg-glass-card-wrap",
        "data-variant": props.variant ?? "card",
        style: {
          flex: 1,
          minWidth: 0,
          width: "100%",
        },
      },
      React.createElement(
        "div",
        {
          className: "lg-card-content",
          "data-variant": props.variant ?? "card",
          style: {
            ...glassVars(props),
            alignItems: alignMap[props.align ?? "stretch"] ?? "stretch",
            display: "flex",
            flex: 1,
            flexDirection: props.direction ?? "column",
            flexWrap: props.wrap ? "wrap" : "nowrap",
            gap: gapMap[props.gap ?? "m"] ?? gapMap.m,
            justifyContent: justifyMap[props.justify ?? "start"] ?? "flex-start",
            minWidth: 0,
            padding: isClear ? 0 : 18,
            width: "100%",
          },
        },
        renderNode(props.children),
      ),
    );
  },
});

const CardHeader = defineComponent({
  name: "CardHeader",
  props: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    ...glassProps,
  }),
  description: "Header with optional title and subtitle, styled for Liquid Glass cards.",
  component: ({ props }) =>
    React.createElement(
      "header",
      { className: "lg-card-header" },
      props.title ? React.createElement("h2", null, props.title) : null,
      props.subtitle ? React.createElement("p", null, props.subtitle) : null,
    ),
});

function labelElement(
  text: string,
  toneValue: string = "neutral",
  size: "xs" | "sm" = "sm",
  style?: React.CSSProperties,
  inkPreset: LabelInkPreset = "green",
): React.ReactElement {
  return React.createElement(
    "span",
    {
      className: "lg-label-surface",
      "data-ink": inkPreset,
      "data-size": size,
      "data-tone": toneValue,
      style,
    },
    text,
  );
}

const Label = defineComponent({
  name: "Label",
  props: z.object({
    text: z.string(),
    tone: z.enum(["positive", "neutral", "warning", "danger", "info", "critical"]).optional(),
    size: z.enum(["xs", "sm"]).optional(),
    inkPreset: z.enum(labelInkPresets).optional(),
    ...glassProps,
  }),
  description:
    "Reusable milky Liquid Glass label/badge. Use for every status, priority, metric label, tag, count, and compact text surface. Supports glassPreset, glassColor, glassOpacity, and inkPreset.",
  component: ({ props }) => labelElement(props.text, props.tone, props.size, glassVars(props, 0.64), props.inkPreset),
});

const markerColors: Record<NonNullable<MapMarker["color"]>, string> = {
  blue: "rgba(70, 132, 196, 0.72)",
  gray: "rgba(88, 105, 94, 0.66)",
  green: "rgba(105, 151, 70, 0.74)",
  purple: "rgba(142, 104, 184, 0.70)",
  red: "rgba(190, 92, 104, 0.72)",
  yellow: "rgba(190, 162, 72, 0.72)",
};

const hudText = "rgba(244, 252, 255, 0.94)";
const hudTextMid = "rgba(216, 236, 245, 0.72)";
const hudTextSoft = "rgba(186, 214, 226, 0.56)";
const hudEdge = "rgba(128, 226, 255, 0.18)";
const hudEdgeStrong = "rgba(128, 226, 255, 0.32)";
const hudLine = "rgba(76, 203, 255, 0.42)";
const hudPanelWash = "rgba(2, 18, 32, 0.18)";
const hudCellWash = "rgba(76, 203, 255, 0.08)";

const toneStyles: Record<string, { accent: string; background: string; border: string; text: string }> = {
  critical: { accent: "rgba(255, 96, 126, 0.78)", background: "linear-gradient(90deg, rgba(255,96,126,0.13), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018))", border: "rgba(255, 96, 126, 0.32)", text: "rgba(255, 218, 226, 0.96)" },
  danger: { accent: "rgba(255, 96, 126, 0.74)", background: "linear-gradient(90deg, rgba(255,96,126,0.12), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018))", border: "rgba(255, 96, 126, 0.30)", text: "rgba(255, 218, 226, 0.96)" },
  warning: { accent: "rgba(255, 216, 112, 0.76)", background: "linear-gradient(90deg, rgba(255,216,112,0.12), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018))", border: "rgba(255, 216, 112, 0.30)", text: "rgba(255, 240, 196, 0.96)" },
  positive: { accent: "rgba(128, 255, 180, 0.76)", background: "linear-gradient(90deg, rgba(128,255,180,0.11), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018))", border: "rgba(128, 255, 180, 0.28)", text: "rgba(218, 255, 235, 0.96)" },
  neutral: { accent: "rgba(180, 226, 242, 0.58)", background: "linear-gradient(90deg, rgba(128,226,255,0.075), rgba(2,18,32,0.16) 48%, rgba(255,255,255,0.018))", border: "rgba(128, 226, 255, 0.18)", text: hudText },
  info: { accent: "rgba(76, 203, 255, 0.76)", background: "linear-gradient(90deg, rgba(76,203,255,0.13), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018))", border: "rgba(76, 203, 255, 0.30)", text: "rgba(216, 246, 255, 0.96)" },
};

function toneFor(value?: string) {
  return toneStyles[value ?? "neutral"] ?? toneStyles.neutral;
}

const panelBaseStyle: React.CSSProperties = {
  background:
    "linear-gradient(145deg, var(--aether-card-tint), rgba(2,18,32,0.16) 58%, rgba(255,255,255,0.018)), linear-gradient(90deg, rgba(76,203,255,0.08), transparent 42%)",
  backdropFilter: "blur(var(--aether-card-blur)) saturate(var(--aether-card-saturate)) brightness(var(--aether-card-brightness))",
  border: `1px solid ${hudEdge}`,
  borderRadius: 10,
  boxShadow: `inset 2px 0 0 ${hudLine}, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,12,24,0.22), inset 0 0 24px rgba(76,203,255,0.06), 0 14px 36px rgba(0,12,24,0.20)`,
  color: hudText,
  overflow: "hidden",
  WebkitBackdropFilter: "blur(var(--aether-card-blur)) saturate(var(--aether-card-saturate)) brightness(var(--aether-card-brightness))",
};

function panelStyleFor(props?: GlassProps): React.CSSProperties {
  return {
    ...glassVars(props),
    ...panelBaseStyle,
  };
}

const readableGlassStyle: React.CSSProperties = {
  backdropFilter: "blur(var(--aether-readable-blur)) saturate(1.12) brightness(1.02)",
  boxShadow:
    `inset 2px 0 0 ${hudLine}, inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,12,24,0.22), inset 0 0 18px rgba(76,203,255,0.05), 0 10px 24px rgba(0,12,24,0.14)`,
  WebkitBackdropFilter: "blur(var(--aether-readable-blur)) saturate(1.12) brightness(1.02)",
};

function accentedReadableGlassStyle(tone: { border: string }): React.CSSProperties {
  return {
    ...readableGlassStyle,
    boxShadow: `${readableGlassStyle.boxShadow}, inset 0 0 28px ${tone.border}, 0 0 26px ${tone.border}`,
  };
}

function panelHeader(title?: string, description?: string): React.ReactNode {
  if (!title && !description) {
    return null;
  }

  return React.createElement(
    "div",
    { style: { borderBottom: `1px solid ${hudEdge}`, padding: "12px 14px" } },
    title ? React.createElement("h3", { style: { color: hudText, fontSize: 16, fontWeight: 760, letterSpacing: 0, margin: 0 } }, title) : null,
    description
      ? React.createElement(
          "p",
          { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: title ? "4px 0 0" : 0 } },
          description,
        )
      : null,
  );
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function lngToWorldX(lng: number, zoom: number): number {
  return ((lng + 180) / 360) * 256 * 2 ** zoom;
}

function latToWorldY(lat: number, zoom: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * 256 * 2 ** zoom;
}

function projectMarker(marker: MapMarker, zoom: number, topLeftX: number, topLeftY: number) {
  return {
    x: lngToWorldX(marker.lng, zoom) - topLeftX,
    y: latToWorldY(marker.lat, zoom) - topLeftY,
  };
}

function normalizeTileX(tileX: number, zoom: number): number {
  const max = 2 ** zoom;
  return ((tileX % max) + max) % max;
}

const MapView = defineComponent({
  name: "MapView",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    center: z.object({
      lat: z.number(),
      lng: z.number(),
    }),
    zoom: z.number().int().min(1).max(18).default(11),
    height: z.number().int().min(240).max(720).default(360),
    markers: z
      .array(
        z.object({
          lat: z.number(),
          lng: z.number(),
          label: z.string(),
          description: z.string().optional(),
          color: z.enum(["red", "blue", "green", "yellow", "purple", "gray"]).optional(),
        }),
      )
      .default([]),
    ...glassProps,
  }),
  description:
    "Interactive-looking map panel backed by OpenStreetMap tiles. Use for locations, routes, store/customer/site maps, regional incidents, and geo dashboards. Markers need lat/lng, label, optional description, and optional color.",
  component: ({ props }) => {
    const width = 768;
    const height = props.height ?? 360;
    const zoom = props.zoom ?? 11;
    const centerX = lngToWorldX(props.center.lng, zoom);
    const centerY = latToWorldY(props.center.lat, zoom);
    const topLeftX = centerX - width / 2;
    const topLeftY = centerY - height / 2;
    const minTileX = Math.floor(topLeftX / 256);
    const maxTileX = Math.floor((topLeftX + width) / 256);
    const minTileY = Math.floor(topLeftY / 256);
    const maxTileY = Math.floor((topLeftY + height) / 256);
    const maxTile = 2 ** zoom - 1;
    const tiles = [];

    for (let x = minTileX; x <= maxTileX; x += 1) {
      for (let y = minTileY; y <= maxTileY; y += 1) {
        if (y < 0 || y > maxTile) {
          continue;
        }

        tiles.push({
          key: `${x}:${y}`,
          left: x * 256 - topLeftX,
          top: y * 256 - topLeftY,
          url: `https://tile.openstreetmap.org/${zoom}/${normalizeTileX(x, zoom)}/${y}.png`,
        });
      }
    }

    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        {
          role: "img",
          "aria-label": props.title ?? "Map",
          style: {
            background: "rgba(232,244,255,0.14)",
            height,
            overflow: "hidden",
            position: "relative",
            width: "100%",
          },
        },
        tiles.map((tile) =>
          React.createElement("img", {
            alt: "",
            draggable: false,
            key: tile.key,
            src: tile.url,
            style: {
              height: 256,
              left: `${(tile.left / width) * 100}%`,
              position: "absolute",
              top: tile.top,
              userSelect: "none",
              width: `${(256 / width) * 100}%`,
            },
          }),
        ),
        props.markers.map((marker, index) => {
          const point = projectMarker(marker, zoom, topLeftX, topLeftY);
          if (point.x < -24 || point.x > width + 24 || point.y < -24 || point.y > height + 24) {
            return null;
          }

          const color = markerColors[marker.color ?? "red"];
          return React.createElement(
            "div",
            {
              key: `${marker.label}:${index}`,
              style: {
                left: `${(point.x / width) * 100}%`,
                position: "absolute",
                top: point.y,
                transform: "translate(-50%, -100%)",
              },
              title: marker.description ? `${marker.label}: ${marker.description}` : marker.label,
            },
            React.createElement("div", {
              style: {
                background: color,
                border: `1px solid ${hudEdgeStrong}`,
                borderRadius: "8px 8px 8px 0",
                boxShadow: `0 0 16px ${color}, inset 0 1px 0 rgba(255,255,255,0.38)`,
                height: 20,
                transform: "rotate(-45deg)",
                width: 20,
              },
            }),
            React.createElement(
              "div",
              {
                style: {
                  background: "rgba(216,246,255,0.22)",
                  backdropFilter: "blur(16px) saturate(1.18)",
                  border: `1px solid ${hudEdgeStrong}`,
                  borderRadius: 6,
                  color: hudText,
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 3,
                  maxWidth: 180,
                  padding: "3px 6px",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                },
              },
              marker.label,
            ),
          );
        }),
        React.createElement(
          "a",
          {
            href: `https://www.openstreetmap.org/#map=${zoom}/${props.center.lat}/${props.center.lng}`,
            rel: "noreferrer",
            style: {
              background: hudPanelWash,
              border: `1px solid ${hudEdge}`,
              borderRadius: 5,
              bottom: 6,
              color: hudTextMid,
              fontSize: 11,
              padding: "2px 5px",
              position: "absolute",
              right: 6,
              textDecoration: "none",
            },
            target: "_blank",
          },
          "OpenStreetMap",
        ),
      ),
    );
  },
});

const AudioPlayer = defineComponent({
  name: "AudioPlayer",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    tracks: z.array(
      z.object({
        title: z.string(),
        artist: z.string().optional(),
        src: z.string(),
        coverUrl: z.string().optional(),
        description: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Audio playlist player for music, generated audio, voice notes, podcasts, meeting recordings, and sound previews. Each track needs title and src; artist, coverUrl, and description are optional.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        props.tracks.map((track, index) =>
          React.createElement(
            "article",
            {
              key: `${track.title}:${index}`,
              style: {
                alignItems: "center",
                background: hudCellWash,
                border: `1px solid ${hudEdge}`,
                borderRadius: 8,
                display: "grid",
                gap: 12,
                gridTemplateColumns: track.coverUrl ? "72px 1fr" : "1fr",
                padding: 12,
              },
            },
            track.coverUrl
              ? React.createElement("img", {
                  alt: "",
                  src: track.coverUrl,
                  style: { borderRadius: 6, height: 72, objectFit: "cover", width: 72 },
                })
              : null,
            React.createElement(
              "div",
              null,
              React.createElement("div", { style: { color: hudText, fontSize: 14, fontWeight: 700 } }, track.title),
              track.artist
                ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12, marginTop: 2 } }, track.artist)
                : null,
              track.description
                ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.5, margin: "6px 0" } }, track.description)
                : null,
              React.createElement("audio", {
                controls: true,
                preload: "metadata",
                src: track.src,
                style: { marginTop: 8, width: "100%" },
              }),
            ),
          ),
        ),
      ),
    ),
});

const VideoPlayer = defineComponent({
  name: "VideoPlayer",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    src: z.string(),
    posterUrl: z.string().optional(),
    transcript: z.string().optional(),
    chapters: z
      .array(
        z.object({
          time: z.string(),
          title: z.string(),
          description: z.string().optional(),
        }),
      )
      .optional(),
    ...glassProps,
  }),
  description:
    "Video player for demos, screen recordings, generated clips, design walkthroughs, tutorials, and incident evidence. Supports src, posterUrl, transcript, and chapter list.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      React.createElement("video", {
        controls: true,
        playsInline: true,
        poster: props.posterUrl,
        preload: "metadata",
        src: props.src,
        style: { background: "#0a0a0a", display: "block", width: "100%" },
      }),
      React.createElement(
        "div",
        { style: { padding: 14 } },
        props.title
          ? React.createElement("h3", { style: { color: hudText, fontSize: 16, fontWeight: 760, margin: 0 } }, props.title)
          : null,
        props.description
          ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: props.title ? "4px 0 0" : 0 } }, props.description)
          : null,
        props.chapters?.length
          ? React.createElement(
              "ol",
              { style: { color: hudTextMid, display: "grid", gap: 8, margin: "12px 0 0", paddingLeft: 18 } },
              props.chapters.map((chapter, index) =>
                React.createElement(
                  "li",
                  { key: `${chapter.time}:${index}` },
                  React.createElement("strong", null, `${chapter.time} ${chapter.title}`),
                  chapter.description ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12 } }, chapter.description) : null,
                ),
              ),
            )
          : null,
        props.transcript
          ? React.createElement(
              "details",
              { style: { marginTop: 12 } },
              React.createElement("summary", { style: { color: hudText, cursor: "pointer", fontSize: 13, fontWeight: 700 } }, "Transcript"),
              React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, props.transcript),
            )
          : null,
      ),
    ),
});

const MetricGrid = defineComponent({
  name: "MetricGrid",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    metrics: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        delta: z.string().optional(),
        description: z.string().optional(),
        tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Responsive KPI and summary metric grid for dashboards, status reports, operational snapshots, progress summaries, and executive explanations.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            padding: 14,
          },
        },
        props.metrics.map((metric, index) => {
          const tone = toneFor(metric.tone);
          return React.createElement(
            "article",
            {
              key: `${metric.label}:${index}`,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                minHeight: 104,
                padding: 12,
                ...accentedReadableGlassStyle(tone),
              },
            },
            labelElement(metric.label, metric.tone ?? "neutral", "xs"),
            React.createElement("div", { style: { color: tone.text, fontSize: 24, fontWeight: 800, lineHeight: 1.15, marginTop: 6 } }, metric.value),
            metric.delta
              ? React.createElement("div", { style: { marginTop: 6 } }, labelElement(metric.delta, metric.tone ?? "neutral", "xs"))
              : null,
            metric.description
              ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.45, margin: "7px 0 0" } }, metric.description)
              : null,
          );
        }),
      ),
    ),
});

const ActionPanel = defineComponent({
  name: "ActionPanel",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    actions: z.array(
      z.object({
        label: z.string(),
        description: z.string().optional(),
        priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
        owner: z.string().optional(),
        due: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Prioritized next-action panel for recommendations, handoffs, agent plans, approvals, follow-up work, and user-visible task lists.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        props.actions.map((action, index) => {
          const tone = toneFor(action.priority === "critical" ? "critical" : action.priority === "high" ? "warning" : "info");
          return React.createElement(
            "article",
            {
              key: `${action.label}:${index}`,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                padding: 12,
                ...accentedReadableGlassStyle(tone),
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: tone.text, fontSize: 14, lineHeight: 1.35 } }, action.label),
              labelElement(action.priority, action.priority === "critical" ? "critical" : action.priority === "high" ? "warning" : "info", "xs", { flexShrink: 0 }),
            ),
            action.description
              ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" } }, action.description)
              : null,
            action.owner || action.due
              ? React.createElement(
                  "div",
                  { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 } },
                  action.owner ? labelElement(`Owner: ${action.owner}`, "neutral", "xs") : null,
                  action.due ? labelElement(`Due: ${action.due}`, "neutral", "xs") : null,
                )
              : null,
          );
        }),
      ),
    ),
});

const TimelinePanel = defineComponent({
  name: "TimelinePanel",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    events: z.array(
      z.object({
        time: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: z.enum(["done", "active", "planned", "blocked", "warning"]).default("planned"),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Chronological timeline for incidents, launches, project plans, research history, deployment progress, and multi-step explanations.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "ol",
        { style: { display: "grid", gap: 0, listStyle: "none", margin: 0, padding: 14 } },
        props.events.map((event, index) => {
          const tone = toneFor(event.status === "done" ? "positive" : event.status === "blocked" ? "danger" : event.status === "warning" ? "warning" : "info");
          return React.createElement(
            "li",
            {
              key: `${event.time}:${event.title}:${index}`,
              style: {
                display: "grid",
                gap: 10,
                gridTemplateColumns: "82px 18px 1fr",
                minHeight: 54,
              },
            },
            React.createElement("time", { style: { color: hudTextSoft, fontSize: 12, fontWeight: 700, paddingTop: 2 } }, event.time),
            React.createElement(
              "span",
              { style: { alignItems: "center", display: "flex", flexDirection: "column" } },
              React.createElement("span", {
                style: {
                  background: tone.accent,
                  border: `1px solid ${hudEdgeStrong}`,
                  borderRadius: 4,
                  boxShadow: `0 0 0 2px ${tone.border}, 0 0 16px ${tone.border}`,
                  height: 10,
                  marginTop: 4,
                  width: 10,
                },
              }),
              index < props.events.length - 1 ? React.createElement("span", { style: { background: hudEdge, flex: 1, marginTop: 4, width: 1 } }) : null,
            ),
            React.createElement(
              "div",
              { style: { paddingBottom: 14 } },
              React.createElement(
                "div",
                { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 } },
                React.createElement("strong", { style: { color: tone.text, display: "block", fontSize: 14 } }, event.title),
                labelElement(event.status, event.status === "done" ? "positive" : event.status === "blocked" ? "danger" : event.status === "warning" ? "warning" : "info", "xs"),
              ),
              event.description ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: "4px 0 0" } }, event.description) : null,
            ),
          );
        }),
      ),
    ),
});

const DecisionMatrix = defineComponent({
  name: "DecisionMatrix",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    options: z.array(
      z.object({
        name: z.string(),
        summary: z.string().optional(),
        score: z.string().optional(),
        recommendation: z.enum(["recommended", "consider", "avoid"]).default("consider"),
        pros: z.array(z.string()).default([]),
        cons: z.array(z.string()).default([]),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Comparison matrix for choices, recommendations, tradeoffs, vendor/tool selection, design alternatives, and agent decision support.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            padding: 14,
          },
        },
        props.options.map((option, index) => {
          const tone = toneFor(option.recommendation === "recommended" ? "positive" : option.recommendation === "avoid" ? "danger" : "info");
          return React.createElement(
            "article",
            {
              key: `${option.name}:${index}`,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                display: "grid",
                gap: 8,
                padding: 12,
                ...readableGlassStyle,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: tone.text, fontSize: 15 } }, option.name),
              option.score ? labelElement(option.score, option.recommendation === "recommended" ? "positive" : option.recommendation === "avoid" ? "danger" : "info", "xs") : null,
            ),
            option.summary ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.45, margin: 0 } }, option.summary) : null,
            option.pros.length
              ? React.createElement(
                  "ul",
                  { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.45, margin: 0, paddingLeft: 18 } },
                  option.pros.map((pro, proIndex) => React.createElement("li", { key: `${pro}:${proIndex}` }, pro)),
                )
              : null,
            option.cons.length
              ? React.createElement(
                  "ul",
                  { style: { color: hudTextSoft, fontSize: 12, lineHeight: 1.45, margin: 0, paddingLeft: 18 } },
                  option.cons.map((con, conIndex) => React.createElement("li", { key: `${con}:${conIndex}` }, con)),
                )
              : null,
          );
        }),
      ),
    ),
});

const DataTable = defineComponent({
  name: "DataTable",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        align: z.enum(["left", "right", "center"]).optional(),
      }),
    ),
    rows: z.array(z.record(z.string(), z.unknown())),
    caption: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Responsive data table for operational rows, ticket lists, file inventories, research results, rankings, and structured evidence. Use when users need to scan or compare records.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { overflowX: "auto", overscrollBehaviorX: "contain", scrollbarGutter: "stable", width: "100%" } },
        React.createElement(
          "table",
          { style: { borderCollapse: "collapse", minWidth: Math.max(520, props.columns.length * 140), width: "100%" } },
          props.caption ? React.createElement("caption", { style: { color: hudTextMid, fontSize: 12, padding: 10, textAlign: "left" } }, props.caption) : null,
          React.createElement(
            "thead",
            { style: { background: hudCellWash } },
            React.createElement(
              "tr",
              null,
              props.columns.map((column) =>
                React.createElement(
                  "th",
                  {
                    key: column.key,
                    style: {
                      borderBottom: `1px solid ${hudEdge}`,
                      color: hudTextMid,
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "9px 10px",
                      textAlign: column.align ?? "left",
                      whiteSpace: "nowrap",
                    },
                  },
                  labelElement(column.label, "neutral", "xs"),
                ),
              ),
            ),
          ),
          React.createElement(
            "tbody",
            null,
            props.rows.map((row, rowIndex) =>
              React.createElement(
                "tr",
                { key: `row:${rowIndex}`, style: { background: rowIndex % 2 === 0 ? "rgba(2,18,32,0.08)" : "rgba(76,203,255,0.045)" } },
                props.columns.map((column) =>
                  React.createElement(
                    "td",
                    {
                      key: `${rowIndex}:${column.key}`,
                      style: {
                        borderBottom: `1px solid ${hudEdge}`,
                        color: hudText,
                        fontSize: 13,
                        lineHeight: 1.45,
                        maxWidth: 260,
                        padding: "9px 10px",
                        textAlign: column.align ?? "left",
                        verticalAlign: "top",
                        wordBreak: "break-word",
                      },
                    },
                    formatCellValue(row[column.key]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
});

const TaskBoard = defineComponent({
  name: "TaskBoard",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    columns: z.array(
      z.object({
        title: z.string(),
        tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
        items: z.array(
          z.object({
            title: z.string(),
            description: z.string().optional(),
            owner: z.string().optional(),
            status: z.string().optional(),
          }),
        ),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Compact task board for agent plans, handoffs, triage, implementation status, QA queues, and multi-owner workflows.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            padding: 14,
          },
        },
        props.columns.map((column, index) => {
          const tone = toneFor(column.tone);
          return React.createElement(
            "section",
            {
              key: `${column.title}:${index}`,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                minHeight: 120,
                padding: 10,
                ...readableGlassStyle,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between", marginBottom: 10 } },
              React.createElement("h4", { style: { color: tone.text, fontSize: 13, fontWeight: 800, margin: 0 } }, column.title),
              labelElement(String(column.items.length), column.tone ?? "neutral", "xs"),
            ),
            React.createElement(
              "div",
              { style: { display: "grid", gap: 8 } },
              column.items.map((item, itemIndex) =>
                React.createElement(
                  "article",
                  {
                    key: `${item.title}:${itemIndex}`,
                    style: {
                      background: hudPanelWash,
                      border: `1px solid ${hudEdge}`,
                      borderRadius: 7,
                      boxShadow: `inset 1px 0 0 ${tone.border}, inset 0 1px 0 rgba(255,255,255,0.16)`,
                      padding: 9,
                    },
                  },
                  React.createElement("strong", { style: { color: hudText, display: "block", fontSize: 13, lineHeight: 1.35 } }, item.title),
                  item.description
                    ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.45, margin: "5px 0 0" } }, item.description)
                    : null,
                  item.owner || item.status
                    ? React.createElement(
                        "div",
                        { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 7 } },
                        item.owner ? labelElement(item.owner, "neutral", "xs") : null,
                        item.status ? labelElement(item.status, column.tone ?? "neutral", "xs") : null,
                      )
                    : null,
                ),
              ),
            ),
          );
        }),
      ),
    ),
});

const CodeDiff = defineComponent({
  name: "CodeDiff",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    files: z.array(
      z.object({
        path: z.string(),
        language: z.string().optional(),
        additions: z.number().int().optional(),
        deletions: z.number().int().optional(),
        hunks: z.array(
          z.object({
            title: z.string().optional(),
            lines: z.array(
              z.object({
                type: z.enum(["add", "remove", "context"]),
                content: z.string(),
              }),
            ),
          }),
        ),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Readable code/config/document diff viewer for review summaries, generated patches, config changes, migration previews, and agent handoffs.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        props.files.map((file, index) =>
          React.createElement(
            "article",
            { key: `${file.path}:${index}`, style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 8, overflow: "hidden" } },
            React.createElement(
              "div",
              {
                style: {
                  alignItems: "center",
                  background: hudCellWash,
                  borderBottom: `1px solid ${hudEdge}`,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "space-between",
                  padding: "8px 10px",
                },
              },
              React.createElement("strong", { style: { color: hudText, fontSize: 13, overflowWrap: "anywhere" } }, file.path),
              labelElement(`+${file.additions ?? 0} / -${file.deletions ?? 0}${file.language ? ` · ${file.language}` : ""}`, "neutral", "xs"),
            ),
            file.hunks.map((hunk, hunkIndex) =>
              React.createElement(
                "div",
                { key: `${file.path}:hunk:${hunkIndex}` },
                hunk.title
                  ? React.createElement("div", { style: { background: hudPanelWash, color: hudTextMid, fontSize: 12, padding: "6px 10px" } }, hunk.title)
                  : null,
                React.createElement(
                  "pre",
                  {
                    style: {
                      background: "#0a0a0a",
                      color: "#e5e5e5",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      fontSize: 12,
                      lineHeight: 1.5,
                      margin: 0,
                      maxHeight: 360,
                      overflow: "auto",
                      padding: 0,
                    },
                  },
                  hunk.lines.map((line, lineIndex) => {
                    const background = line.type === "add" ? "rgba(22, 163, 74, 0.18)" : line.type === "remove" ? "rgba(220, 38, 38, 0.18)" : "transparent";
                    const color = line.type === "add" ? "#bbf7d0" : line.type === "remove" ? "#fecaca" : "#e5e5e5";
                    const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
                    return React.createElement(
                      "div",
                      {
                        key: `${line.content}:${lineIndex}`,
                        style: {
                          background,
                          color,
                          display: "grid",
                          gridTemplateColumns: "24px 1fr",
                          minWidth: 0,
                          padding: "0 10px",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        },
                      },
                      React.createElement("span", { style: { color: "#a3a3a3", userSelect: "none" } }, prefix),
                      React.createElement("code", null, line.content),
                    );
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
});

const KeyValuePanel = defineComponent({
  name: "KeyValuePanel",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(
      z.object({
        label: z.string(),
        value: z.string(),
        description: z.string().optional(),
        tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Dense key-value facts panel for metadata, environment info, customer details, config summaries, and short evidence lists.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "dl",
        { style: { display: "grid", gap: 0, margin: 0, padding: 0 } },
        props.items.map((item, index) => {
          const tone = toneFor(item.tone);
          return React.createElement(
            "div",
            {
              key: `${item.label}:${index}`,
              style: {
                alignItems: "start",
                borderTop: index === 0 ? "0" : `1px solid ${hudEdge}`,
                display: "grid",
                gap: 10,
                gridTemplateColumns: "minmax(110px, 0.38fr) minmax(0, 1fr)",
                padding: "10px 14px",
              },
            },
            React.createElement("dt", null, labelElement(item.label, item.tone ?? "neutral", "xs")),
            React.createElement(
              "dd",
              { style: { color: hudText, margin: 0, minWidth: 0 } },
              React.createElement("div", { style: { color: tone.text, fontSize: 14, fontWeight: 800, overflowWrap: "anywhere" } }, item.value),
              item.description
                ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.45, margin: "4px 0 0" } }, item.description)
                : null,
            ),
          );
        }),
      ),
    ),
});

const AlertList = defineComponent({
  name: "AlertList",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    alerts: z.array(
      z.object({
        severity: z.enum(["info", "warning", "danger", "positive"]).default("info"),
        title: z.string(),
        description: z.string().optional(),
        action: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Alert and risk list for issues, warnings, blockers, incidents, validation errors, and positive confirmations.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        props.alerts.map((alert, index) => {
          const tone = toneFor(alert.severity);
          return React.createElement(
            "article",
            {
              key: `${alert.title}:${index}`,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                padding: 12,
                ...readableGlassStyle,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: tone.text, fontSize: 14, lineHeight: 1.35 } }, alert.title),
              labelElement(alert.severity, alert.severity, "xs", { flexShrink: 0 }),
            ),
            alert.description
              ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" } }, alert.description)
              : null,
            alert.action
              ? React.createElement("div", { style: { color: tone.text, fontSize: 12, fontWeight: 800, marginTop: 8 } }, alert.action)
              : null,
          );
        }),
      ),
    ),
});

const ProgressStepper = defineComponent({
  name: "ProgressStepper",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(
      z.object({
        label: z.string(),
        status: z.enum(["done", "active", "pending", "blocked"]).default("pending"),
        description: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Step-by-step progress tracker for workflows, onboarding, releases, investigations, approvals, and multi-stage agent runs.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "ol",
        { style: { display: "grid", gap: 10, listStyle: "none", margin: 0, padding: 14 } },
        props.steps.map((step, index) => {
          const tone = toneFor(step.status === "done" ? "positive" : step.status === "blocked" ? "danger" : step.status === "active" ? "info" : "neutral");
          return React.createElement(
            "li",
            {
              key: `${step.label}:${index}`,
              style: {
                alignItems: "start",
                display: "grid",
                gap: 10,
                gridTemplateColumns: "28px 1fr",
              },
            },
            React.createElement(
              "span",
              {
                style: {
                  alignItems: "center",
                  background: tone.background,
                  border: `1px solid ${tone.border}`,
                  borderRadius: 6,
                  color: tone.text,
                  display: "inline-flex",
                  fontSize: 12,
                  fontWeight: 900,
                  height: 24,
                  justifyContent: "center",
                  width: 24,
                },
              },
              index + 1,
            ),
            React.createElement(
              "div",
              { style: { borderBottom: index === props.steps.length - 1 ? "0" : `1px solid ${hudEdge}`, paddingBottom: 10 } },
              React.createElement(
                "div",
                { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 } },
                React.createElement("strong", { style: { color: tone.text, fontSize: 14 } }, step.label),
                labelElement(step.status, step.status === "done" ? "positive" : step.status === "blocked" ? "danger" : step.status === "active" ? "info" : "neutral", "xs"),
              ),
              step.description
                ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.45, margin: "4px 0 0" } }, step.description)
                : null,
            ),
          );
        }),
      ),
    ),
});

const BarChart = defineComponent({
  name: "BarChart",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    max: z.number().positive().optional(),
    data: z.array(
      z.object({
        label: z.string(),
        value: z.number(),
        tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Simple responsive horizontal bar chart for rankings, category comparison, volume, cost, risk, and operational counts.",
  component: ({ props }) => {
    const maxValue = props.max ?? Math.max(1, ...props.data.map((item) => item.value));
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        props.data.map((item, index) => {
          const tone = toneFor(item.tone);
          const percent = clampPercent((item.value / maxValue) * 100);
          return React.createElement(
            "div",
            { key: `${item.label}:${index}`, style: { display: "grid", gap: 5 } },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" } },
              labelElement(item.label, item.tone ?? "neutral", "xs"),
              labelElement(`${item.value}${props.unit ?? ""}`, item.tone ?? "neutral", "xs"),
            ),
            React.createElement(
              "div",
              { style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 5, height: 11, overflow: "hidden" } },
              React.createElement("div", {
                style: {
                  background: `linear-gradient(90deg, ${tone.accent}, rgba(76,203,255,0.32))`,
                  borderRadius: 5,
                  height: "100%",
                  opacity: 0.88,
                  width: `${percent}%`,
                },
              }),
            ),
          );
        }),
      ),
    );
  },
});

const LineChart = defineComponent({
  name: "LineChart",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    data: z.array(
      z.object({
        label: z.string(),
        value: z.number(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Compact line chart for trends, time series, forecasts, health signals, backlog movement, and metric changes over time.",
  component: ({ props }) => {
    const width = 640;
    const height = 220;
    const values = props.data.map((point) => point.value);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 1);
    const span = Math.max(1, maxValue - minValue);
    const points = props.data.map((point, index) => {
      const x = props.data.length === 1 ? width / 2 : (index / (props.data.length - 1)) * width;
      const y = height - ((point.value - minValue) / span) * height;
      return { ...point, x, y };
    });

    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { padding: 14 } },
        React.createElement(
          "svg",
          { role: "img", viewBox: `0 0 ${width} ${height}`, style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 8, display: "block", width: "100%" } },
          React.createElement("defs", null,
            React.createElement("linearGradient", { id: "lineGlassGradient", x1: "0", x2: "1", y1: "0", y2: "0" },
              React.createElement("stop", { offset: "0%", stopColor: "rgba(76,203,255,0.76)" }),
              React.createElement("stop", { offset: "100%", stopColor: "rgba(128,255,180,0.54)" }),
            ),
          ),
          React.createElement("polyline", {
            fill: "none",
            points: points.map((point) => `${point.x},${point.y}`).join(" "),
            stroke: "url(#lineGlassGradient)",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeWidth: 4,
          }),
          points.map((point, index) =>
            React.createElement("circle", {
              cx: point.x,
              cy: point.y,
              fill: "rgba(2,18,32,0.82)",
              key: `${point.label}:${index}`,
              r: 5,
              stroke: "rgba(76,203,255,0.76)",
              strokeWidth: 3,
            }),
          ),
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 } },
          points.map((point, index) =>
            React.createElement(
              "span",
              { key: `${point.label}:legend:${index}` },
              labelElement(`${point.label}: ${point.value}${props.unit ?? ""}`, "info", "xs"),
            ),
          ),
        ),
      ),
    );
  },
});

const ResourceList = defineComponent({
  name: "ResourceList",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    resources: z.array(
      z.object({
        title: z.string(),
        type: z.string().optional(),
        url: z.string().optional(),
        description: z.string().optional(),
        status: z.enum(["ready", "draft", "blocked", "external"]).optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Resource and link list for files, URLs, documents, artifacts, references, generated outputs, and handoff materials.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        props.resources.map((resource, index) => {
          const title = React.createElement("strong", { style: { color: hudText, fontSize: 14, overflowWrap: "anywhere" } }, resource.title);
          return React.createElement(
            "article",
            {
              key: `${resource.title}:${index}`,
              style: {
                background: hudPanelWash,
                border: `1px solid ${hudEdge}`,
                borderRadius: 8,
                padding: 12,
                ...readableGlassStyle,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" } },
              resource.url
                ? React.createElement("a", { href: resource.url, rel: "noreferrer", style: { textDecoration: "none" }, target: "_blank" }, title)
                : title,
              labelElement(resource.status ?? resource.type ?? "resource", resource.status === "blocked" ? "danger" : resource.status === "draft" ? "warning" : "info", "xs", { flexShrink: 0 }),
            ),
            resource.description
              ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.45, margin: "6px 0 0" } }, resource.description)
              : null,
            resource.url ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12, marginTop: 7, overflowWrap: "anywhere" } }, resource.url) : null,
          );
        }),
      ),
    ),
});

const FormPanel = defineComponent({
  name: "FormPanel",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    fields: z.array(
      z.object({
        label: z.string(),
        value: z.string().optional(),
        type: z.enum(["text", "number", "date", "select", "checkbox", "textarea"]).default("text"),
        required: z.boolean().optional(),
        status: z.enum(["valid", "missing", "review"]).optional(),
        help: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Read-only form summary for intake, approval, required inputs, user confirmation, request review, and missing-field explanations.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        props.fields.map((field, index) => {
          const tone = toneFor(field.status === "valid" ? "positive" : field.status === "missing" ? "danger" : "warning");
          return React.createElement(
            "label",
            {
              key: `${field.label}:${index}`,
              style: {
                background: hudPanelWash,
                border: `1px solid ${field.status ? tone.border : hudEdge}`,
                borderRadius: 8,
                display: "grid",
                gap: 6,
                padding: 10,
              },
            },
            React.createElement(
              "span",
              { style: { alignItems: "center", color: hudTextMid, display: "flex", flexWrap: "wrap", fontSize: 12, fontWeight: 800, gap: 6 } },
              labelElement(field.label, field.status === "valid" ? "positive" : field.status === "missing" ? "danger" : "neutral", "xs"),
              field.required ? labelElement("required", "danger", "xs") : null,
              field.status ? labelElement(field.status, field.status === "valid" ? "positive" : field.status === "missing" ? "danger" : "warning", "xs") : null,
            ),
            React.createElement(
              "div",
              {
                style: {
                  background: "rgba(2,18,32,0.20)",
                  border: `1px solid ${hudEdge}`,
                  borderRadius: 6,
                  color: field.value ? hudText : hudTextSoft,
                  fontSize: 14,
                  minHeight: field.type === "textarea" ? 72 : 36,
                  padding: "8px 9px",
                  whiteSpace: "pre-wrap",
                },
              },
              field.value || "Not provided",
            ),
            field.help ? React.createElement("span", { style: { color: hudTextSoft, fontSize: 12 } }, field.help) : null,
          );
        }),
      ),
    ),
});

const componentGroups: ComponentGroup[] = [
  ...(openuiLibrary.componentGroups ?? []),
  {
    name: "Agent Explanation",
    components: [
      "MetricGrid",
      "Label",
      "KeyValuePanel",
      "AlertList",
      "ProgressStepper",
      "BarChart",
      "LineChart",
      "ResourceList",
      "FormPanel",
      "ActionPanel",
      "TimelinePanel",
      "DecisionMatrix",
      "DataTable",
      "TaskBoard",
      "CodeDiff",
    ],
    notes: [
      "- Use MetricGrid for KPI summaries, health snapshots, and status at-a-glance.",
      "- Use KeyValuePanel for metadata, environment details, customer facts, and compact evidence.",
      "- Use AlertList for risks, blockers, validation findings, incidents, and warnings.",
      "- Use ProgressStepper for workflows, approvals, onboarding, release steps, and investigations.",
      "- Use BarChart for category comparison, rankings, volumes, counts, and cost breakdowns.",
      "- Use LineChart for trend, forecast, time-series, backlog, and metric movement.",
      "- Use ResourceList for files, URLs, docs, generated outputs, and references.",
      "- Use FormPanel for input review, missing fields, intake summaries, and approval requests.",
      "- Use ActionPanel whenever the UI should tell the user what to do next.",
      "- Use TimelinePanel for chronological explanations, incident flow, launches, and multi-step progress.",
      "- Use DecisionMatrix when comparing options or making a recommendation.",
      "- Use DataTable when the user needs to inspect structured rows or compare records.",
      "- Use TaskBoard when explaining work status, queues, triage lanes, or multi-agent handoffs.",
      "- Use CodeDiff for code, config, prompt, or document change review.",
    ],
  },
  {
    name: "Maps",
    components: ["MapView"],
    notes: [
      "- Use MapView whenever the user asks for a map, locations, geography, stores, customers, incidents, sites, routes, or nearby places.",
      "- MapView requires center: { lat, lng }, zoom, and markers with lat/lng/label. Use real coordinates when known; otherwise use clearly approximate coordinates.",
      "- Marker colors: red, blue, green, yellow, purple, gray.",
    ],
  },
  {
    name: "Media",
    components: ["AudioPlayer", "VideoPlayer"],
    notes: [
      "- Use AudioPlayer for music, generated speech/audio, podcasts, meeting recordings, and sound previews. Never autoplay.",
      "- Use VideoPlayer for demos, screen recordings, walkthroughs, clips, tutorials, and visual evidence. Never autoplay.",
      "- Prefer caller-provided media URLs. If no URL is available, explain that media source is required or use a clearly labeled sample only for demos.",
    ],
  },
];

const customComponents = [
  Card,
  CardHeader,
  Label,
  MetricGrid,
  KeyValuePanel,
  AlertList,
  ProgressStepper,
  BarChart,
  LineChart,
  ResourceList,
  FormPanel,
  ActionPanel,
  TimelinePanel,
  DecisionMatrix,
  DataTable,
  TaskBoard,
  CodeDiff,
  MapView,
  AudioPlayer,
  VideoPlayer,
];
const customComponentNames = new Set([
  "Card",
  "CardHeader",
  "Label",
  "MetricGrid",
  "KeyValuePanel",
  "AlertList",
  "ProgressStepper",
  "BarChart",
  "LineChart",
  "ResourceList",
  "FormPanel",
  "ActionPanel",
  "TimelinePanel",
  "DecisionMatrix",
  "DataTable",
  "TaskBoard",
  "CodeDiff",
  "MapView",
  "AudioPlayer",
  "VideoPlayer",
]);
const baseComponents = Object.entries(openuiLibrary.components)
  .filter(([name]) => !customComponentNames.has(name))
  .map(([, component]) => component);

export const library = createLibrary({
  components: [...baseComponents, ...customComponents],
  componentGroups,
  root: openuiLibrary.root,
});

export const promptOptions: PromptOptions = {
  ...openuiPromptOptions,
  additionalRules: [
    ...(openuiPromptOptions.additionalRules ?? []),
    "For KPI summaries, status snapshots, and dashboards, prefer MetricGrid(title, description, metrics).",
    "Use Label(text, tone, size, inkPreset, glassPreset, glassColor, glassOpacity) for status, priority, count, tag, and compact text badges instead of ad-hoc inline spans. Prefer inkPreset values: green, slate, white, blue, amber, red.",
    'All custom Liquid Glass components accept glassPreset, glassColor, and glassOpacity. Prefer glassPreset first: "clear", "pane", "milky", "dense", "mint", "sky", "rose", or "amber". Use glassColor/glassOpacity only to override the preset; keep glassOpacity between 0 and 1.',
    "For metadata, facts, environment details, and compact evidence, prefer KeyValuePanel(title, description, items).",
    "For risks, blockers, warnings, validation findings, and incident signals, prefer AlertList(title, description, alerts).",
    "For staged progress, approvals, onboarding, investigations, and release steps, prefer ProgressStepper(title, description, steps).",
    "For rankings, counts, volumes, costs, and category comparison, prefer BarChart(title, description, unit, max, data).",
    "For trends, forecasts, time series, backlog movement, and metric changes, prefer LineChart(title, description, unit, data).",
    "For files, URLs, docs, generated artifacts, and references, prefer ResourceList(title, description, resources).",
    "For required inputs, intake review, confirmation, and missing fields, prefer FormPanel(title, description, fields).",
    "For recommended next steps, approvals, handoffs, and follow-up work, prefer ActionPanel(title, description, actions).",
    "For chronological explanations, incidents, launches, or multi-step progress, prefer TimelinePanel(title, description, events).",
    "For alternatives, tradeoffs, or recommendations, prefer DecisionMatrix(title, description, options).",
    "For structured rows, evidence, tickets, files, search results, or ranked lists, prefer DataTable(title, description, columns, rows, caption).",
    "For task queues, implementation plans, QA status, triage lanes, or multi-agent handoffs, prefer TaskBoard(title, description, columns).",
    "For code, config, prompt, or document changes, prefer CodeDiff(title, description, files).",
    "For map requests, use MapView(title, description, center, zoom, height, markers) as part of the UI. Include useful marker labels and colors.",
    "For audio or music requests, use AudioPlayer(title, description, tracks). Do not autoplay. Prefer provided audio URLs.",
    "For video requests, use VideoPlayer(title, description, src, posterUrl, transcript, chapters). Do not autoplay. Prefer provided video URLs.",
  ],
  examples: [
    ...(openuiPromptOptions.examples ?? []),
    `Agent explanation example:

root = Card([header, metrics, timeline, actions])
header = CardHeader("Launch Readiness", "Agent-generated status summary")
metrics = MetricGrid("Key signals", "Current launch posture", [m1, m2, m3])
m1 = { label: "Build", value: "Passing", delta: "0 blockers", tone: "positive", description: "CI is green on the release branch" }
m2 = { label: "Risk", value: "Medium", delta: "2 watch items", tone: "warning", description: "Support staffing and migration docs need review" }
m3 = { label: "ETA", value: "Fri 15:00", tone: "info", description: "Ready if review completes by noon" }
timeline = TimelinePanel("Path to ship", "What has happened and what remains", [e1, e2, e3])
e1 = { time: "09:00", title: "Build verified", status: "done", description: "Automated checks completed" }
e2 = { time: "Now", title: "Human review", status: "active", description: "Reviewing visual behavior and docs" }
e3 = { time: "Next", title: "Release decision", status: "planned", description: "Approve, defer, or narrow scope" }
actions = ActionPanel("Recommended next actions", "Use these to finish the workflow", [a1, a2])
a1 = { label: "Review settings popup", priority: "high", owner: "user", due: "today", description: "Confirm UI is readable in light and dark themes" }
a2 = { label: "Restart broker", priority: "medium", owner: "agent", description: "Load the latest protocol and component catalog" }`,
    `Operational table example:

root = Card([header, table, actions])
header = CardHeader("Ticket Triage", "Rows that need human attention")
table = DataTable("Open tickets", "Sorted by urgency", [c1, c2, c3, c4], [r1, r2], "Sample operational table")
c1 = { key: "id", label: "ID" }
c2 = { key: "customer", label: "Customer" }
c3 = { key: "urgency", label: "Urgency" }
c4 = { key: "next", label: "Next action" }
r1 = { id: "SUP-1842", customer: "Northstar Retail", urgency: "Critical", next: "Escalate to payments owner" }
r2 = { id: "SUP-1839", customer: "Aoba Logistics", urgency: "High", next: "Send export workaround" }
actions = ActionPanel("Recommended actions", "Use table rows to pick the next move", [a1])
a1 = { label: "Handle critical ticket first", priority: "critical", owner: "support lead" }`,
    `Task board example:

root = Card([header, board])
header = CardHeader("Agent Work Plan", "Current state of a multi-step task")
board = TaskBoard("Workflow board", "Compact handoff lanes", [todo, doing, done])
todo = { title: "Todo", tone: "neutral", items: [t1] }
doing = { title: "Doing", tone: "info", items: [t2] }
done = { title: "Done", tone: "positive", items: [t3] }
t1 = { title: "Add regression test", owner: "agent", status: "next" }
t2 = { title: "Verify popup layout", owner: "user", status: "active" }
t3 = { title: "Document CLI", owner: "agent", status: "done" }`,
    `Code diff example:

root = Card([header, diff, actions])
header = CardHeader("Patch Review", "Generated change summary")
diff = CodeDiff("Config change", "Review before applying", [file1])
file1 = { path: "settings.json", language: "json", additions: 2, deletions: 1, hunks: [h1] }
h1 = { title: "@@ settings @@", lines: [l1, l2, l3] }
l1 = { type: "context", content: "{\\"theme\\": \\"dark\\"," }
l2 = { type: "remove", content: "\\"density\\": \\"compact\\"" }
l3 = { type: "add", content: "\\"density\\": \\"comfortable\\"" }
actions = ActionPanel("Review outcome", "Next step", [a1])
a1 = { label: "Apply after approval", priority: "medium", owner: "agent" }`,
    `Map example:

root = Card([header, map, followups])
header = CardHeader("Tokyo Customer Map", "Priority customer sites around central Tokyo")
map = MapView("Customer locations", "Markers show priority by color", { lat: 35.6812, lng: 139.7671 }, 11, 360, [tokyo, shinjuku, shinagawa])
tokyo = { lat: 35.6812, lng: 139.7671, label: "Tokyo Station", description: "Enterprise account", color: "red" }
shinjuku = { lat: 35.6909, lng: 139.7003, label: "Shinjuku", description: "Support escalation", color: "yellow" }
shinagawa = { lat: 35.6285, lng: 139.7388, label: "Shinagawa", description: "Expansion candidate", color: "green" }
followups = FollowUpBlock([fu1])
fu1 = FollowUpItem("Filter to high priority only")`,
    `Audio example:

root = Card([header, player])
header = CardHeader("Podcast Preview", "Review the generated voice note")
player = AudioPlayer("Episode draft", "Two candidate audio takes", [track1, track2])
track1 = { title: "Short intro", artist: "Agent", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3", description: "Demo audio sample" }
track2 = { title: "Alternate cut", artist: "Agent", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3" }`,
    `Video example:

root = Card([header, video])
header = CardHeader("Feature Walkthrough", "Watch the prototype flow")
video = VideoPlayer("Checkout demo", "Screen recording with key moments", "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", null, "Transcript or notes can go here.", [chapter1])
chapter1 = { time: "00:05", title: "Main interaction", description: "User opens the popup and reviews the generated UI" }`,
  ],
};
