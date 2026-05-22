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

const markerColors: Record<NonNullable<MapMarker["color"]>, string> = {
  blue: "#2563eb",
  gray: "#525252",
  green: "#16a34a",
  purple: "#7c3aed",
  red: "#dc2626",
  yellow: "#ca8a04",
};

const toneStyles: Record<string, { accent: string; background: string; border: string; text: string }> = {
  critical: { accent: "#dc2626", background: "#fef2f2", border: "#fecaca", text: "#7f1d1d" },
  danger: { accent: "#dc2626", background: "#fef2f2", border: "#fecaca", text: "#7f1d1d" },
  warning: { accent: "#d97706", background: "#fffbeb", border: "#fde68a", text: "#78350f" },
  positive: { accent: "#16a34a", background: "#f0fdf4", border: "#bbf7d0", text: "#14532d" },
  neutral: { accent: "#525252", background: "#fafafa", border: "#e5e5e5", text: "#171717" },
  info: { accent: "#2563eb", background: "#eff6ff", border: "#bfdbfe", text: "#1e3a8a" },
};

function toneFor(value?: string) {
  return toneStyles[value ?? "neutral"] ?? toneStyles.neutral;
}

const panelStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #d4d4d4",
  borderRadius: 8,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
  color: "#171717",
  overflow: "hidden",
};

function panelHeader(title?: string, description?: string): React.ReactNode {
  if (!title && !description) {
    return null;
  }

  return React.createElement(
    "div",
    { style: { borderBottom: "1px solid #e5e5e5", padding: "12px 14px" } },
    title ? React.createElement("h3", { style: { color: "#171717", fontSize: 16, fontWeight: 700, margin: 0 } }, title) : null,
    description
      ? React.createElement(
          "p",
          { style: { color: "#525252", fontSize: 13, lineHeight: 1.5, margin: title ? "4px 0 0" : 0 } },
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
      {
        style: {
          background: "#ffffff",
          border: "1px solid #d4d4d4",
          borderRadius: 8,
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
          overflow: "hidden",
        },
      },
      props.title || props.description
        ? React.createElement(
            "div",
            { style: { borderBottom: "1px solid #e5e5e5", padding: "12px 14px" } },
            props.title
              ? React.createElement("h3", { style: { color: "#171717", fontSize: 16, fontWeight: 700, margin: 0 } }, props.title)
              : null,
            props.description
              ? React.createElement(
                  "p",
                  { style: { color: "#525252", fontSize: 13, lineHeight: 1.5, margin: props.title ? "4px 0 0" : 0 } },
                  props.description,
                )
              : null,
          )
        : null,
      React.createElement(
        "div",
        {
          role: "img",
          "aria-label": props.title ?? "Map",
          style: {
            background: "#dbeafe",
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
                border: "2px solid #fff",
                borderRadius: "999px 999px 999px 0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
                height: 20,
                transform: "rotate(-45deg)",
                width: 20,
              },
            }),
            React.createElement(
              "div",
              {
                style: {
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #e5e5e5",
                  borderRadius: 6,
                  color: "#171717",
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
              background: "rgba(255,255,255,0.9)",
              bottom: 6,
              color: "#404040",
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
  }),
  description:
    "Audio playlist player for music, generated audio, voice notes, podcasts, meeting recordings, and sound previews. Each track needs title and src; artist, coverUrl, and description are optional.",
  component: ({ props }) =>
    React.createElement(
      "section",
      {
        style: {
          background: "#fff",
          border: "1px solid #d4d4d4",
          borderRadius: 8,
          overflow: "hidden",
        },
      },
      props.title || props.description
        ? React.createElement(
            "div",
            { style: { borderBottom: "1px solid #e5e5e5", padding: "12px 14px" } },
            props.title
              ? React.createElement("h3", { style: { color: "#171717", fontSize: 16, fontWeight: 700, margin: 0 } }, props.title)
              : null,
            props.description
              ? React.createElement(
                  "p",
                  { style: { color: "#525252", fontSize: 13, lineHeight: 1.5, margin: props.title ? "4px 0 0" : 0 } },
                  props.description,
                )
              : null,
          )
        : null,
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
                background: "#fafafa",
                border: "1px solid #e5e5e5",
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
              React.createElement("div", { style: { color: "#171717", fontSize: 14, fontWeight: 700 } }, track.title),
              track.artist
                ? React.createElement("div", { style: { color: "#737373", fontSize: 12, marginTop: 2 } }, track.artist)
                : null,
              track.description
                ? React.createElement("p", { style: { color: "#525252", fontSize: 12, lineHeight: 1.5, margin: "6px 0" } }, track.description)
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
  }),
  description:
    "Video player for demos, screen recordings, generated clips, design walkthroughs, tutorials, and incident evidence. Supports src, posterUrl, transcript, and chapter list.",
  component: ({ props }) =>
    React.createElement(
      "section",
      {
        style: {
          background: "#fff",
          border: "1px solid #d4d4d4",
          borderRadius: 8,
          overflow: "hidden",
        },
      },
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
          ? React.createElement("h3", { style: { color: "#171717", fontSize: 16, fontWeight: 700, margin: 0 } }, props.title)
          : null,
        props.description
          ? React.createElement("p", { style: { color: "#525252", fontSize: 13, lineHeight: 1.5, margin: props.title ? "4px 0 0" : 0 } }, props.description)
          : null,
        props.chapters?.length
          ? React.createElement(
              "ol",
              { style: { color: "#262626", display: "grid", gap: 8, margin: "12px 0 0", paddingLeft: 18 } },
              props.chapters.map((chapter, index) =>
                React.createElement(
                  "li",
                  { key: `${chapter.time}:${index}` },
                  React.createElement("strong", null, `${chapter.time} ${chapter.title}`),
                  chapter.description ? React.createElement("div", { style: { color: "#737373", fontSize: 12 } }, chapter.description) : null,
                ),
              ),
            )
          : null,
        props.transcript
          ? React.createElement(
              "details",
              { style: { marginTop: 12 } },
              React.createElement("summary", { style: { color: "#171717", cursor: "pointer", fontSize: 13, fontWeight: 700 } }, "Transcript"),
              React.createElement("p", { style: { color: "#525252", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, props.transcript),
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
  }),
  description:
    "Responsive KPI and summary metric grid for dashboards, status reports, operational snapshots, progress summaries, and executive explanations.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
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
              },
            },
            React.createElement("div", { style: { color: "#525252", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em" } }, metric.label),
            React.createElement("div", { style: { color: tone.text, fontSize: 24, fontWeight: 800, lineHeight: 1.15, marginTop: 6 } }, metric.value),
            metric.delta
              ? React.createElement("div", { style: { color: tone.accent, fontSize: 12, fontWeight: 700, marginTop: 6 } }, metric.delta)
              : null,
            metric.description
              ? React.createElement("p", { style: { color: "#525252", fontSize: 12, lineHeight: 1.45, margin: "7px 0 0" } }, metric.description)
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
  }),
  description:
    "Prioritized next-action panel for recommendations, handoffs, agent plans, approvals, follow-up work, and user-visible task lists.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
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
                background: "#fafafa",
                border: "1px solid #e5e5e5",
                borderLeft: `4px solid ${tone.accent}`,
                borderRadius: 8,
                padding: 12,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: "#171717", fontSize: 14, lineHeight: 1.35 } }, action.label),
              React.createElement(
                "span",
                {
                  style: {
                    background: tone.background,
                    border: `1px solid ${tone.border}`,
                    borderRadius: 999,
                    color: tone.text,
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "2px 8px",
                    textTransform: "uppercase",
                  },
                },
                action.priority,
              ),
            ),
            action.description
              ? React.createElement("p", { style: { color: "#525252", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" } }, action.description)
              : null,
            action.owner || action.due
              ? React.createElement(
                  "div",
                  { style: { color: "#737373", display: "flex", flexWrap: "wrap", fontSize: 12, gap: 8, marginTop: 8 } },
                  action.owner ? React.createElement("span", null, `Owner: ${action.owner}`) : null,
                  action.due ? React.createElement("span", null, `Due: ${action.due}`) : null,
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
  }),
  description:
    "Chronological timeline for incidents, launches, project plans, research history, deployment progress, and multi-step explanations.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
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
            React.createElement("time", { style: { color: "#737373", fontSize: 12, fontWeight: 700, paddingTop: 2 } }, event.time),
            React.createElement(
              "span",
              { style: { alignItems: "center", display: "flex", flexDirection: "column" } },
              React.createElement("span", {
                style: {
                  background: tone.accent,
                  border: "2px solid #fff",
                  borderRadius: 999,
                  boxShadow: `0 0 0 2px ${tone.border}`,
                  height: 10,
                  marginTop: 4,
                  width: 10,
                },
              }),
              index < props.events.length - 1 ? React.createElement("span", { style: { background: "#e5e5e5", flex: 1, marginTop: 4, width: 1 } }) : null,
            ),
            React.createElement(
              "div",
              { style: { paddingBottom: 14 } },
              React.createElement("strong", { style: { color: "#171717", display: "block", fontSize: 14 } }, event.title),
              event.description ? React.createElement("p", { style: { color: "#525252", fontSize: 13, lineHeight: 1.5, margin: "4px 0 0" } }, event.description) : null,
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
  }),
  description:
    "Comparison matrix for choices, recommendations, tradeoffs, vendor/tool selection, design alternatives, and agent decision support.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
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
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: tone.text, fontSize: 15 } }, option.name),
              option.score ? React.createElement("span", { style: { color: tone.accent, fontSize: 13, fontWeight: 800 } }, option.score) : null,
            ),
            option.summary ? React.createElement("p", { style: { color: "#525252", fontSize: 13, lineHeight: 1.45, margin: 0 } }, option.summary) : null,
            option.pros.length
              ? React.createElement(
                  "ul",
                  { style: { color: "#262626", fontSize: 12, lineHeight: 1.45, margin: 0, paddingLeft: 18 } },
                  option.pros.map((pro, proIndex) => React.createElement("li", { key: `${pro}:${proIndex}` }, pro)),
                )
              : null,
            option.cons.length
              ? React.createElement(
                  "ul",
                  { style: { color: "#737373", fontSize: 12, lineHeight: 1.45, margin: 0, paddingLeft: 18 } },
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
  }),
  description:
    "Responsive data table for operational rows, ticket lists, file inventories, research results, rankings, and structured evidence. Use when users need to scan or compare records.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { overflowX: "auto", overscrollBehaviorX: "contain", scrollbarGutter: "stable", width: "100%" } },
        React.createElement(
          "table",
          { style: { borderCollapse: "collapse", minWidth: Math.max(520, props.columns.length * 140), width: "100%" } },
          props.caption ? React.createElement("caption", { style: { color: "#525252", fontSize: 12, padding: 10, textAlign: "left" } }, props.caption) : null,
          React.createElement(
            "thead",
            { style: { background: "#f5f5f5" } },
            React.createElement(
              "tr",
              null,
              props.columns.map((column) =>
                React.createElement(
                  "th",
                  {
                    key: column.key,
                    style: {
                      borderBottom: "1px solid #d4d4d4",
                      color: "#404040",
                      fontSize: 12,
                      fontWeight: 800,
                      padding: "9px 10px",
                      textAlign: column.align ?? "left",
                      whiteSpace: "nowrap",
                    },
                  },
                  column.label,
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
                { key: `row:${rowIndex}`, style: { background: rowIndex % 2 === 0 ? "#fff" : "#fafafa" } },
                props.columns.map((column) =>
                  React.createElement(
                    "td",
                    {
                      key: `${rowIndex}:${column.key}`,
                      style: {
                        borderBottom: "1px solid #e5e5e5",
                        color: "#262626",
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
  }),
  description:
    "Compact task board for agent plans, handoffs, triage, implementation status, QA queues, and multi-owner workflows.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
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
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between", marginBottom: 10 } },
              React.createElement("h4", { style: { color: tone.text, fontSize: 13, fontWeight: 800, margin: 0 } }, column.title),
              React.createElement(
                "span",
                {
                  style: {
                    background: "#fff",
                    border: `1px solid ${tone.border}`,
                    borderRadius: 999,
                    color: tone.text,
                    fontSize: 11,
                    fontWeight: 800,
                    padding: "1px 7px",
                  },
                },
                column.items.length,
              ),
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
                      background: "rgba(255,255,255,0.88)",
                      border: "1px solid rgba(212,212,212,0.9)",
                      borderRadius: 7,
                      padding: 9,
                    },
                  },
                  React.createElement("strong", { style: { color: "#171717", display: "block", fontSize: 13, lineHeight: 1.35 } }, item.title),
                  item.description
                    ? React.createElement("p", { style: { color: "#525252", fontSize: 12, lineHeight: 1.45, margin: "5px 0 0" } }, item.description)
                    : null,
                  item.owner || item.status
                    ? React.createElement(
                        "div",
                        { style: { color: "#737373", display: "flex", flexWrap: "wrap", fontSize: 11, gap: 6, marginTop: 7 } },
                        item.owner ? React.createElement("span", null, item.owner) : null,
                        item.status ? React.createElement("span", null, item.status) : null,
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
  }),
  description:
    "Readable code/config/document diff viewer for review summaries, generated patches, config changes, migration previews, and agent handoffs.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyle },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        props.files.map((file, index) =>
          React.createElement(
            "article",
            { key: `${file.path}:${index}`, style: { border: "1px solid #d4d4d4", borderRadius: 8, overflow: "hidden" } },
            React.createElement(
              "div",
              {
                style: {
                  alignItems: "center",
                  background: "#f5f5f5",
                  borderBottom: "1px solid #d4d4d4",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "space-between",
                  padding: "8px 10px",
                },
              },
              React.createElement("strong", { style: { color: "#171717", fontSize: 13, overflowWrap: "anywhere" } }, file.path),
              React.createElement(
                "span",
                { style: { color: "#525252", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 } },
                `+${file.additions ?? 0} / -${file.deletions ?? 0}${file.language ? ` · ${file.language}` : ""}`,
              ),
            ),
            file.hunks.map((hunk, hunkIndex) =>
              React.createElement(
                "div",
                { key: `${file.path}:hunk:${hunkIndex}` },
                hunk.title
                  ? React.createElement("div", { style: { background: "#fafafa", color: "#525252", fontSize: 12, padding: "6px 10px" } }, hunk.title)
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

const componentGroups: ComponentGroup[] = [
  ...(openuiLibrary.componentGroups ?? []),
  {
    name: "Agent Explanation",
    components: ["MetricGrid", "ActionPanel", "TimelinePanel", "DecisionMatrix", "DataTable", "TaskBoard", "CodeDiff"],
    notes: [
      "- Use MetricGrid for KPI summaries, health snapshots, and status at-a-glance.",
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

export const library = createLibrary({
  components: [
    ...Object.values(openuiLibrary.components),
    MetricGrid,
    ActionPanel,
    TimelinePanel,
    DecisionMatrix,
    DataTable,
    TaskBoard,
    CodeDiff,
    MapView,
    AudioPlayer,
    VideoPlayer,
  ],
  componentGroups,
  root: openuiLibrary.root,
});

export const promptOptions: PromptOptions = {
  ...openuiPromptOptions,
  additionalRules: [
    ...(openuiPromptOptions.additionalRules ?? []),
    "For KPI summaries, status snapshots, and dashboards, prefer MetricGrid(title, description, metrics).",
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
