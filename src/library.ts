import React from "react";
import dynamic from "next/dynamic";
import { createLibrary, defineComponent, type ComponentGroup, type PromptOptions } from "@openuidev/react-lang";
import { openuiLibrary, openuiPromptOptions } from "@openuidev/react-ui/genui-lib";
import { z } from "zod/v4";

export type PopupEventInput = {
  kind: "action" | "input" | "submit" | "message";
  component: string;
  actionId: string;
  label?: string;
  value?: unknown;
  fields?: Record<string, unknown>;
};

export type PopupEventOptions = {
  complete?: boolean;
  outcome?: "completed" | "cancelled" | "failed";
};

export type PopupEventReporter = (event: PopupEventInput, options?: PopupEventOptions) => void | Promise<void>;

export const PopupEventContext = React.createContext<PopupEventReporter | null>(null);
export const GenUIRuntimeDataContext = React.createContext<Record<string, unknown> | null>(null);

function popupEventConsumer(render: (reporter: PopupEventReporter | null) => React.ReactNode): React.ReactElement {
  return React.createElement(PopupEventContext.Consumer, null, render as unknown as React.ReactNode);
}

function runtimeDataConsumer(render: (data: Record<string, unknown> | null) => React.ReactNode): React.ReactElement {
  return React.createElement(GenUIRuntimeDataContext.Consumer, null, render as unknown as React.ReactNode);
}

function emitPopupEvent(reporter: PopupEventReporter | null, event: PopupEventInput, options?: PopupEventOptions): void {
  if (!reporter) return;
  void reporter(event, options);
}

function actionIdFor(component: string, actionId: string | undefined, fallback: string): string {
  return actionId?.trim() || `${component}.${fallback}`;
}

function getContextPathValue(source: Record<string, unknown> | null, contextPath?: string): unknown {
  if (!source || !contextPath?.trim()) return undefined;

  return contextPath.split(".").reduce<unknown>((current, rawSegment) => {
    if (current === undefined || current === null) return undefined;
    const segment = rawSegment.trim();
    if (!segment) return undefined;

    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current === "object" && Object.prototype.hasOwnProperty.call(current, segment)) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, source);
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function contextRowValue(row: Record<string, unknown>, key: string | undefined, fallbackKeys: string[]): unknown {
  const keys = key ? [key] : fallbackKeys;

  for (const candidate of keys) {
    const value = getContextPathValue(row, candidate);
    if (value !== undefined) return value;
  }

  return undefined;
}

function normalizeSingleSeriesData(
  value: unknown,
  options: {
    labelKey?: string;
    valueKey?: string;
    toneKey?: string;
  } = {},
): Array<{ label: string; value: number; tone?: "positive" | "neutral" | "warning" | "danger" | "info" }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const label = contextRowValue(row, options.labelKey, ["label", "date", "day", "period", "name", "key"]) ?? `#${index + 1}`;
    const rawValue = contextRowValue(row, options.valueKey, ["value", "count", "views", "pv", "sessions", "users", "total"]);
    const valueNumber = numericValue(rawValue);
    if (valueNumber === undefined) return [];
    const tone = contextRowValue(row, options.toneKey, ["tone"]);
    const normalizedTone =
      tone === "positive" || tone === "neutral" || tone === "warning" || tone === "danger" || tone === "info"
        ? tone
        : undefined;

    return [{ label: String(label), value: valueNumber, tone: normalizedTone }];
  });
}

function normalizeComboSeriesData(
  value: unknown,
  options: {
    labelKey?: string;
    barValueKey?: string;
    lineValueKey?: string;
  } = {},
): Array<{ label: string; barValue: number; lineValue: number }> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const label = contextRowValue(row, options.labelKey, ["label", "date", "day", "period", "name", "key"]) ?? `#${index + 1}`;
    const rawBarValue = contextRowValue(row, options.barValueKey, ["barValue", "bar", "value", "count", "views", "pv", "sessions"]);
    const rawLineValue = contextRowValue(row, options.lineValueKey, ["lineValue", "line", "rate", "cvr", "conversionRate", "ratio"]);
    const barValue = numericValue(rawBarValue);
    const lineValue = numericValue(rawLineValue);
    if (barValue === undefined || lineValue === undefined) return [];

    return [{ label: String(label), barValue, lineValue }];
  });
}

function normalizeRecordRows(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    return [item as Record<string, unknown>];
  });
}

function inferColumnsFromRows(rows: Array<Record<string, unknown>>): Array<{ key: string; label: string }> {
  return Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).map((key) => ({ key, label: key }));
}

function inferSchemaFromRows(rows: Array<Record<string, unknown>>): Array<{ name: string; type?: string; nullable?: boolean }> {
  return inferColumnsFromRows(rows).map(({ key }) => {
    const values = rows.map((row) => row[key]);
    const firstPresent = values.find((value) => value !== null && value !== undefined);
    const type =
      Array.isArray(firstPresent)
        ? "array"
        : firstPresent === undefined
        ? "unknown"
        : typeof firstPresent;
    return {
      name: key,
      type,
      nullable: values.some((value) => value === null || value === undefined) || undefined,
    };
  });
}

type MapWithListProps = {
  title?: string;
  description?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  items: Array<{
    id: string;
    lat: number;
    lng: number;
    label: string;
    description?: string;
    category?: string;
    color?: "red" | "blue" | "green" | "yellow" | "purple" | "gray";
  }>;
};

const MapWithListDynamic = dynamic<MapWithListProps>(() => import("./app/_ui/MapWithList.js").then((mod) => mod.default), {
  ssr: false,
  loading: () =>
    React.createElement(
      "div",
      {
        style: {
          alignItems: "center",
          background: "rgba(2, 18, 32, 0.18)",
          border: "1px solid rgba(128, 226, 255, 0.18)",
          borderRadius: 10,
          color: "rgba(228, 244, 251, 0.86)",
          display: "flex",
          fontSize: 13,
          height: 280,
          justifyContent: "center",
          padding: 14,
        },
      },
      "Loading map…",
    ),
});

type VideoEmbedSource =
  | { kind: "native"; src: string }
  | { kind: "iframe"; src: string; provider: "YouTube"; sourceUrl: string };

type ResolveVideoEmbedOptions = {
  autoplay?: boolean;
};

function parseTimestampSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!match) {
    return null;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;
  const total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  return total > 0 ? total : null;
}

function youtubeIdFromPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  if (["embed", "shorts", "live"].includes(segments[0]) && segments[1]) {
    return segments[1];
  }

  return segments[0];
}

function normalizeYouTubeEmbedUrl(src: string, options: ResolveVideoEmbedOptions = {}): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const isYouTube = host === "youtube.com" || host === "youtube-nocookie.com";
  const isShortYouTube = host === "youtu.be";
  if (!isYouTube && !isShortYouTube) {
    return null;
  }

  const videoId = isShortYouTube ? youtubeIdFromPath(url.pathname) : url.searchParams.get("v") ?? youtubeIdFromPath(url.pathname);
  if (!videoId || !/^[\w-]{6,}$/.test(videoId)) {
    return null;
  }

  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  embedUrl.searchParams.set("rel", "0");
  if (options.autoplay) {
    embedUrl.searchParams.set("autoplay", "1");
    embedUrl.searchParams.set("mute", "1");
  }

  const start = parseTimestampSeconds(url.searchParams.get("start") ?? url.searchParams.get("t"));
  if (start) {
    embedUrl.searchParams.set("start", String(start));
  }

  const playlist = url.searchParams.get("list");
  if (playlist) {
    embedUrl.searchParams.set("list", playlist);
  }

  return embedUrl.toString();
}

export function resolveVideoEmbedSource(src: string, options: ResolveVideoEmbedOptions = {}): VideoEmbedSource {
  const youtubeEmbedUrl = normalizeYouTubeEmbedUrl(src, options);
  if (youtubeEmbedUrl) {
    return { kind: "iframe", provider: "YouTube", sourceUrl: src, src: youtubeEmbedUrl };
  }

  return { kind: "native", src };
}

function renderVideoSurface({
  autoplay = false,
  posterUrl,
  src,
  title,
}: {
  autoplay?: boolean;
  posterUrl?: string;
  src: string;
  title?: string;
}): React.ReactElement {
  const media = resolveVideoEmbedSource(src, { autoplay });
  if (media.kind === "iframe") {
    return React.createElement(
      "figure",
      { style: { margin: 0 } },
      React.createElement("iframe", {
        allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        allowFullScreen: true,
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
        src: media.src,
        style: {
          aspectRatio: "16 / 9",
          background: "#0a0a0a",
          border: 0,
          display: "block",
          width: "100%",
        },
        title: title ? `${title} (${media.provider})` : `${media.provider} video`,
      }),
      React.createElement(
        "figcaption",
        {
          style: {
            alignItems: "center",
            borderTop: `1px solid ${hudEdge}`,
            color: hudTextSoft,
            display: "flex",
            flexWrap: "wrap",
            fontSize: 12,
            gap: 8,
            justifyContent: "space-between",
            padding: "8px 10px",
          },
        },
        React.createElement("span", null, `${media.provider} embed`),
        React.createElement(
          "a",
          {
            href: media.sourceUrl,
            rel: "noreferrer",
            style: { color: hudTextMid, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 },
            target: "_blank",
          },
          "Open externally",
        ),
      ),
    );
  }

  return React.createElement(
    "figure",
    { style: { margin: 0 } },
    React.createElement("video", {
      autoPlay: autoplay,
      controls: true,
      muted: autoplay,
      playsInline: true,
      poster: posterUrl,
      preload: "metadata",
      src: media.src,
      style: { background: "#0a0a0a", display: "block", width: "100%" },
    }),
    React.createElement(
      "figcaption",
      {
        style: {
          borderTop: `1px solid ${hudEdge}`,
          color: hudTextSoft,
          fontSize: 12,
          padding: "8px 10px",
        },
      },
      React.createElement(
        "a",
        {
          href: media.src,
          rel: "noreferrer",
          style: { color: hudTextMid, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 },
          target: "_blank",
        },
        "Open video source",
      ),
    ),
  );
}
import {
  Bar as RcBar,
  BarChart as RcBarChart,
  ComposedChart as RcComposedChart,
  Legend as RcLegend,
  CartesianGrid as RcCartesianGrid,
  Cell as RcCell,
  Line as RcLine,
  LineChart as RcLineChart,
  Pie as RcPie,
  PieChart as RcPieChart,
  ResponsiveContainer as RcResponsiveContainer,
  Tooltip as RcTooltip,
  XAxis as RcXAxis,
  YAxis as RcYAxis,
} from "recharts";

const chartPalette = {
  line: "rgba(142, 182, 92, 0.95)",
  grid: "rgba(138, 166, 126, 0.18)",
  axis: "rgba(204, 222, 184, 0.70)",
  axisLabel: "rgba(224, 236, 206, 0.86)",
  tooltipBg: "#07110d",
  tooltipBorder: "rgba(210, 238, 204, 0.42)",
  tooltipText: "#f8fdff",
  tooltipMuted: "rgba(232, 245, 236, 0.84)",
  bar: "rgba(126, 174, 86, 0.78)",
  area: "rgba(126, 174, 86, 0.28)",
};

const donutColors = [
  "rgba(126, 174, 86, 0.92)",
  "rgba(176, 142, 72, 0.90)",
  "rgba(82, 132, 92, 0.88)",
  "rgba(72, 114, 138, 0.86)",
  "rgba(148, 72, 82, 0.88)",
  "rgba(134, 150, 116, 0.86)",
  "rgba(204, 176, 88, 0.88)",
  "rgba(92, 126, 72, 0.88)",
];

const chartAxisTickStyle = { fill: chartPalette.axisLabel, fontSize: 11 } as const;

export const chartTooltipStyle = {
  contentStyle: {
    background: chartPalette.tooltipBg,
    backgroundColor: chartPalette.tooltipBg,
    border: `1px solid ${chartPalette.tooltipBorder}`,
    borderRadius: 8,
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.38)",
    color: chartPalette.tooltipText,
    colorScheme: "dark",
    fontSize: 12,
  },
  itemStyle: {
    color: chartPalette.tooltipText,
    fontSize: 12,
    fontWeight: 760,
  },
  labelStyle: {
    color: chartPalette.tooltipMuted,
    fontSize: 11,
    fontWeight: 800,
  },
  wrapperStyle: {
    color: chartPalette.tooltipText,
    outline: "none",
    zIndex: 20,
  },
} satisfies {
  contentStyle: React.CSSProperties;
  itemStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  wrapperStyle: React.CSSProperties;
};

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

const hudText = "var(--lg-component-text, rgba(248, 253, 255, 0.98))";
const hudTextMid = "var(--lg-component-text-mid, rgba(228, 244, 251, 0.90))";
const hudTextSoft = "var(--lg-component-text-soft, rgba(206, 230, 240, 0.78))";
const hudTextShadow =
  "var(--lg-component-text-shadow, 0 1px 2px rgba(20, 28, 22, 0.46), 0 8px 24px rgba(20, 28, 22, 0.28))";
const hudEdge = "var(--lg-component-edge, rgba(130, 180, 118, 0.18))";
const hudEdgeStrong = "var(--lg-component-edge-strong, rgba(168, 204, 146, 0.32))";
const hudPanelWash = "var(--lg-component-panel-wash, rgba(2, 18, 32, 0.18))";
const hudCellWash = "var(--lg-component-cell-wash, rgba(72, 138, 82, 0.08))";
const hudRowWash = "var(--lg-component-row-wash, rgba(2,18,32,0.10))";
const hudRowAltWash = "var(--lg-component-row-alt-wash, rgba(72,138,82,0.06))";
const hudGaugeTrack = "var(--lg-component-gauge-track, rgba(255,255,255,0.10))";
const hudGaugeCore = "var(--lg-component-gauge-core, rgba(2,18,32,0.58))";
const hudGaugeInset = "var(--lg-component-gauge-inset, rgba(2,18,32,0.20))";

const toneStyles: Record<string, { accent: string; background: string; border: string; text: string }> = {
  critical: {
    accent: "var(--lg-tone-critical-accent, rgba(255, 96, 126, 0.78))",
    background:
      "var(--lg-tone-critical-bg, linear-gradient(90deg, rgba(255,96,126,0.13), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018)))",
    border: "var(--lg-tone-critical-border, rgba(255, 96, 126, 0.32))",
    text: "var(--lg-tone-critical-text, rgba(255, 218, 226, 0.96))",
  },
  danger: {
    accent: "var(--lg-tone-danger-accent, rgba(255, 96, 126, 0.74))",
    background:
      "var(--lg-tone-danger-bg, linear-gradient(90deg, rgba(255,96,126,0.12), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018)))",
    border: "var(--lg-tone-danger-border, rgba(255, 96, 126, 0.30))",
    text: "var(--lg-tone-danger-text, rgba(255, 218, 226, 0.96))",
  },
  warning: {
    accent: "var(--lg-tone-warning-accent, rgba(255, 216, 112, 0.76))",
    background:
      "var(--lg-tone-warning-bg, linear-gradient(90deg, rgba(255,216,112,0.12), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018)))",
    border: "var(--lg-tone-warning-border, rgba(255, 216, 112, 0.30))",
    text: "var(--lg-tone-warning-text, rgba(255, 240, 196, 0.96))",
  },
  positive: {
    accent: "var(--lg-tone-positive-accent, rgba(126, 174, 86, 0.78))",
    background:
      "var(--lg-tone-positive-bg, linear-gradient(90deg, rgba(72,138,82,0.12), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018)))",
    border: "var(--lg-tone-positive-border, rgba(130, 180, 118, 0.28))",
    text: "var(--lg-tone-positive-text, rgba(226, 244, 210, 0.96))",
  },
  neutral: {
    accent: "var(--lg-tone-neutral-accent, rgba(154, 170, 150, 0.58))",
    background:
      "var(--lg-tone-neutral-bg, linear-gradient(90deg, rgba(92,114,98,0.085), rgba(2,18,32,0.16) 48%, rgba(255,255,255,0.018)))",
    border: "var(--lg-tone-neutral-border, rgba(130, 150, 124, 0.18))",
    text: "var(--lg-tone-neutral-text, var(--lg-component-text, rgba(248, 253, 255, 0.98)))",
  },
  info: {
    accent: "var(--lg-tone-info-accent, rgba(72, 114, 138, 0.76))",
    background:
      "var(--lg-tone-info-bg, linear-gradient(90deg, rgba(72,114,138,0.13), rgba(2,18,32,0.16) 46%, rgba(255,255,255,0.018)))",
    border: "var(--lg-tone-info-border, rgba(100, 136, 150, 0.28))",
    text: "var(--lg-tone-info-text, rgba(216, 232, 226, 0.96))",
  },
};

function toneFor(value?: string) {
  return toneStyles[value ?? "neutral"] ?? toneStyles.neutral;
}

const panelBaseStyle: React.CSSProperties = {
  background:
    "var(--lg-component-panel-bg, linear-gradient(145deg, var(--aether-card-tint), rgba(2,18,32,0.16) 58%, rgba(255,255,255,0.018)), linear-gradient(90deg, rgba(72,138,82,0.08), transparent 42%))",
  backdropFilter: "blur(var(--aether-card-blur)) saturate(var(--aether-card-saturate)) brightness(var(--aether-card-brightness))",
  border: `1px solid ${hudEdge}`,
  borderRadius: 10,
  boxShadow:
    "var(--lg-component-panel-shadow, inset 2px 0 0 var(--lg-component-line, rgba(126, 174, 86, 0.42)), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,12,24,0.22), inset 0 0 20px rgba(72,138,82,0.05), 0 14px 36px rgba(0,12,24,0.20))",
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
    "var(--lg-component-readable-shadow, inset 2px 0 0 var(--lg-component-line, rgba(126, 174, 86, 0.42)), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,12,24,0.22), inset 0 0 16px rgba(72,138,82,0.045), 0 10px 24px rgba(0,12,24,0.14))",
  WebkitBackdropFilter: "blur(var(--aether-readable-blur)) saturate(1.12) brightness(1.02)",
};

function accentedReadableGlassStyle(tone: { border: string }): React.CSSProperties {
  return {
    ...readableGlassStyle,
    boxShadow: `var(--lg-tone-emphasis-shadow, ${readableGlassStyle.boxShadow}, inset 0 0 28px ${tone.border}, 0 0 26px ${tone.border})`,
  };
}

const containedRegionStyle: React.CSSProperties = {
  containIntrinsicSize: "auto 160px",
  contentVisibility: "auto",
};

function cardSurfaceStyle(
  tone: { background: string; border: string },
  options: { minHeight?: number; padding?: number; accent?: boolean } = {},
): React.CSSProperties {
  return {
    ...containedRegionStyle,
    ...(options.accent ? accentedReadableGlassStyle(tone) : readableGlassStyle),
    background: tone.background,
    border: `1px solid ${tone.border}`,
    borderRadius: 8,
    minHeight: options.minHeight,
    minWidth: 0,
    overflow: "hidden",
    padding: options.padding ?? 12,
  };
}

function statusTone(value?: string): "positive" | "neutral" | "warning" | "danger" | "info" {
  if (value === "done" || value === "pass" || value === "positive") return "positive";
  if (value === "blocked" || value === "fail" || value === "danger" || value === "critical") return "danger";
  if (value === "warning" || value === "warn") return "warning";
  if (value === "active" || value === "running" || value === "info") return "info";
  return "neutral";
}

function panelHeader(title?: string, description?: string): React.ReactNode {
  if (!title && !description) {
    return null;
  }

  return React.createElement(
    "div",
    { style: { borderBottom: `1px solid ${hudEdge}`, padding: "12px 14px" } },
    title
      ? React.createElement(
          "h3",
          { style: { color: hudText, fontSize: 17, fontWeight: 760, letterSpacing: 0, margin: 0, textShadow: hudTextShadow } },
          title,
        )
      : null,
    description
      ? React.createElement(
          "p",
          { style: { color: hudTextMid, fontSize: 14, lineHeight: 1.55, margin: title ? "4px 0 0" : 0, textShadow: hudTextShadow } },
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

function textBlockNodes(text: string, keyPrefix: string, style?: React.CSSProperties): React.ReactNode[] {
  const blocks = text
    .trim()
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) {
    return [];
  }

  return blocks.map((block, blockIndex) =>
    React.createElement(
      "p",
      {
        key: `${keyPrefix}:${blockIndex}`,
        style: {
          color: hudText,
          fontSize: 14,
          lineHeight: 1.72,
          margin: 0,
          overflowWrap: "anywhere",
          textWrap: "pretty",
          whiteSpace: "pre-wrap",
          ...style,
        },
      },
      block,
    ),
  );
}

function textPanel(
  text: string,
  keyPrefix: string,
  options: {
    emptyLabel?: string;
    maxHeight?: number;
    style?: React.CSSProperties;
  } = {},
): React.ReactElement {
  const nodes = textBlockNodes(text, keyPrefix, options.style);
  return React.createElement(
    "div",
    {
      style: {
        display: "grid",
        gap: 12,
        maxHeight: options.maxHeight,
        overflow: options.maxHeight ? "auto" : undefined,
        paddingRight: options.maxHeight ? 4 : undefined,
      },
    },
    nodes.length > 0
      ? nodes
      : React.createElement(
          "p",
          { style: { color: hudTextSoft, fontSize: 13, lineHeight: 1.6, margin: 0 } },
          options.emptyLabel ?? "No text provided.",
        ),
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
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

const MapWithList = defineComponent({
  name: "MapWithList",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    center: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
    zoom: z.number().int().min(1).max(18).default(11),
    height: z.number().int().min(240).max(720).default(420),
    items: z.array(
      z.object({
        id: z.string(),
        lat: z.number(),
        lng: z.number(),
        label: z.string(),
        description: z.string().optional(),
        category: z.string().optional(),
        color: z.enum(["red", "blue", "green", "yellow", "purple", "gray"]).optional(),
        links: z
          .array(
            z.object({
              label: z.string(),
              url: z.string(),
            }),
          )
          .optional(),
      }),
    ),
  }),
  description:
    "Interactive map paired with a clickable item list. Clicking a list entry flies the map to that point and opens its popup; clicking a marker highlights the entry. Each item can include links (official site, review pages, etc.) shown as chips in the list and the marker popup. A Google Maps link is always auto-generated from lat/lng. Use for store/cafe/site directories, customer maps, tour stops — any time the user should browse points and see their place on a map.",
  component: ({ props }) =>
    React.createElement(MapWithListDynamic, {
      title: props.title,
      description: props.description,
      center: props.center,
      zoom: props.zoom,
      height: props.height,
      items: props.items,
    }),
});

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
    tracks: z
      .array(
        z.object({
          title: z.string(),
          artist: z.string().optional(),
          src: z.string(),
          coverUrl: z.string().optional(),
          description: z.string().optional(),
        }),
      )
      .min(1),
    ...glassProps,
  }),
  description:
    "Audio playlist player for music, generated audio, voice notes, podcasts, meeting recordings, and sound previews. Each track needs title and src; artist, coverUrl, and description are optional.",
  component: ({ props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const selected = props.tracks[Math.min(selectedIndex, props.tracks.length - 1)];

    return React.createElement(
      "section",
      { "data-lg-widget": "audio-player", style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "article",
          {
            "data-lg-audio-current": "true",
            style: {
              alignItems: "center",
              background: hudCellWash,
              border: `1px solid ${hudEdge}`,
              borderRadius: 8,
              display: "grid",
              gap: 12,
              gridTemplateColumns: selected.coverUrl ? "88px 1fr" : "1fr",
              padding: 12,
            },
          },
          React.createElement("img", {
            alt: "",
            "data-lg-audio-cover": "true",
            hidden: !selected.coverUrl,
            src: selected.coverUrl,
            style: { borderRadius: 8, height: 88, objectFit: "cover", width: 88 },
          }),
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" } },
              React.createElement("strong", { "data-lg-audio-title": "true", style: { color: hudText, fontSize: 16 } }, selected.title),
              labelElement(`Track ${selectedIndex + 1}/${props.tracks.length}`, selectedIndex === 0 ? "positive" : "info", "xs"),
            ),
            React.createElement("div", { "data-lg-audio-artist": "true", hidden: !selected.artist, style: { color: hudTextSoft, fontSize: 12, marginTop: 3 } }, selected.artist),
            React.createElement(
              "p",
              { "data-lg-audio-description": "true", hidden: !selected.description, style: { color: hudTextMid, fontSize: 12, lineHeight: 1.5, margin: "6px 0" } },
              selected.description,
            ),
            React.createElement("audio", {
              controls: true,
              key: `${selected.src}:${selectedIndex}`,
              preload: "metadata",
              src: selected.src,
              style: { marginTop: 8, width: "100%" },
            }),
          ),
        ),
        props.tracks.length > 1
          ? React.createElement(
              "div",
              { style: { display: "grid", gap: 8 } },
              props.tracks.map((track, index) => {
                const selectedTrack = index === selectedIndex;
                const tone = selectedTrack ? toneFor("positive") : toneFor("neutral");
                return React.createElement(
                  "button",
                  {
                    "aria-current": selectedTrack ? "true" : undefined,
                    "data-lg-artist": track.artist,
                    "data-lg-audio-track": "true",
                    "data-lg-cover": track.coverUrl,
                    "data-lg-description": track.description,
                    "data-lg-src": track.src,
                    "data-lg-title": track.title,
                    key: `${track.src}:${index}`,
                    onClick: () => setSelectedIndex(index),
                    style: {
                      alignItems: "center",
                      background: selectedTrack ? tone.background : hudPanelWash,
                      border: `1px solid ${selectedTrack ? tone.border : hudEdge}`,
                      borderRadius: 8,
                      color: selectedTrack ? tone.text : hudText,
                      cursor: "pointer",
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: "34px 1fr",
                      padding: 10,
                      textAlign: "left",
                      ...readableGlassStyle,
                    },
                    type: "button",
                  },
                  labelElement(String(index + 1), selectedTrack ? "positive" : "neutral", "xs"),
                  React.createElement(
                    "span",
                    null,
                    React.createElement("span", { style: { display: "block", fontSize: 13, fontWeight: 800 } }, track.title),
                    track.artist
                      ? React.createElement("span", { style: { color: hudTextSoft, display: "block", fontSize: 12, marginTop: 2 } }, track.artist)
                      : null,
                  ),
                );
              }),
            )
          : null,
      ),
    );
  },
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
    "Video player for demos, screen recordings, generated clips, design walkthroughs, tutorials, YouTube links, and incident evidence. Supports src, posterUrl, transcript, and chapter list.",
  component: ({ props }) => {
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      renderVideoSurface({ posterUrl: props.posterUrl, src: props.src, title: props.title }),
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
    );
  },
});

const VideoPlaylist = defineComponent({
  name: "VideoPlaylist",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    videos: z
      .array(
        z.object({
          title: z.string(),
          src: z.string(),
          channel: z.string().optional(),
          description: z.string().optional(),
          reason: z.string().optional(),
          posterUrl: z.string().optional(),
          transcript: z.string().optional(),
        }),
      )
      .min(1),
    autoplay: z.boolean().optional(),
    ...glassProps,
  }),
  description:
    "Recommendation video playlist with a main inline player and a clickable candidate table. The first video is selected by default; set autoplay to true to start it muted where the browser allows.",
  component: ({ props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const selected = props.videos[Math.min(selectedIndex, props.videos.length - 1)];
    const shouldAutoplay = props.autoplay ?? true;

    return React.createElement(
      "section",
      { "data-lg-widget": "video-playlist", style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "div",
          { "data-lg-video-surface": "true", key: `${selected.src}:${selectedIndex}` },
          renderVideoSurface({
            autoplay: shouldAutoplay,
            posterUrl: selected.posterUrl,
            src: selected.src,
            title: selected.title,
          }),
        ),
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" } },
            React.createElement("h3", { "data-lg-video-title": "true", style: { color: hudText, fontSize: 16, fontWeight: 760, margin: 0 } }, selected.title),
            labelElement(`候補 ${selectedIndex + 1}/${props.videos.length}`, selectedIndex === 0 ? "positive" : "info", "xs"),
          ),
          React.createElement("div", { "data-lg-video-channel": "true", hidden: !selected.channel, style: { color: hudTextSoft, fontSize: 12, marginTop: 3 } }, selected.channel),
          React.createElement(
            "p",
            { "data-lg-video-description": "true", hidden: !selected.description, style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" } },
            selected.description,
          ),
          React.createElement(
            "p",
            { "data-lg-video-reason": "true", hidden: !selected.reason, style: { color: hudTextSoft, fontSize: 12, lineHeight: 1.45, margin: "5px 0 0" } },
            selected.reason,
          ),
        ),
        React.createElement(
          "div",
          { style: { overflowX: "auto", overscrollBehaviorX: "contain", scrollbarGutter: "stable", width: "100%" } },
          React.createElement(
            "table",
            { style: { borderCollapse: "collapse", minWidth: 620, width: "100%" } },
            React.createElement(
              "thead",
              { style: { background: hudCellWash } },
              React.createElement(
                "tr",
                null,
                ["#", "候補", "チャンネル", "理由"].map((label) =>
                  React.createElement(
                    "th",
                    {
                      key: label,
                      style: {
                        borderBottom: `1px solid ${hudEdge}`,
                        color: hudTextMid,
                        fontSize: 12,
                        fontWeight: 800,
                        padding: "9px 10px",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                      },
                    },
                    label,
                  ),
                ),
              ),
            ),
            React.createElement(
              "tbody",
              null,
              props.videos.map((video, index) => {
                const selectedRow = index === selectedIndex;
                const tone = selectedRow ? toneFor("positive") : toneFor("neutral");
                const embedSource = resolveVideoEmbedSource(video.src, { autoplay: shouldAutoplay });
                return React.createElement(
                  "tr",
                  {
                    key: `${video.src}:${index}`,
                    style: {
                      background: selectedRow ? tone.background : index % 2 === 0 ? hudRowWash : hudRowAltWash,
                    },
                  },
                  React.createElement(
                    "td",
                    { style: { borderBottom: `1px solid ${hudEdge}`, color: hudTextSoft, fontSize: 13, padding: "9px 10px" } },
                    `${index + 1}.`,
                  ),
                  React.createElement(
                    "td",
                    { style: { borderBottom: `1px solid ${hudEdge}`, padding: "7px 10px", verticalAlign: "top" } },
                    React.createElement(
                      "button",
                      {
                        "aria-current": selectedRow ? "true" : undefined,
                        "data-lg-channel": video.channel,
                        "data-lg-description": video.description,
                        "data-lg-embed-kind": embedSource.kind,
                        "data-lg-embed-src": embedSource.src,
                        "data-lg-poster": video.posterUrl,
                        "data-lg-reason": video.reason,
                        "data-lg-source-url": embedSource.kind === "iframe" ? embedSource.sourceUrl : undefined,
                        "data-lg-title": video.title,
                        "data-lg-video-item": "true",
                        onClick: () => setSelectedIndex(index),
                        style: {
                          background: "transparent",
                          border: 0,
                          color: selectedRow ? tone.text : hudText,
                          cursor: "pointer",
                          font: "inherit",
                          fontSize: 13,
                          fontWeight: selectedRow ? 800 : 700,
                          padding: 0,
                          textAlign: "left",
                          textDecoration: selectedRow ? "none" : "underline",
                          textUnderlineOffset: 3,
                        },
                        type: "button",
                      },
                      video.title,
                    ),
                    video.description
                      ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12, lineHeight: 1.45, marginTop: 4 } }, video.description)
                      : null,
                  ),
                  React.createElement(
                    "td",
                    { style: { borderBottom: `1px solid ${hudEdge}`, color: hudTextMid, fontSize: 13, padding: "9px 10px", verticalAlign: "top" } },
                    video.channel ?? "-",
                  ),
                  React.createElement(
                    "td",
                    { style: { borderBottom: `1px solid ${hudEdge}`, color: hudTextMid, fontSize: 13, lineHeight: 1.45, padding: "9px 10px", verticalAlign: "top" } },
                    video.reason ?? "",
                  ),
                );
              }),
            ),
          ),
        ),
        selected.transcript
          ? React.createElement(
              "details",
              null,
              React.createElement("summary", { style: { color: hudText, cursor: "pointer", fontSize: 13, fontWeight: 700 } }, "Transcript"),
              React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" } }, selected.transcript),
            )
          : null,
      ),
    );
  },
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
              style: cardSurfaceStyle(tone, { accent: true, minHeight: 112 }),
            },
            labelElement(metric.label, metric.tone ?? "neutral", "xs"),
            React.createElement(
              "div",
              {
                style: {
                  color: tone.text,
                  fontSize: 24,
                  fontWeight: 800,
                  lineHeight: 1.15,
                  marginTop: 7,
                  overflowWrap: "anywhere",
                  textShadow: hudTextShadow,
                },
              },
              metric.value,
            ),
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
        href: z.string().optional(),
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
              style: cardSurfaceStyle(tone, { accent: true }),
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
            action.href
              ? React.createElement(
                  "a",
                  {
                    href: action.href,
                    rel: "noreferrer",
                    style: {
                      alignItems: "center",
                      background: hudPanelWash,
                      border: `1px solid ${tone.border}`,
                      borderRadius: 7,
                      color: tone.text,
                      display: "inline-flex",
                      fontSize: 12,
                      fontWeight: 800,
                      marginTop: 10,
                      padding: "6px 10px",
                      textDecoration: "none",
                      width: "fit-content",
                    },
                    target: "_blank",
                  },
                  "Open",
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
              style: { ...cardSurfaceStyle(tone), display: "grid", gap: 8 },
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
    contextPath: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Responsive data table for operational rows, ticket lists, file inventories, research results, rankings, and structured evidence. Use when users need to scan or compare records. For large row sets, pass empty rows and set contextPath to read records from --context-file.",
  component: ({ props }) =>
    runtimeDataConsumer((runtimeData) => {
      const contextRows = normalizeRecordRows(getContextPathValue(runtimeData, props.contextPath));
      const rows = contextRows.length > 0 ? contextRows : props.rows;
      const columns: Array<{ key: string; label: string; align?: "left" | "right" | "center" }> =
        props.columns.length > 0 ? props.columns : inferColumnsFromRows(rows);
      return React.createElement(
        "section",
        { style: panelStyleFor(props) },
        panelHeader(props.title, props.description),
        React.createElement(
          "div",
          { style: { overflowX: "auto", overscrollBehaviorX: "contain", scrollbarGutter: "stable", width: "100%" } },
          React.createElement(
            "table",
            { style: { borderCollapse: "collapse", minWidth: Math.max(520, columns.length * 140), width: "100%" } },
            props.caption ? React.createElement("caption", { style: { color: hudTextMid, fontSize: 12, padding: 10, textAlign: "left" } }, props.caption) : null,
            React.createElement(
              "thead",
              { style: { background: hudCellWash } },
              React.createElement(
                "tr",
                null,
                columns.map((column) =>
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
              rows.map((row, rowIndex) =>
                React.createElement(
                  "tr",
                  { key: `row:${rowIndex}`, style: { background: rowIndex % 2 === 0 ? hudRowWash : hudRowAltWash } },
                  columns.map((column) =>
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
      );
    }),
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
              style: cardSurfaceStyle(tone, { minHeight: 128, padding: 10 }),
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
              style: cardSurfaceStyle(tone),
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

const Gauge = defineComponent({
  name: "Gauge",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    label: z.string(),
    value: z.number(),
    max: z.number().positive().optional(),
    unit: z.string().optional(),
    target: z.number().optional(),
    tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
    ...glassProps,
  }),
  description:
    "Single circular gauge for completion, confidence, health, quota, SLA, score, and percentage-style values. Use when one bounded number needs immediate visual weight.",
  component: ({ props }) => {
    const max = props.max ?? 100;
    const percent = clampPercent((props.value / max) * 100);
    const targetPercent = props.target === undefined ? null : clampPercent((props.target / max) * 100);
    const tone = toneFor(props.tone ?? (percent >= 80 ? "positive" : percent >= 50 ? "info" : percent >= 30 ? "warning" : "danger"));
    const unit = props.unit ?? "%";
    const valueLabel = `${formatCompactNumber(props.value)}${unit}`;
    const targetLabel = props.target === undefined ? null : `${formatCompactNumber(props.target)}${unit}`;
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        {
          style: {
            alignItems: "center",
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            padding: 14,
          },
        },
        React.createElement(
          "div",
          {
            "aria-label": `${props.label}: ${valueLabel} of ${formatCompactNumber(max)}${unit}`,
            role: "img",
            style: {
              alignItems: "center",
              aspectRatio: "1 / 1",
              background: `conic-gradient(${tone.accent} 0 ${percent}%, ${hudGaugeTrack} ${percent}% 100%)`,
              border: `1px solid ${tone.border}`,
              borderRadius: "50%",
              boxShadow: `inset 0 0 0 10px ${hudGaugeInset}, 0 18px 38px rgba(0,12,24,0.22), 0 0 32px ${tone.border}`,
              display: "grid",
              justifyItems: "center",
              maxWidth: 190,
              minWidth: 0,
              padding: 14,
              placeSelf: "center",
              width: "100%",
            },
          },
          React.createElement(
            "div",
            {
              style: {
                alignItems: "center",
                background: hudGaugeCore,
                border: `1px solid ${hudEdge}`,
                borderRadius: "50%",
                display: "grid",
                height: "76%",
                justifyItems: "center",
                minWidth: 0,
                padding: 12,
                textAlign: "center",
                width: "76%",
                ...readableGlassStyle,
              },
            },
            React.createElement("strong", { style: { color: tone.text, fontSize: 28, lineHeight: 1, overflowWrap: "anywhere", textShadow: hudTextShadow } }, valueLabel),
            React.createElement("span", { style: { color: hudTextMid, fontSize: 11, fontWeight: 800, letterSpacing: 0, textTransform: "uppercase" } }, `${Math.round(percent)}%`),
          ),
        ),
        React.createElement(
          "div",
          { style: { display: "grid", gap: 9, minWidth: 0 } },
          labelElement(props.label, props.tone ?? "info", "xs", { width: "fit-content" }),
          React.createElement(
            "div",
            { style: { color: tone.text, fontSize: 18, fontWeight: 850, lineHeight: 1.25, overflowWrap: "anywhere", textShadow: hudTextShadow } },
            valueLabel,
          ),
          React.createElement(
            "div",
            {
              style: {
                background: hudPanelWash,
                border: `1px solid ${hudEdge}`,
                borderRadius: 999,
                height: 12,
                overflow: "hidden",
              },
            },
            React.createElement("span", {
              style: {
                background: `linear-gradient(90deg, ${tone.accent}, ${tone.text})`,
                borderRadius: 999,
                display: "block",
                height: "100%",
                width: `${percent}%`,
              },
            }),
          ),
          targetLabel
            ? React.createElement(
                "div",
                { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 } },
                labelElement(`Target: ${targetLabel}`, targetPercent !== null && percent >= targetPercent ? "positive" : "warning", "xs"),
                labelElement(`Max: ${formatCompactNumber(max)}${unit}`, "neutral", "xs"),
              )
            : labelElement(`Max: ${formatCompactNumber(max)}${unit}`, "neutral", "xs", { width: "fit-content" }),
        ),
      ),
    );
  },
});

const ChecklistPanel = defineComponent({
  name: "ChecklistPanel",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(
      z.object({
        label: z.string(),
        status: z.enum(["done", "active", "pending", "blocked", "warning", "skipped"]).default("pending"),
        description: z.string().optional(),
        owner: z.string().optional(),
      }),
    ),
    summary: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Scannable checklist for acceptance criteria, QA gates, launch readiness, requirements coverage, and human review items. Use when the user needs item-by-item completion state rather than a timeline.",
  component: ({ props }) => {
    const done = props.items.filter((item) => item.status === "done").length;
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        React.createElement(
          "div",
          { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" } },
          props.summary ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.45, margin: 0 } }, props.summary) : React.createElement("span"),
          labelElement(`${done}/${props.items.length} done`, done === props.items.length ? "positive" : "info", "xs"),
        ),
        React.createElement(
          "ol",
          { style: { display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 0 } },
          props.items.map((item, index) => {
            const toneKey = statusTone(item.status);
            const tone = toneFor(toneKey);
            const marker = item.status === "done" ? "OK" : item.status === "blocked" ? "!" : item.status === "warning" ? "!" : item.status === "active" ? ">" : "-";
            return React.createElement(
              "li",
              {
                key: `${item.label}:${index}`,
                style: {
                  ...cardSurfaceStyle(tone, { padding: 10 }),
                  alignItems: "start",
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "34px minmax(0, 1fr)",
                },
              },
              React.createElement(
                "span",
                {
                  style: {
                    alignItems: "center",
                    background: tone.accent,
                    border: `1px solid ${tone.border}`,
                    borderRadius: 8,
                    color: "rgba(2,18,32,0.92)",
                    display: "inline-flex",
                    fontSize: 11,
                    fontWeight: 900,
                    height: 28,
                    justifyContent: "center",
                    width: 28,
                  },
                },
                marker,
              ),
              React.createElement(
                "div",
                { style: { minWidth: 0 } },
                React.createElement(
                  "div",
                  { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 } },
                  React.createElement("strong", { style: { color: tone.text, fontSize: 14, lineHeight: 1.35, overflowWrap: "anywhere" } }, item.label),
                  labelElement(item.status, toneKey, "xs"),
                  item.owner ? labelElement(item.owner, "neutral", "xs") : null,
                ),
                item.description ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.45, margin: "5px 0 0" } }, item.description) : null,
              ),
            );
          }),
        ),
      ),
    );
  },
});

const InsightStack = defineComponent({
  name: "InsightStack",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    insights: z.array(
      z.object({
        title: z.string(),
        detail: z.string().optional(),
        confidence: z.string().optional(),
        source: z.string().optional(),
        tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Stack of high-signal AI takeaways with optional detail, confidence, source, and tone. Use for research summaries, reasoning output, evidence highlights, and executive briefs.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        props.insights.map((insight, index) => {
          const tone = toneFor(insight.tone ?? (index === 0 ? "info" : "neutral"));
          return React.createElement(
            "article",
            {
              key: `${insight.title}:${index}`,
              style: {
                ...cardSurfaceStyle(tone, { accent: index === 0, padding: 12 }),
                display: "grid",
                gap: 8,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: tone.text, fontSize: 15, lineHeight: 1.35, overflowWrap: "anywhere" } }, insight.title),
              insight.confidence ? labelElement(insight.confidence, insight.tone ?? "info", "xs", { flexShrink: 0 }) : null,
            ),
            insight.detail ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: 0 } }, insight.detail) : null,
            insight.source ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12, fontWeight: 700, overflowWrap: "anywhere" } }, `Source: ${insight.source}`) : null,
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
    contextPath: z.string().optional(),
    labelKey: z.string().optional(),
    valueKey: z.string().optional(),
    toneKey: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Simple responsive bar chart for rankings, category comparison, volume, cost, risk, and operational counts. For large datasets, pass an empty data array and set contextPath to read rows from --context-file. Use labelKey/valueKey/toneKey when context rows use custom field names.",
  component: ({ props }) => {
    const unit = props.unit ?? "";
    const toneColor: Record<string, string> = {
      positive: "rgba(126, 174, 86, 0.92)",
      info: "rgba(72, 114, 138, 0.90)",
      warning: "rgba(176, 142, 72, 0.92)",
      danger: "rgba(148, 72, 82, 0.92)",
      neutral: "rgba(154, 170, 150, 0.78)",
    };
    const tooltipFormatter = (value: unknown) =>
      `${typeof value === "number" ? value.toLocaleString() : String(value)}${unit}`;
    return runtimeDataConsumer((runtimeData) => {
      const contextData = normalizeSingleSeriesData(getContextPathValue(runtimeData, props.contextPath), {
        labelKey: props.labelKey,
        valueKey: props.valueKey,
        toneKey: props.toneKey,
      });
      const chartData = contextData.length > 0 ? contextData : props.data;
      const emptyMessage = props.contextPath
        ? `No chart data found at context path "${props.contextPath}".`
        : "No chart data.";

      return React.createElement(
        "section",
        { style: panelStyleFor(props) },
        panelHeader(props.title, props.description),
        React.createElement(
          "div",
          { style: { height: 220, padding: 14 } },
          chartData.length === 0
            ? React.createElement(
                "div",
                {
                  style: {
                    alignItems: "center",
                    border: `1px dashed ${hudEdge}`,
                    borderRadius: 10,
                    color: hudTextSoft,
                    display: "flex",
                    fontSize: 13,
                    height: "100%",
                    justifyContent: "center",
                    textAlign: "center",
                  },
                },
                emptyMessage,
              )
            : React.createElement(
                RcResponsiveContainer as React.ElementType,
                { width: "100%", height: "100%", minWidth: 0 },
                React.createElement(
                  RcBarChart,
                  {
                    data: chartData,
                    margin: { top: 8, right: 16, left: 4, bottom: 0 },
                    barCategoryGap: "22%",
                  },
                  React.createElement(RcCartesianGrid, {
                    stroke: chartPalette.grid,
                    strokeDasharray: "2 4",
                    vertical: false,
                  }),
                  React.createElement(RcXAxis, {
                    dataKey: "label",
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    minTickGap: 12,
                  }),
                  React.createElement(RcYAxis, {
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    width: 44,
                    tickFormatter: (value: number) => `${value}${unit}`,
                    domain: props.max ? [0, props.max] : undefined,
                  }),
                  React.createElement(RcTooltip, {
                    ...chartTooltipStyle,
                    cursor: { fill: "rgba(72, 138, 82, 0.08)" },
                    formatter: tooltipFormatter,
                  }),
                  React.createElement(
                    RcBar,
                    { dataKey: "value", radius: [3, 3, 0, 0], isAnimationActive: false },
                    chartData.map((item, index) =>
                      React.createElement(RcCell, {
                        key: `${item.label}:${index}`,
                        fill: toneColor[item.tone ?? "neutral"] ?? toneColor.neutral,
                      }),
                    ),
                  ),
                ),
              ),
        ),
      );
    });
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
    contextPath: z.string().optional(),
    labelKey: z.string().optional(),
    valueKey: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Compact line chart for trends, time series, forecasts, health signals, backlog movement, and metric changes over time. For large datasets, pass an empty data array and set contextPath to read rows from --context-file. Use labelKey/valueKey when context rows use custom field names.",
  component: ({ props }) => {
    const unit = props.unit ?? "";
    const tooltipFormatter = (value: unknown) =>
      `${typeof value === "number" ? value.toLocaleString() : String(value)}${unit}`;
    return runtimeDataConsumer((runtimeData) => {
      const contextData = normalizeSingleSeriesData(getContextPathValue(runtimeData, props.contextPath), {
        labelKey: props.labelKey,
        valueKey: props.valueKey,
      });
      const chartData = contextData.length > 0 ? contextData : props.data;
      const emptyMessage = props.contextPath
        ? `No chart data found at context path "${props.contextPath}".`
        : "No chart data.";

      return React.createElement(
        "section",
        { style: panelStyleFor(props) },
        panelHeader(props.title, props.description),
        React.createElement(
          "div",
          { style: { height: 220, padding: 14 } },
          chartData.length === 0
            ? React.createElement(
                "div",
                {
                  style: {
                    alignItems: "center",
                    border: `1px dashed ${hudEdge}`,
                    borderRadius: 10,
                    color: hudTextSoft,
                    display: "flex",
                    fontSize: 13,
                    height: "100%",
                    justifyContent: "center",
                    textAlign: "center",
                  },
                },
                emptyMessage,
              )
            : React.createElement(
                RcResponsiveContainer as React.ElementType,
                { width: "100%", height: "100%", minWidth: 0 },
                React.createElement(
                  RcLineChart,
                  { data: chartData, margin: { top: 8, right: 16, left: 4, bottom: 0 } },
                  React.createElement(RcCartesianGrid, {
                    stroke: chartPalette.grid,
                    strokeDasharray: "2 4",
                    vertical: false,
                  }),
                  React.createElement(RcXAxis, {
                    dataKey: "label",
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    minTickGap: 16,
                  }),
                  React.createElement(RcYAxis, {
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    width: 44,
                    tickFormatter: (value: number) => `${value}${unit}`,
                  }),
                  React.createElement(RcTooltip, {
                    ...chartTooltipStyle,
                    cursor: { stroke: chartPalette.grid, strokeDasharray: "2 4" },
                    formatter: tooltipFormatter,
                  }),
                  React.createElement(RcLine, {
                    type: "monotone",
                    dataKey: "value",
                    stroke: chartPalette.line,
                    strokeWidth: 1.5,
                    dot: { r: 2.5, stroke: chartPalette.line, strokeWidth: 1, fill: "rgba(8, 24, 38, 0.92)" },
                    activeDot: { r: 3.5, stroke: chartPalette.line, strokeWidth: 1.5, fill: chartPalette.line },
                    isAnimationActive: false,
                  }),
                ),
              ),
        ),
      );
    });
  },
});

const ComboChart = defineComponent({
  name: "ComboChart",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    data: z.array(
      z.object({
        label: z.string(),
        barValue: z.number(),
        lineValue: z.number(),
      }),
    ),
    barUnit: z.string().optional(),
    lineUnit: z.string().optional(),
    barLabel: z.string().optional(),
    lineLabel: z.string().optional(),
    barTone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
    contextPath: z.string().optional(),
    labelKey: z.string().optional(),
    barValueKey: z.string().optional(),
    lineValueKey: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Combo chart with bars and a line sharing the X axis but using two independent Y axes. Use when a single popup needs two series in different units — e.g. PV (absolute) + CVR (%), revenue + growth-rate, requests/sec + latency. Pick LineChart or BarChart instead if all series use the same unit. For large datasets, pass an empty data array and set contextPath plus labelKey/barValueKey/lineValueKey.",
  component: ({ props }) => {
    const barUnit = props.barUnit ?? "";
    const lineUnit = props.lineUnit ?? "";
    const barLabel = props.barLabel ?? "Bar";
    const lineLabel = props.lineLabel ?? "Line";
    const toneColor: Record<string, string> = {
      positive: "rgba(126, 174, 86, 0.92)",
      info: "rgba(72, 138, 184, 0.90)",
      warning: "rgba(176, 142, 72, 0.92)",
      danger: "rgba(148, 72, 82, 0.92)",
      neutral: "rgba(154, 170, 150, 0.78)",
    };
    const barColor = toneColor[props.barTone ?? "info"] ?? toneColor.info;
    const lineColor = "rgba(248, 220, 124, 0.96)";
    const tooltipFormatter = (value: unknown, name: unknown) => {
      const v = typeof value === "number" ? value.toLocaleString() : String(value);
      const isLine = name === lineLabel;
      return `${v}${isLine ? lineUnit : barUnit}`;
    };
    return runtimeDataConsumer((runtimeData) => {
      const contextData = normalizeComboSeriesData(getContextPathValue(runtimeData, props.contextPath), {
        labelKey: props.labelKey,
        barValueKey: props.barValueKey,
        lineValueKey: props.lineValueKey,
      });
      const chartData = contextData.length > 0 ? contextData : props.data;
      const emptyMessage = props.contextPath
        ? `No chart data found at context path "${props.contextPath}".`
        : "No chart data.";

      return React.createElement(
        "section",
        { style: panelStyleFor(props) },
        panelHeader(props.title, props.description),
        React.createElement(
          "div",
          { style: { height: 260, padding: 14 } },
          chartData.length === 0
            ? React.createElement(
                "div",
                {
                  style: {
                    alignItems: "center",
                    border: `1px dashed ${hudEdge}`,
                    borderRadius: 10,
                    color: hudTextSoft,
                    display: "flex",
                    fontSize: 13,
                    height: "100%",
                    justifyContent: "center",
                    textAlign: "center",
                  },
                },
                emptyMessage,
              )
            : React.createElement(
                RcResponsiveContainer as React.ElementType,
                { width: "100%", height: "100%", minWidth: 0 },
                React.createElement(
                  RcComposedChart,
                  { data: chartData, margin: { top: 8, right: 16, left: 4, bottom: 0 } },
                  React.createElement(RcCartesianGrid, {
                    stroke: chartPalette.grid,
                    strokeDasharray: "2 4",
                    vertical: false,
                  }),
                  React.createElement(RcXAxis, {
                    dataKey: "label",
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    minTickGap: 12,
                  }),
                  React.createElement(RcYAxis, {
                    yAxisId: "left",
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    width: 52,
                    tickFormatter: (value: number) => `${value}${barUnit}`,
                  }),
                  React.createElement(RcYAxis, {
                    yAxisId: "right",
                    orientation: "right",
                    stroke: chartPalette.axis,
                    tick: chartAxisTickStyle,
                    tickLine: false,
                    axisLine: { stroke: chartPalette.grid },
                    width: 44,
                    tickFormatter: (value: number) => `${value}${lineUnit}`,
                  }),
                  React.createElement(RcTooltip, {
                    ...chartTooltipStyle,
                    cursor: { fill: "rgba(120, 220, 255, 0.06)" },
                    formatter: tooltipFormatter,
                  }),
                  React.createElement(RcLegend, {
                    wrapperStyle: { color: "rgba(228, 244, 251, 0.86)", fontSize: 12, paddingTop: 4 },
                    iconType: "circle",
                  }),
                  React.createElement(RcBar, {
                    yAxisId: "left",
                    dataKey: "barValue",
                    name: barLabel,
                    fill: barColor,
                    radius: [3, 3, 0, 0],
                    isAnimationActive: false,
                  }),
                  React.createElement(RcLine, {
                    yAxisId: "right",
                    type: "monotone",
                    dataKey: "lineValue",
                    name: lineLabel,
                    stroke: lineColor,
                    strokeWidth: 1.6,
                    dot: { r: 2.5, stroke: lineColor, strokeWidth: 1, fill: "rgba(8, 24, 38, 0.92)" },
                    activeDot: { r: 3.5, stroke: lineColor, strokeWidth: 1.5, fill: lineColor },
                    isAnimationActive: false,
                  }),
                ),
              ),
        ),
      );
    });
  },
});

function sanitizeSvgMarkup(raw: string): string {
  let svg = raw.trim();
  const match = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (match) svg = match[0];
  svg = svg.replace(/<script[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  svg = svg.replace(/javascript:/gi, "");
  return svg;
}

const InlineSvg = defineComponent({
  name: "InlineSvg",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    svg: z.string(),
    height: z.number().int().min(80).max(720).optional(),
    background: z.enum(["panel", "transparent", "light"]).optional(),
    ...glassProps,
  }),
  description:
    "Inline SVG renderer for diagrams, icons, illustrations, generated vector graphics, schematics, and logos. svg is a raw <svg>…</svg> string; <script> and on* handlers are stripped. Use height to bound the render area.",
  component: ({ props }) => {
    const sanitized = sanitizeSvgMarkup(props.svg);
    const bg =
      props.background === "transparent"
        ? "transparent"
        : props.background === "light"
        ? "rgba(232,244,255,0.94)"
        : hudPanelWash;
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement("div", {
        "aria-label": props.title ?? "SVG",
        role: "img",
        dangerouslySetInnerHTML: { __html: sanitized },
        style: {
          alignItems: "center",
          background: bg,
          border: `1px solid ${hudEdge}`,
          borderRadius: 8,
          display: "flex",
          justifyContent: "center",
          margin: 14,
          minHeight: props.height ?? 240,
          overflow: "hidden",
          padding: 12,
        },
      }),
    );
  },
});

const MessageBubble = defineComponent({
  name: "MessageBubble",
  props: z.object({
    speaker: z.string(),
    role: z.enum(["user", "assistant", "system", "agent", "tool"]).default("assistant"),
    time: z.string().optional(),
    text: z.string(),
    avatar: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Single chat bubble for a user/assistant/agent/tool message. Use standalone when one message is shown; otherwise prefer MessageThread.",
  component: ({ props }) => {
    const isUser = props.role === "user";
    const tone = toneFor(props.role === "system" ? "warning" : props.role === "tool" ? "neutral" : isUser ? "info" : "positive");
    return React.createElement(
      "article",
      {
        style: {
          alignSelf: isUser ? "flex-end" : "flex-start",
          background: tone.background,
          border: `1px solid ${tone.border}`,
          borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
          color: tone.text,
          maxWidth: "82%",
          padding: 12,
          ...readableGlassStyle,
          ...glassVars(props),
        },
      },
      React.createElement(
        "header",
        { style: { alignItems: "center", display: "flex", gap: 8, marginBottom: 6 } },
        props.avatar
          ? React.createElement("img", { alt: "", src: props.avatar, style: { borderRadius: "50%", height: 22, width: 22 } })
          : null,
        labelElement(props.speaker, props.role === "system" ? "warning" : props.role === "tool" ? "neutral" : isUser ? "info" : "positive", "xs"),
        props.time ? React.createElement("time", { style: { color: hudTextSoft, fontSize: 11, marginLeft: "auto" } }, props.time) : null,
      ),
      React.createElement(
        "p",
        { style: { color: tone.text, fontSize: 14, lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" } },
        props.text,
      ),
    );
  },
});

const MessageThread = defineComponent({
  name: "MessageThread",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    messages: z.array(
      z.object({
        speaker: z.string(),
        role: z.enum(["user", "assistant", "system", "agent", "tool"]).default("assistant"),
        time: z.string().optional(),
        text: z.string(),
        avatar: z.string().optional(),
      }),
    ),
    composer: z
      .object({
        placeholder: z.string().optional(),
        sendLabel: z.string().optional(),
        actionId: z.string().optional(),
        completeOnSend: z.boolean().optional(),
      })
      .optional(),
    ...glassProps,
  }),
  description:
    "Chat-style message thread with bubbles aligned by role (user right, others left). Use for LLM conversation previews, support/customer chats, agent-to-agent exchanges, and reviewer dialog. Optional composer sends message events back to the agent.",
  component: ({ props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [draft, setDraft] = React.useState("");
    return popupEventConsumer((reportEvent) => React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 10, padding: 14 } },
        props.messages.map((message, index) => {
          const isUser = message.role === "user";
          const tone = toneFor(message.role === "system" ? "warning" : message.role === "tool" ? "neutral" : isUser ? "info" : "positive");
          return React.createElement(
            "article",
            {
              key: `${message.speaker}:${index}`,
              style: {
                alignSelf: isUser ? "flex-end" : "flex-start",
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: isUser ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                color: tone.text,
                maxWidth: "82%",
                padding: 12,
                ...readableGlassStyle,
              },
            },
            React.createElement(
              "header",
              { style: { alignItems: "center", display: "flex", gap: 8, marginBottom: 6 } },
              message.avatar
                ? React.createElement("img", { alt: "", src: message.avatar, style: { borderRadius: "50%", height: 22, width: 22 } })
                : null,
              labelElement(message.speaker, message.role === "system" ? "warning" : message.role === "tool" ? "neutral" : isUser ? "info" : "positive", "xs"),
              message.time ? React.createElement("time", { style: { color: hudTextSoft, fontSize: 11, marginLeft: "auto" } }, message.time) : null,
            ),
            React.createElement(
              "p",
              { style: { color: tone.text, fontSize: 14, lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" } },
              message.text,
            ),
          );
        }),
        props.composer
          ? React.createElement(
              "form",
              {
                onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  if (!draft.trim()) return;
                  emitPopupEvent(
                    reportEvent,
                    {
                      kind: "message",
                      component: "MessageThread",
                      actionId: actionIdFor("MessageThread", props.composer?.actionId, "send"),
                      label: props.composer?.sendLabel ?? "Send",
                      value: draft,
                    },
                    { complete: props.composer?.completeOnSend === true, outcome: "completed" },
                  );
                  setDraft("");
                },
                style: {
                  alignItems: "center",
                  background: hudPanelWash,
                  border: `1px solid ${hudEdge}`,
                  borderRadius: 10,
                  display: "flex",
                  gap: 10,
                  marginTop: 4,
                  padding: 10,
                },
              },
              React.createElement(
                "textarea",
                {
                  "aria-label": props.composer.placeholder ?? "Message",
                  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(event.currentTarget.value),
                  placeholder: props.composer.placeholder ?? "Type a message...",
                  style: {
                    background: "var(--tint-row, rgba(2,18,32,0.20))",
                    border: "1px solid var(--edge, rgba(128,226,255,0.22))",
                    borderRadius: 6,
                    color: "var(--ink, rgba(235,252,255,0.96))",
                    flex: 1,
                    fontSize: 13,
                    minHeight: 38,
                    padding: "8px 10px",
                    resize: "vertical",
                  },
                  value: draft,
                },
              ),
              React.createElement(
                "button",
                {
                  style: {
                    background: toneFor("info").background,
                    border: `1px solid ${toneFor("info").border}`,
                    borderRadius: 8,
                    color: toneFor("info").text,
                    fontSize: 13,
                    fontWeight: 700,
                    padding: "8px 14px",
                  },
                  type: "submit",
                },
                props.composer.sendLabel ?? "Send",
              ),
            )
          : null,
      ),
    ));
  },
});

const Sparkline = defineComponent({
  name: "Sparkline",
  props: z.object({
    data: z.array(z.number()),
    height: z.number().int().min(20).max(120).optional(),
    tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
  }),
  description:
    "Inline mini line chart (no axes) for showing trend next to a number. Use inside Stat or alongside labels; for full charts use LineChart.",
  component: ({ props }) => {
    const height = props.height ?? 40;
    const values = props.data.length > 0 ? props.data : [0];
    const series = values.map((value, index) => ({ index, value }));
    const toneColor: Record<string, string> = {
      positive: "rgba(126, 174, 86, 0.92)",
      info: chartPalette.line,
      warning: "rgba(176, 142, 72, 0.92)",
      danger: "rgba(148, 72, 82, 0.92)",
      neutral: "rgba(154, 170, 150, 0.78)",
    };
    const stroke = toneColor[props.tone ?? "info"] ?? toneColor.info;
    return React.createElement(
      "div",
      { style: { height, width: "100%" } },
      React.createElement(
        RcResponsiveContainer as React.ElementType,
        { width: "100%", height: "100%" },
        React.createElement(
          RcLineChart,
          { data: series, margin: { top: 2, right: 2, left: 2, bottom: 2 } },
          React.createElement(RcLine, {
            type: "monotone",
            dataKey: "value",
            stroke,
            strokeWidth: 1.5,
            dot: false,
            activeDot: false,
            isAnimationActive: false,
          }),
        ),
      ),
    );
  },
});

const Stat = defineComponent({
  name: "Stat",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    label: z.string(),
    value: z.string(),
    delta: z.string().optional(),
    tone: z.enum(["positive", "neutral", "warning", "danger", "info"]).optional(),
    spark: z.array(z.number()).optional(),
    target: z.string().optional(),
    footnote: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Single hero KPI: one big number with optional delta, target, spark trend, and footnote. Use when one metric matters more than the rest; for several KPIs use MetricGrid.",
  component: ({ props }) => {
    const tone = toneFor(props.tone);
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 8, padding: 18 } },
        labelElement(props.label, props.tone ?? "neutral", "xs"),
        React.createElement(
          "div",
          { style: { alignItems: "baseline", color: tone.text, display: "flex", flexWrap: "wrap", gap: 12 } },
          React.createElement(
            "strong",
            { style: { color: tone.text, fontSize: 44, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1.05 } },
            props.value,
          ),
          props.delta ? labelElement(props.delta, props.tone ?? "info", "sm") : null,
        ),
        props.target
          ? React.createElement("div", { style: { color: hudTextMid, fontSize: 12 } }, `Target: ${props.target}`)
          : null,
        props.spark && props.spark.length > 0
          ? (() => {
              const sparkWidth = 240;
              const sparkHeight = 44;
              const sparkValues = props.spark!;
              const sMin = Math.min(...sparkValues);
              const sMax = Math.max(...sparkValues);
              const sSpan = Math.max(0.0001, sMax - sMin);
              const sPoints = sparkValues.map((value, index) => {
                const x = sparkValues.length === 1 ? sparkWidth / 2 : (index / (sparkValues.length - 1)) * sparkWidth;
                const y = sparkHeight - ((value - sMin) / sSpan) * sparkHeight;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
              });
              return React.createElement(
                "svg",
                { role: "img", style: { display: "block", height: sparkHeight, marginTop: 6, width: "100%" }, viewBox: `0 0 ${sparkWidth} ${sparkHeight}` },
                React.createElement("polyline", {
                  fill: "none",
                  points: sPoints.join(" "),
                  stroke: tone.accent,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  strokeWidth: 2.4,
                }),
              );
            })()
          : null,
        props.footnote
          ? React.createElement("p", { style: { color: hudTextSoft, fontSize: 12, lineHeight: 1.45, margin: 0 } }, props.footnote)
          : null,
      ),
    );
  },
});

const GeoHeatmap = defineComponent({
  name: "GeoHeatmap",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    regions: z.array(
      z.object({
        label: z.string(),
        value: z.number(),
        code: z.string().optional(),
      }),
    ),
    palette: z.enum(["sky", "mint", "amber", "rose"]).optional(),
    columns: z.number().int().min(2).max(8).optional(),
    ...glassProps,
  }),
  description:
    "Region-shaded heatmap rendered as a grid of colored tiles (states, prefectures, countries). Each region carries a numeric value; tile color scales by value. Use for share-by-region, density, or coverage where MapView pins would be too noisy.",
  component: ({ props }) => {
    const palettes = {
      sky: { from: "rgba(72,114,138,0.12)", to: "rgba(72,114,138,0.82)" },
      mint: { from: "rgba(72,138,82,0.12)", to: "rgba(126,174,86,0.82)" },
      amber: { from: "rgba(255,216,112,0.12)", to: "rgba(255,216,112,0.85)" },
      rose: { from: "rgba(255,96,126,0.12)", to: "rgba(255,96,126,0.85)" },
    } as const;
    const palette = palettes[props.palette ?? "sky"];
    const values = props.regions.map((r) => r.value);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 1;
    const span = Math.max(0.0001, max - min);
    const columns = props.columns ?? Math.min(6, Math.max(2, Math.ceil(Math.sqrt(props.regions.length))));
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        {
          style: {
            display: "grid",
            gap: 8,
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            padding: 14,
          },
        },
        props.regions.map((region, index) => {
          const ratio = (region.value - min) / span;
          const background = `color-mix(in srgb, ${palette.to} ${Math.round(ratio * 90 + 10)}%, ${palette.from})`;
          return React.createElement(
            "article",
            {
              key: `${region.label}:${index}`,
              style: {
                background,
                border: `1px solid ${hudEdge}`,
                borderRadius: 8,
                color: hudText,
                display: "grid",
                gap: 4,
                minHeight: 78,
                padding: 10,
              },
              title: `${region.label}: ${region.value}${props.unit ?? ""}`,
            },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 6, justifyContent: "space-between" } },
              React.createElement("strong", { style: { color: hudText, fontSize: 13 } }, region.label),
              region.code ? labelElement(region.code, "neutral", "xs") : null,
            ),
            React.createElement(
              "div",
              { style: { color: hudText, fontSize: 18, fontWeight: 800 } },
              `${region.value}${props.unit ?? ""}`,
            ),
          );
        }),
      ),
      React.createElement(
        "div",
        { style: { alignItems: "center", color: hudTextMid, display: "flex", fontSize: 11, gap: 8, padding: "0 14px 12px" } },
        React.createElement("span", null, `min ${min}${props.unit ?? ""}`),
        React.createElement("div", {
          style: {
            background: `linear-gradient(90deg, ${palette.from}, ${palette.to})`,
            border: `1px solid ${hudEdge}`,
            borderRadius: 4,
            flex: 1,
            height: 8,
          },
        }),
        React.createElement("span", null, `max ${max}${props.unit ?? ""}`),
      ),
    );
  },
});

const NotificationToast = defineComponent({
  name: "NotificationToast",
  props: z.object({
    title: z.string().optional(),
    message: z.string(),
    severity: z.enum(["info", "positive", "warning", "danger"]).default("info"),
    icon: z.string().optional(),
    time: z.string().optional(),
    action: z
      .object({
        label: z.string(),
        href: z.string().optional(),
      })
      .optional(),
    dismissLabel: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Compact banner-style toast for one-shot notifications: success, error, warning, or info with a single optional CTA. Use when you want a slim status strip rather than a full AlertList.",
  component: ({ props }) => {
    const tone = toneFor(props.severity);
    return React.createElement(
      "section",
      {
        role: "status",
        style: {
          ...panelStyleFor(props),
          background: tone.background,
          border: `1px solid ${tone.border}`,
        },
      },
      React.createElement(
        "div",
        { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12, padding: 14 } },
        React.createElement(
          "span",
          {
            "aria-hidden": true,
            style: {
              alignItems: "center",
              background: tone.accent,
              border: `1px solid ${tone.border}`,
              borderRadius: 999,
              color: hudText,
              display: "inline-flex",
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 800,
              height: 28,
              justifyContent: "center",
              width: 28,
            },
          },
          props.icon ?? (props.severity === "danger" ? "!" : props.severity === "warning" ? "!" : props.severity === "positive" ? "✓" : "i"),
        ),
        React.createElement(
          "div",
          { style: { display: "grid", flex: 1, gap: 2, minWidth: 0 } },
          props.title
            ? React.createElement("strong", { style: { color: tone.text, fontSize: 14, lineHeight: 1.3 } }, props.title)
            : null,
          React.createElement(
            "p",
            { style: { color: tone.text, fontSize: 13, lineHeight: 1.5, margin: 0, overflowWrap: "anywhere" } },
            props.message,
          ),
        ),
        props.time ? React.createElement("time", { style: { color: hudTextSoft, fontSize: 11 } }, props.time) : null,
        props.action
          ? React.createElement(
              props.action.href ? "a" : "button",
              {
                href: props.action.href,
                rel: props.action.href ? "noreferrer" : undefined,
                style: {
                  background: hudPanelWash,
                  border: `1px solid ${tone.border}`,
                  borderRadius: 7,
                  color: tone.text,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: "6px 12px",
                  textDecoration: "none",
                },
                target: props.action.href ? "_blank" : undefined,
                type: props.action.href ? undefined : "button",
              },
              props.action.label,
            )
          : null,
        props.dismissLabel
          ? labelElement(props.dismissLabel, "neutral", "xs")
          : null,
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
            resource.url ? "a" : "article",
            {
              href: resource.url,
              key: `${resource.title}:${index}`,
              rel: resource.url ? "noreferrer" : undefined,
              style: {
                background: hudPanelWash,
                border: `1px solid ${hudEdge}`,
                borderRadius: 8,
                color: "inherit",
                cursor: resource.url ? "pointer" : "default",
                display: "block",
                padding: 12,
                textDecoration: "none",
                ...readableGlassStyle,
              },
              target: resource.url ? "_blank" : undefined,
            },
            React.createElement(
              "div",
              { style: { alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" } },
              title,
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
        name: z.string().optional(),
        value: z.string().optional(),
        type: z.enum(["text", "number", "date", "select", "checkbox", "textarea"]).default("text"),
        options: z.array(z.string()).optional(),
        placeholder: z.string().optional(),
        editable: z.boolean().optional(),
        required: z.boolean().optional(),
        status: z.enum(["valid", "missing", "review"]).optional(),
        help: z.string().optional(),
      }),
    ),
    actionId: z.string().optional(),
    submitLabel: z.string().optional(),
    completeOnSubmit: z.boolean().optional(),
    ...glassProps,
  }),
  description:
    "Form summary and lightweight editable intake panel for approvals, required inputs, user confirmation, request review, and missing-field explanations. Set actionId to return submitted fields to the agent.",
  component: ({ props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [values, setValues] = React.useState<Record<string, string>>(() =>
      Object.fromEntries(props.fields.map((field, index) => [field.name ?? field.label ?? `field_${index + 1}`, field.value ?? ""])),
    );
    const updateField = (key: string, value: string, reportEvent: PopupEventReporter | null) => {
      setValues((current) => ({ ...current, [key]: value }));
      emitPopupEvent(reportEvent, {
        kind: "input",
        component: "FormPanel",
        actionId: actionIdFor("FormPanel", props.actionId, `field.${key}`),
        label: key,
        value,
      });
    };

    return popupEventConsumer((reportEvent) => React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "form",
        {
          onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            emitPopupEvent(
              reportEvent,
              {
                kind: "submit",
                component: "FormPanel",
                actionId: actionIdFor("FormPanel", props.actionId, "submit"),
                label: props.submitLabel ?? "Submit",
                fields: values,
              },
              { complete: props.completeOnSubmit !== false, outcome: "completed" },
            );
          },
          style: { display: "grid", gap: 10, padding: 14 },
        },
        props.fields.map((field, index) => {
          const tone = toneFor(field.status === "valid" ? "positive" : field.status === "missing" ? "danger" : "warning");
          const key = field.name ?? field.label ?? `field_${index + 1}`;
          const inputId = `genui-form-${key.replace(/[^a-z0-9_-]/gi, "-")}-${index}`;
          const editable = field.editable === true || Boolean(props.actionId);
          const commonInputStyle = {
            background: "var(--tint-row, rgba(2,18,32,0.20))",
            border: "1px solid var(--edge, rgba(128,226,255,0.22))",
            borderRadius: 6,
            color: "var(--ink, rgba(235,252,255,0.96))",
            fontSize: 14,
            minHeight: field.type === "textarea" ? 72 : 36,
            padding: "8px 9px",
            whiteSpace: "pre-wrap" as const,
            width: "100%",
          };
          return React.createElement(
            "div",
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
              "label",
              {
                htmlFor: editable ? inputId : undefined,
                style: { alignItems: "center", color: hudTextMid, display: "flex", flexWrap: "wrap", fontSize: 12, fontWeight: 800, gap: 6 },
              },
              labelElement(field.label, field.status === "valid" ? "positive" : field.status === "missing" ? "danger" : "neutral", "xs"),
              field.required ? labelElement("required", "danger", "xs") : null,
              field.status ? labelElement(field.status, field.status === "valid" ? "positive" : field.status === "missing" ? "danger" : "warning", "xs") : null,
            ),
            editable && field.type === "textarea"
              ? React.createElement("textarea", {
                  id: inputId,
                  name: key,
                  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => updateField(key, event.currentTarget.value, reportEvent),
                  placeholder: field.placeholder,
                  required: field.required,
                  style: { ...commonInputStyle, resize: "vertical" },
                  value: values[key] ?? "",
                })
              : editable && field.type === "select" && field.options?.length
                ? React.createElement(
                    "select",
                    {
                      id: inputId,
                      name: key,
                      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => updateField(key, event.currentTarget.value, reportEvent),
                      required: field.required,
                      style: commonInputStyle,
                      value: values[key] ?? "",
                    },
                    React.createElement("option", { value: "" }, field.placeholder ?? "Select..."),
                    field.options.map((option) => React.createElement("option", { key: option, value: option }, option)),
                  )
                : editable && field.type === "checkbox"
                  ? React.createElement("input", {
                      checked: values[key] === "true",
                      id: inputId,
                      name: key,
                      onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateField(key, event.currentTarget.checked ? "true" : "false", reportEvent),
                      required: field.required,
                      style: { height: 18, width: 18 },
                      type: "checkbox",
                    })
                  : editable
                    ? React.createElement("input", {
                        id: inputId,
                        name: key,
                        onChange: (event: React.ChangeEvent<HTMLInputElement>) => updateField(key, event.currentTarget.value, reportEvent),
                        placeholder: field.placeholder,
                        required: field.required,
                        style: commonInputStyle,
                        type: field.type === "number" ? "number" : field.type === "date" ? "date" : "text",
                        value: values[key] ?? "",
                      })
                    : React.createElement("div", { style: commonInputStyle }, values[key] || "Not provided"),
            field.help ? React.createElement("span", { style: { color: hudTextSoft, fontSize: 12 } }, field.help) : null,
          );
        }),
        props.actionId || props.submitLabel
          ? React.createElement(
              "button",
              {
                style: {
                  background: toneFor("info").background,
                  border: `1px solid ${toneFor("info").border}`,
                  borderRadius: 8,
                  color: toneFor("info").text,
                  fontSize: 14,
                  fontWeight: 800,
                  justifySelf: "start",
                  padding: "9px 14px",
                },
                type: "submit",
              },
              props.submitLabel ?? "Submit",
            )
          : null,
      ),
    ));
  },
});

// ────────────────────────────────────────────────────────────────────
// Extended cards: media, decisions, comparison, code, schedule, people,
// diagnostics, quick actions, transcripts, charts, trees, wizards.
// ────────────────────────────────────────────────────────────────────

const ImageGallery = defineComponent({
  name: "ImageGallery",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().optional(),
          caption: z.string().optional(),
        }),
      )
      .min(1),
    columns: z.number().int().min(1).max(6).optional(),
    ...glassProps,
  }),
  description:
    "Image gallery for screenshots, photo previews, design candidates, store/cafe imagery, and visual evidence. Shows a focused preview with selectable thumbnails.",
  component: ({ props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    const selected = props.images[Math.min(selectedIndex, props.images.length - 1)];

    return React.createElement(
      "section",
      { "data-lg-widget": "image-gallery", style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "figure",
          { style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 10, margin: 0, overflow: "hidden" } },
          React.createElement("img", {
            alt: selected.alt ?? selected.caption ?? `image ${selectedIndex + 1}`,
            "data-lg-gallery-image": "true",
            src: selected.src,
            style: { aspectRatio: "16 / 9", display: "block", height: "auto", objectFit: "contain", width: "100%" },
          }),
          React.createElement(
            "figcaption",
            {
              style: {
                alignItems: "center",
                color: hudTextMid,
                display: "flex",
                flexWrap: "wrap",
                fontSize: 12,
                gap: 8,
                justifyContent: "space-between",
                padding: "8px 10px",
              },
            },
            React.createElement("span", { "data-lg-gallery-caption": "true" }, selected.caption ?? selected.alt ?? `Image ${selectedIndex + 1}`),
            labelElement(`${selectedIndex + 1}/${props.images.length}`, "info", "xs"),
          ),
        ),
        props.images.length > 1
          ? React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: `repeat(${props.columns ?? Math.min(4, Math.max(1, props.images.length))}, minmax(0, 1fr))`,
                },
              },
              props.images.map((img, index) => {
                const selectedImage = index === selectedIndex;
                return React.createElement(
                  "button",
                  {
                    "aria-current": selectedImage ? "true" : undefined,
                    "data-lg-alt": img.alt,
                    "data-lg-caption": img.caption,
                    "data-lg-gallery-item": "true",
                    "data-lg-src": img.src,
                    key: `${img.src}:${index}`,
                    onClick: () => setSelectedIndex(index),
                    style: {
                      background: selectedImage ? "rgba(86, 174, 122, 0.16)" : hudPanelWash,
                      border: `1px solid ${selectedImage ? "rgba(126, 220, 164, 0.55)" : hudEdge}`,
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "grid",
                      gap: 6,
                      overflow: "hidden",
                      padding: 0,
                      textAlign: "left",
                    },
                    type: "button",
                  },
                  React.createElement("img", {
                    alt: img.alt ?? img.caption ?? `image ${index + 1}`,
                    src: img.src,
                    style: { aspectRatio: "4 / 3", display: "block", height: "auto", objectFit: "cover", width: "100%" },
                  }),
                  React.createElement(
                    "span",
                    {
                      style: {
                        color: selectedImage ? hudText : hudTextMid,
                        fontSize: 12,
                        fontWeight: selectedImage ? 800 : 600,
                        padding: "0 8px 8px",
                      },
                    },
                    img.caption ?? img.alt ?? `Image ${index + 1}`,
                  ),
                );
              }),
            )
          : null,
      ),
    );
  },
});

const ConfirmDialog = defineComponent({
  name: "ConfirmDialog",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    question: z.string(),
    detail: z.string().optional(),
    risk: z.enum(["low", "medium", "high", "critical"]).optional(),
    confirmLabel: z.string().optional(),
    cancelLabel: z.string().optional(),
    actionId: z.string().optional(),
    completeOnAction: z.boolean().optional(),
    consequences: z.array(z.string()).optional(),
    ...glassProps,
  }),
  description:
    "Single high-stakes confirmation card with one accept and one decline action. Use for delete/approve/deploy/destructive prompts and agent autonomy gates. Set actionId so the clicked decision is returned to the agent when the popup is completed.",
  component: ({ props }) => {
    const tone = toneFor(
      props.risk === "critical" || props.risk === "high" ? "danger" : props.risk === "medium" ? "warning" : "info",
    );
    return popupEventConsumer((reportEvent) => React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "p",
          { style: { color: hudText, fontSize: 16, fontWeight: 700, margin: 0 } },
          props.question,
        ),
        props.detail
          ? React.createElement("p", { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: 0 } }, props.detail)
          : null,
        props.consequences && props.consequences.length > 0
          ? React.createElement(
              "ul",
              { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, margin: 0, paddingLeft: 18 } },
              props.consequences.map((c, i) => React.createElement("li", { key: i }, c)),
            )
          : null,
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
          React.createElement(
            "button",
            {
              onClick: () =>
                emitPopupEvent(
                  reportEvent,
                  {
                    kind: "action",
                    component: "ConfirmDialog",
                    actionId: actionIdFor("ConfirmDialog", props.actionId, "confirm"),
                    label: props.confirmLabel ?? "Confirm",
                    value: "confirm",
                    fields: { question: props.question, risk: props.risk ?? "low" },
                  },
                  { complete: props.completeOnAction !== false, outcome: "completed" },
                ),
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                color: tone.text,
                fontSize: 14,
                fontWeight: 700,
                padding: "8px 14px",
              },
              type: "button",
            },
            props.confirmLabel ?? "Confirm",
          ),
          React.createElement(
            "button",
            {
              onClick: () =>
                emitPopupEvent(
                  reportEvent,
                  {
                    kind: "action",
                    component: "ConfirmDialog",
                    actionId: actionIdFor("ConfirmDialog", props.actionId, "cancel"),
                    label: props.cancelLabel ?? "Cancel",
                    value: "cancel",
                    fields: { question: props.question, risk: props.risk ?? "low" },
                  },
                  { complete: props.completeOnAction !== false, outcome: "cancelled" },
                ),
              style: {
                background: hudPanelWash,
                border: `1px solid ${hudEdge}`,
                borderRadius: 8,
                color: hudTextMid,
                fontSize: 14,
                padding: "8px 14px",
              },
              type: "button",
            },
            props.cancelLabel ?? "Cancel",
          ),
          props.risk ? labelElement(`risk: ${props.risk}`, props.risk === "critical" || props.risk === "high" ? "danger" : props.risk === "medium" ? "warning" : "info", "sm") : null,
        ),
      ),
    ));
  },
});

const CompareTable = defineComponent({
  name: "CompareTable",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    options: z.array(
      z.object({
        name: z.string(),
        tagline: z.string().optional(),
        recommended: z.boolean().optional(),
        specs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
      }),
    ),
    specOrder: z.array(z.string()).optional(),
    ...glassProps,
  }),
  description:
    "Side-by-side option comparison with spec rows shared across columns. Use for plan/library/API comparisons where each option has the same set of attributes.",
  component: ({ props }) => {
    const allKeys =
      props.specOrder && props.specOrder.length > 0
        ? props.specOrder
        : Array.from(new Set(props.options.flatMap((o) => Object.keys(o.specs))));
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { overflowX: "auto", padding: 14 } },
        React.createElement(
          "table",
          { style: { borderCollapse: "collapse", color: hudText, fontSize: 13, minWidth: "100%" } },
          React.createElement(
            "thead",
            null,
            React.createElement(
              "tr",
              null,
              React.createElement(
                "th",
                { style: { borderBottom: `1px solid ${hudEdge}`, color: hudTextMid, fontWeight: 700, padding: "8px 10px", textAlign: "left" } },
                "Spec",
              ),
              ...props.options.map((o) =>
                React.createElement(
                  "th",
                  {
                    key: o.name,
                    style: {
                      borderBottom: `1px solid ${hudEdge}`,
                      color: o.recommended ? toneFor("positive").text : hudText,
                      fontWeight: 800,
                      padding: "8px 10px",
                      textAlign: "left",
                    },
                  },
                  o.name,
                  o.recommended ? " ★" : "",
                ),
              ),
            ),
          ),
          React.createElement(
            "tbody",
            null,
            allKeys.map((key) =>
              React.createElement(
                "tr",
                { key },
                React.createElement(
                  "td",
                  { style: { borderBottom: `1px solid ${hudEdge}`, color: hudTextMid, padding: "8px 10px" } },
                  key,
                ),
                ...props.options.map((o) =>
                  React.createElement(
                    "td",
                    { key: o.name, style: { borderBottom: `1px solid ${hudEdge}`, color: hudText, padding: "8px 10px" } },
                    formatCellValue(o.specs[key]),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  },
});

function codeLineNodes(line: string, language: string | undefined, lineIndex: number): React.ReactNode[] {
  const lang = language?.toLowerCase() ?? "";
  if (lang.includes("diff") || lang === "patch") {
    const tone =
      line.startsWith("+") && !line.startsWith("+++")
        ? "#8ef0b4"
        : line.startsWith("-") && !line.startsWith("---")
          ? "#ff9aa8"
          : line.startsWith("@@")
            ? "#9ed8ff"
            : undefined;
    return [React.createElement("span", { key: `diff:${lineIndex}`, style: tone ? { color: tone, fontWeight: 700 } : undefined }, line)];
  }

  const keywordPattern =
    /\b(?:async|await|break|case|catch|class|const|continue|def|else|export|false|finally|for|from|function|if|import|in|interface|let|null|return|throw|true|try|type|var|while)\b/g;
  const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/.*|#.*|\b\d+(?:\.\d+)?\b)/g;
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  const pushPlain = (text: string, key: string) => {
    let offset = 0;
    for (const match of text.matchAll(keywordPattern)) {
      if (match.index === undefined) continue;
      if (match.index > offset) nodes.push(text.slice(offset, match.index));
      nodes.push(React.createElement("span", { key: `${key}:kw:${match.index}`, style: { color: "#9ed8ff", fontWeight: 700 } }, match[0]));
      offset = match.index + match[0].length;
    }
    if (offset < text.length) nodes.push(text.slice(offset));
  };

  for (const match of line.matchAll(tokenPattern)) {
    if (match.index === undefined) continue;
    if (match.index > cursor) pushPlain(line.slice(cursor, match.index), `${lineIndex}:${match.index}`);
    const token = match[0];
    const color = token.startsWith("//") || token.startsWith("#") ? "#94a3b8" : /^["'`]/.test(token) ? "#b8f7c9" : "#ffd38a";
    nodes.push(React.createElement("span", { key: `${lineIndex}:tok:${match.index}`, style: { color } }, token));
    cursor = match.index + token.length;
  }
  if (cursor < line.length) pushPlain(line.slice(cursor), `${lineIndex}:tail`);
  return nodes.length > 0 ? nodes : [line];
}

const CodeBlock = defineComponent({
  name: "CodeBlock",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    language: z.string().optional(),
    code: z.string(),
    runnable: z.boolean().optional(),
    filename: z.string().optional(),
    showLineNumbers: z.boolean().optional(),
    ...glassProps,
  }),
  description:
    "Single highlighted code or command snippet with optional filename, language label, line numbers, and runnable hint. Use whenever the answer is a piece of code to paste or a command to execute (not a multi-file diff).",
  component: ({ props }) => {
    const lines = props.code.split(/\r?\n/);
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { padding: 14 } },
        React.createElement(
          "div",
          { style: { alignItems: "center", display: "flex", gap: 8, marginBottom: 8 } },
          props.filename ? labelElement(props.filename, "neutral", "xs") : null,
          props.language ? labelElement(props.language, "info", "xs") : null,
          props.runnable ? labelElement("runnable", "positive", "xs") : null,
        ),
        React.createElement(
          "div",
          {
            style: {
              background: "rgba(2,18,32,0.40)",
              border: `1px solid ${hudEdge}`,
              borderRadius: 8,
              color: hudText,
              fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
              fontSize: 13,
              lineHeight: 1.55,
              margin: 0,
              maxHeight: 480,
              overflow: "auto",
              padding: 12,
              whiteSpace: "pre",
            },
          },
          React.createElement(
            "pre",
            { style: { display: "grid", font: "inherit", margin: 0, minWidth: "max-content" } },
            lines.map((line, index) =>
              React.createElement(
                "span",
                { key: index, style: { display: "grid", gridTemplateColumns: props.showLineNumbers === false ? "1fr" : "4ch 1fr", gap: 12 } },
                props.showLineNumbers === false
                  ? null
                  : React.createElement("span", { style: { color: "rgba(203, 232, 255, 0.42)", textAlign: "right", userSelect: "none" } }, index + 1),
                React.createElement("span", null, codeLineNodes(line, props.language, index)),
              ),
            ),
          ),
        ),
      ),
    );
  },
});

const DataPreview = defineComponent({
  name: "DataPreview",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    schema: z
      .array(z.object({ name: z.string(), type: z.string().optional(), nullable: z.boolean().optional() }))
      .optional(),
    sampleRows: z.array(z.record(z.string(), z.unknown())),
    truncated: z.boolean().optional(),
    rowCount: z.number().int().nonnegative().optional(),
    contextPath: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Developer-facing preview of raw structured data (SQL result, CSV head, JSON sample). Shows column types and the first N rows. Use when DataTable is too formal. For large row sets, pass empty sampleRows and set contextPath to read records from --context-file.",
  component: ({ props }) => {
    return runtimeDataConsumer((runtimeData) => {
      const contextRows = normalizeRecordRows(getContextPathValue(runtimeData, props.contextPath));
      const sampleRows = contextRows.length > 0 ? contextRows : props.sampleRows;
      const schema = props.schema?.length ? props.schema : inferSchemaFromRows(sampleRows);
      const keys = schema.map((c) => c.name);
      const rowCount =
        contextRows.length > 0 && (props.rowCount === undefined || props.rowCount === 0)
          ? contextRows.length
          : props.rowCount;

      return React.createElement(
        "section",
        { style: panelStyleFor(props) },
        panelHeader(props.title, props.description),
        React.createElement(
          "div",
          { style: { display: "grid", gap: 8, padding: 14 } },
          React.createElement(
            "div",
            { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 6 } },
            props.source ? labelElement(props.source, "info", "xs") : null,
            rowCount !== undefined ? labelElement(`${rowCount} rows`, "neutral", "xs") : null,
            props.truncated ? labelElement("truncated", "warning", "xs") : null,
          ),
          React.createElement(
            "div",
            { style: { maxHeight: 360, overflow: "auto" } },
            React.createElement(
              "table",
              { style: { borderCollapse: "collapse", color: hudText, fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 12, minWidth: "100%" } },
              React.createElement(
                "thead",
                null,
                React.createElement(
                  "tr",
                  null,
                  keys.map((k) => {
                    const schemaCol = schema.find((c) => c.name === k);
                    return React.createElement(
                      "th",
                      {
                        key: k,
                        style: { borderBottom: `1px solid ${hudEdge}`, color: hudTextMid, fontWeight: 700, padding: "6px 8px", textAlign: "left", whiteSpace: "nowrap" },
                      },
                      k,
                      schemaCol?.type ? React.createElement("span", { style: { color: hudTextSoft, fontWeight: 400, marginLeft: 6 } }, `:${schemaCol.type}`) : null,
                    );
                  }),
                ),
              ),
              React.createElement(
                "tbody",
                null,
                sampleRows.slice(0, 50).map((row, i) =>
                  React.createElement(
                    "tr",
                    { key: i },
                    keys.map((k) =>
                      React.createElement(
                        "td",
                        {
                          key: k,
                          style: { borderBottom: `1px solid ${hudEdge}`, color: hudText, padding: "6px 8px", whiteSpace: "nowrap" },
                        },
                        formatCellValue(row[k]),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    });
  },
});

const LongText = defineComponent({
  name: "LongText",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(),
    sections: z
      .array(
        z.object({
          heading: z.string().optional(),
          body: z.string(),
        }),
      )
      .optional(),
    language: z.string().optional(),
    source: z.string().optional(),
    maxHeight: z.number().int().min(180).max(900).optional(),
    ...glassProps,
  }),
  description:
    "Readable long-form text viewer for articles, specs, policies, transcripts, legal copy, and generated drafts. Preserves paragraphs and line breaks, supports optional sections, source/language labels, and a bounded scroll area.",
  component: ({ props }) => {
    const maxHeight = props.maxHeight ?? 520;
    const sections = props.sections?.length
      ? props.sections
      : props.content
        ? [{ body: props.content }]
        : [];
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        props.language || props.source
          ? React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 6 } },
              props.language ? labelElement(props.language, "info", "xs") : null,
              props.source ? labelElement(props.source, "neutral", "xs") : null,
            )
          : null,
        React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gap: 18,
              maxHeight,
              overflow: "auto",
              paddingRight: 4,
            },
          },
          sections.length > 0
            ? sections.map((section, index) =>
                React.createElement(
                  "article",
                  { key: `${section.heading ?? "section"}:${index}`, style: { display: "grid", gap: 8 } },
                  section.heading
                    ? React.createElement(
                        "h4",
                        {
                          style: {
                            color: hudText,
                            fontSize: 15,
                            fontWeight: 820,
                            letterSpacing: 0,
                            lineHeight: 1.35,
                            margin: 0,
                            textWrap: "balance",
                          },
                        },
                        section.heading,
                      )
                    : null,
                  textPanel(section.body, `long:${index}`),
                ),
              )
            : React.createElement("p", { style: { color: hudTextSoft, fontSize: 13, margin: 0 } }, "No text provided."),
        ),
      ),
    );
  },
});

const TranslationPanel = defineComponent({
  name: "TranslationPanel",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    sourceLanguage: z.string(),
    targetLanguage: z.string(),
    sourceText: z.string().optional(),
    translatedText: z.string(),
    notes: z.array(z.string()).optional(),
    terms: z
      .array(
        z.object({
          source: z.string(),
          target: z.string(),
          note: z.string().optional(),
        }),
      )
      .optional(),
    maxHeight: z.number().int().min(180).max(900).optional(),
    ...glassProps,
  }),
  description:
    "Focused translation review panel with source/target language labels, translated text, optional source excerpt, translator notes, and glossary terms.",
  component: ({ props }) => {
    const maxHeight = props.maxHeight ?? 440;
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "div",
          { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 6 } },
          labelElement(props.sourceLanguage, "neutral", "xs"),
          labelElement("to", "info", "xs"),
          labelElement(props.targetLanguage, "positive", "xs"),
        ),
        props.sourceText
          ? React.createElement(
              "details",
              { style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 8, padding: 10 } },
              React.createElement("summary", { style: { color: hudTextMid, cursor: "pointer", fontSize: 12, fontWeight: 800 } }, "Source text"),
              React.createElement("div", { style: { marginTop: 10 } }, textPanel(props.sourceText, "translation-source", { maxHeight: Math.min(220, maxHeight) })),
            )
          : null,
        React.createElement(
          "article",
          { style: { ...cardSurfaceStyle(toneFor("positive"), { padding: 12 }), display: "grid", gap: 10 } },
          React.createElement("h4", { style: { color: hudText, fontSize: 15, margin: 0 } }, "Translation"),
          textPanel(props.translatedText, "translation-target", { maxHeight }),
        ),
        props.notes?.length
          ? React.createElement(
              "ul",
              { style: { color: hudTextMid, display: "grid", fontSize: 12, gap: 6, lineHeight: 1.5, margin: 0, paddingLeft: 18 } },
              props.notes.map((note, index) => React.createElement("li", { key: `${note}:${index}`, style: { textWrap: "pretty" } }, note)),
            )
          : null,
        props.terms?.length
          ? React.createElement(
              "div",
              { style: { display: "grid", gap: 6 } },
              props.terms.map((term, index) =>
                React.createElement(
                  "div",
                  {
                    key: `${term.source}:${index}`,
                    style: {
                      alignItems: "baseline",
                      borderTop: index === 0 ? undefined : `1px solid ${hudEdge}`,
                      display: "grid",
                      gap: 4,
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                      paddingTop: index === 0 ? 0 : 8,
                    },
                  },
                  labelElement(term.source, "neutral", "xs"),
                  React.createElement("span", { style: { color: hudText, fontSize: 13, fontWeight: 760, overflowWrap: "anywhere" } }, term.target),
                  term.note ? React.createElement("span", { style: { color: hudTextSoft, fontSize: 12, gridColumn: "1 / -1", lineHeight: 1.4 } }, term.note) : null,
                ),
              ),
            )
          : null,
      ),
    );
  },
});

const TranslationCompare = defineComponent({
  name: "TranslationCompare",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    sourceLanguage: z.string(),
    targetLanguage: z.string(),
    segments: z.array(
      z.object({
        id: z.string().optional(),
        source: z.string(),
        translation: z.string(),
        note: z.string().optional(),
        status: z.enum(["ok", "review", "changed", "missing"]).optional(),
      }),
    ),
    maxHeight: z.number().int().min(220).max(900).optional(),
    ...glassProps,
  }),
  description:
    "Side-by-side translation comparison for reviewing original and translated text by segment. Use for bilingual QA, localization review, wording checks, and before/after translation edits.",
  component: ({ props }) => {
    const maxHeight = props.maxHeight ?? 560;
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "div",
          {
            style: {
              color: hudTextMid,
              display: "grid",
              fontSize: 12,
              fontWeight: 840,
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
            },
          },
          labelElement(props.sourceLanguage, "neutral", "xs"),
          labelElement(props.targetLanguage, "positive", "xs"),
        ),
        React.createElement(
          "div",
          { style: { display: "grid", gap: 10, maxHeight, overflow: "auto", paddingRight: 4 } },
          props.segments.map((segment, index) => {
            const toneKey = segment.status === "missing" ? "danger" : segment.status === "review" ? "warning" : segment.status === "changed" ? "info" : "neutral";
            const tone = toneFor(toneKey);
            return React.createElement(
              "article",
              {
                key: segment.id ?? index,
                style: {
                  ...cardSurfaceStyle(tone, { padding: 10 }),
                  display: "grid",
                  gap: 8,
                },
              },
              React.createElement(
                "div",
                { style: { alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" } },
                labelElement(segment.id ?? `#${index + 1}`, "neutral", "xs"),
                segment.status ? labelElement(segment.status, toneKey, "xs") : null,
              ),
              React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                  },
                },
                React.createElement("div", { style: { minWidth: 0 } }, textPanel(segment.source, `compare-source:${index}`)),
                React.createElement("div", { style: { minWidth: 0 } }, textPanel(segment.translation, `compare-target:${index}`)),
              ),
              segment.note ? React.createElement("p", { style: { color: hudTextSoft, fontSize: 12, lineHeight: 1.45, margin: 0, textWrap: "pretty" } }, segment.note) : null,
            );
          }),
        ),
      ),
    );
  },
});

const WeatherCard = defineComponent({
  name: "WeatherCard",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    location: z.string(),
    summary: z.string(),
    temperature: z.union([z.string(), z.number()]).optional(),
    feelsLike: z.union([z.string(), z.number()]).optional(),
    highLow: z.string().optional(),
    icon: z.string().optional(),
    forecast: z
      .array(z.object({ time: z.string(), summary: z.string(), temperature: z.union([z.string(), z.number()]).optional(), icon: z.string().optional() }))
      .optional(),
    ...glassProps,
  }),
  description:
    "Today/forecast weather card with location, temperature, summary, optional hourly/daily forecast row.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title ?? props.location, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "div",
          { style: { alignItems: "baseline", display: "flex", flexWrap: "wrap", gap: 12 } },
          props.icon ? React.createElement("span", { style: { fontSize: 36, lineHeight: 1 } }, props.icon) : null,
          React.createElement("span", { style: { color: hudText, fontSize: 36, fontWeight: 700, letterSpacing: -0.5 } }, formatCellValue(props.temperature ?? "--")),
          React.createElement("span", { style: { color: hudTextMid, fontSize: 14 } }, props.summary),
          props.highLow ? labelElement(props.highLow, "neutral", "xs") : null,
          props.feelsLike !== undefined ? labelElement(`feels ${formatCellValue(props.feelsLike)}`, "info", "xs") : null,
        ),
        props.forecast && props.forecast.length > 0
          ? React.createElement(
              "div",
              { style: { display: "grid", gap: 8, gridTemplateColumns: `repeat(${Math.min(props.forecast.length, 6)}, minmax(0, 1fr))` } },
              props.forecast.slice(0, 6).map((f, i) =>
                React.createElement(
                  "div",
                  { key: i, style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 8, padding: 8, textAlign: "center" } },
                  React.createElement("div", { style: { color: hudTextMid, fontSize: 12 } }, f.time),
                  f.icon ? React.createElement("div", { style: { fontSize: 20 } }, f.icon) : null,
                  React.createElement("div", { style: { color: hudText, fontSize: 14, fontWeight: 700 } }, formatCellValue(f.temperature ?? "--")),
                  React.createElement("div", { style: { color: hudTextSoft, fontSize: 11 } }, f.summary),
                ),
              ),
            )
          : null,
      ),
    ),
});

const EventList = defineComponent({
  name: "EventList",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    events: z.array(
      z.object({
        title: z.string(),
        start: z.string(),
        end: z.string().optional(),
        location: z.string().optional(),
        category: z.string().optional(),
        attendees: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Today/upcoming events agenda. Use for schedules, meetings, news-of-the-day, releases scheduled by time, and calendar handoffs.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "ul",
        { style: { display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 14 } },
        props.events.map((e, i) =>
          React.createElement(
            "li",
            {
              key: i,
              style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 8, display: "grid", gap: 4, padding: 10 },
            },
            React.createElement(
              "div",
              { style: { alignItems: "baseline", display: "flex", flexWrap: "wrap", gap: 8 } },
              React.createElement("span", { style: { color: hudText, fontSize: 15, fontWeight: 700 } }, e.title),
              e.category ? labelElement(e.category, "info", "xs") : null,
            ),
            React.createElement(
              "div",
              { style: { color: hudTextMid, fontSize: 12 } },
              e.start + (e.end ? ` — ${e.end}` : ""),
              e.location ? ` · ${e.location}` : "",
            ),
            e.attendees && e.attendees.length > 0
              ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12 } }, e.attendees.join(", "))
              : null,
            e.notes ? React.createElement("div", { style: { color: hudTextSoft, fontSize: 12 } }, e.notes) : null,
          ),
        ),
      ),
    ),
});

const PersonCard = defineComponent({
  name: "PersonCard",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    people: z.array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        avatar: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        status: z.string().optional(),
        bio: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "People / contact card grid: name, role, avatar, contact channels, presence status. Use for team intros, reviewer lists, owner handoffs.",
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
            gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, props.people.length))}, minmax(0, 1fr))`,
            padding: 14,
          },
        },
        props.people.map((p, i) =>
          React.createElement(
            "div",
            { key: i, style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 10, display: "grid", gap: 6, padding: 12 } },
            React.createElement(
              "div",
              { style: { alignItems: "center", display: "flex", gap: 10 } },
              p.avatar
                ? React.createElement("img", {
                    alt: p.name,
                    src: p.avatar,
                    style: { borderRadius: 999, height: 40, objectFit: "cover", width: 40 },
                  })
                : React.createElement(
                    "div",
                    {
                      style: {
                        alignItems: "center",
                        background: hudCellWash,
                        border: `1px solid ${hudEdge}`,
                        borderRadius: 999,
                        color: hudText,
                        display: "flex",
                        fontWeight: 800,
                        height: 40,
                        justifyContent: "center",
                        width: 40,
                      },
                    },
                    p.name.slice(0, 2).toUpperCase(),
                  ),
              React.createElement(
                "div",
                { style: { display: "grid" } },
                React.createElement("div", { style: { color: hudText, fontSize: 14, fontWeight: 700 } }, p.name),
                p.role ? React.createElement("div", { style: { color: hudTextMid, fontSize: 12 } }, p.role) : null,
              ),
            ),
            p.status ? labelElement(p.status, "info", "xs") : null,
            p.bio ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.5, margin: 0 } }, p.bio) : null,
            p.email || p.phone
              ? React.createElement(
                  "div",
                  { style: { color: hudTextSoft, fontSize: 12 } },
                  [p.email, p.phone].filter(Boolean).join(" · "),
                )
              : null,
          ),
        ),
      ),
    ),
});

const DiagnosticsCard = defineComponent({
  name: "DiagnosticsCard",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    checks: z.array(
      z.object({
        name: z.string(),
        status: z.enum(["pass", "warn", "fail", "skip", "pending"]),
        detail: z.string().optional(),
        durationMs: z.number().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Pre-flight / health-check style list of named checks each with pass|warn|fail|skip|pending. Use for CI status, env diagnostics, lint/types/tests rollups, deploy gates.",
  component: ({ props }) => {
    const counts = props.checks.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 10, padding: 14 } },
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
          counts.pass ? labelElement(`pass ${counts.pass}`, "positive", "xs") : null,
          counts.warn ? labelElement(`warn ${counts.warn}`, "warning", "xs") : null,
          counts.fail ? labelElement(`fail ${counts.fail}`, "danger", "xs") : null,
          counts.skip ? labelElement(`skip ${counts.skip}`, "neutral", "xs") : null,
          counts.pending ? labelElement(`pending ${counts.pending}`, "info", "xs") : null,
        ),
        React.createElement(
          "ul",
          { style: { display: "grid", gap: 6, listStyle: "none", margin: 0, padding: 0 } },
          props.checks.map((c, i) => {
            const tone = toneFor(
              c.status === "pass" ? "positive" : c.status === "warn" ? "warning" : c.status === "fail" ? "danger" : c.status === "pending" ? "info" : "neutral",
            );
            return React.createElement(
              "li",
              {
                key: i,
                style: {
                  alignItems: "center",
                  background: tone.background,
                  border: `1px solid ${tone.border}`,
                  borderRadius: 8,
                  display: "grid",
                  gap: 4,
                  padding: "8px 10px",
                },
              },
              React.createElement(
                "div",
                { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 } },
                labelElement(c.status, c.status === "pass" ? "positive" : c.status === "warn" ? "warning" : c.status === "fail" ? "danger" : c.status === "pending" ? "info" : "neutral", "xs"),
                React.createElement("span", { style: { color: hudText, fontSize: 13, fontWeight: 700 } }, c.name),
                c.durationMs !== undefined ? React.createElement("span", { style: { color: hudTextSoft, fontSize: 11 } }, `${c.durationMs}ms`) : null,
              ),
              c.detail ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.4, margin: 0 } }, c.detail) : null,
            );
          }),
        ),
      ),
    );
  },
});

const QuickActions = defineComponent({
  name: "QuickActions",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    actions: z.array(
      z.object({
        label: z.string(),
        icon: z.string().optional(),
        tone: z.enum(["neutral", "info", "positive", "warning", "danger"]).optional(),
        hint: z.string().optional(),
        href: z.string().optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Tile-style row of short next-step buttons. Use for command palettes, home dashboards, recurring shortcuts. Different from ActionPanel — no description per item, optimized for picking quickly.",
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
            gap: 8,
            gridTemplateColumns: `repeat(${Math.min(4, Math.max(2, props.actions.length))}, minmax(0, 1fr))`,
            padding: 14,
          },
        },
        props.actions.map((a, i) => {
          const tone = toneFor(a.tone ?? "info");
          return React.createElement(
            a.href ? "a" : "button",
            {
              href: a.href,
              key: i,
              rel: a.href ? "noreferrer" : undefined,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 10,
                color: tone.text,
                cursor: "pointer",
                display: "grid",
                gap: 4,
                padding: "10px 12px",
                textAlign: "left",
                textDecoration: "none",
              },
              target: a.href ? "_blank" : undefined,
              type: a.href ? undefined : "button",
            },
            React.createElement(
              "span",
              { style: { alignItems: "center", display: "flex", fontSize: 14, fontWeight: 700, gap: 6 } },
              a.icon ? React.createElement("span", null, a.icon) : null,
              a.label,
            ),
            a.hint ? React.createElement("span", { style: { color: hudTextSoft, fontSize: 11 } }, a.hint) : null,
          );
        }),
      ),
    ),
});

const TranscriptView = defineComponent({
  name: "TranscriptView",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    messages: z.array(
      z.object({
        speaker: z.string(),
        role: z.enum(["user", "agent", "system", "human"]).optional(),
        time: z.string().optional(),
        text: z.string(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Conversation / transcript view. Use for support ticket replays, agent-to-agent exchanges, meeting notes, LLM dialog dumps. Distinguish speakers by role.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "ol",
        { style: { display: "grid", gap: 8, listStyle: "none", margin: 0, padding: 14 } },
        props.messages.map((m, i) => {
          const tone = toneFor(
            m.role === "agent" ? "info" : m.role === "system" ? "neutral" : m.role === "user" ? "positive" : "warning",
          );
          return React.createElement(
            "li",
            {
              key: i,
              style: {
                background: tone.background,
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                display: "grid",
                gap: 4,
                padding: 10,
              },
            },
            React.createElement(
              "div",
              { style: { alignItems: "baseline", color: hudTextMid, display: "flex", flexWrap: "wrap", fontSize: 12, gap: 8 } },
              React.createElement("strong", { style: { color: tone.text } }, m.speaker),
              m.role ? labelElement(m.role, m.role === "user" ? "positive" : m.role === "agent" ? "info" : "neutral", "xs") : null,
              m.time ? React.createElement("span", null, m.time) : null,
            ),
            React.createElement("p", { style: { color: hudText, fontSize: 13, lineHeight: 1.55, margin: 0, whiteSpace: "pre-wrap" } }, m.text),
          );
        }),
      ),
    ),
});

const DonutChart = defineComponent({
  name: "DonutChart",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    total: z.union([z.string(), z.number()]).optional(),
    segments: z.array(
      z.object({
        label: z.string(),
        value: z.number(),
        tone: z.enum(["neutral", "info", "positive", "warning", "danger"]).optional(),
      }),
    ),
    ...glassProps,
  }),
  description:
    "Donut/pie composition chart. Use for share/breakdown/composition data (capacity by team, test outcomes, traffic by source) where parts sum to a whole.",
  component: ({ props }) => {
    const total = props.segments.reduce((sum, s) => sum + s.value, 0) || 1;
    const colorFor = (segIndex: number, tone?: string): string => {
      if (tone) {
        const t = toneFor(tone);
        return t.border;
      }
      return donutColors[segIndex % donutColors.length];
    };
    const data = props.segments.map((seg, i) => ({
      ...seg,
      fill: colorFor(i, seg.tone),
    }));
    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { alignItems: "center", display: "grid", gap: 16, gridTemplateColumns: "180px 1fr", padding: 14 } },
        React.createElement(
          "div",
          { style: { height: 180, position: "relative", width: 180 } },
          React.createElement(
            RcResponsiveContainer as React.ElementType,
            { width: "100%", height: "100%" },
            React.createElement(
              RcPieChart,
              null,
              React.createElement(RcTooltip, {
                ...chartTooltipStyle,
                formatter: (value: unknown, _name: unknown, entry: unknown) => {
                  const e = entry as { payload?: { label?: string; value?: number } };
                  const v = typeof value === "number" ? value : Number(value);
                  const pct = ((v / total) * 100).toFixed(1);
                  return [`${v.toLocaleString()} (${pct}%)`, e.payload?.label ?? ""];
                },
              }),
              React.createElement(
                RcPie,
                {
                  data,
                  dataKey: "value",
                  nameKey: "label",
                  innerRadius: 50,
                  outerRadius: 78,
                  paddingAngle: 1,
                  stroke: "rgba(8, 24, 38, 0.5)",
                  strokeWidth: 1,
                  isAnimationActive: false,
                },
                data.map((seg, i) =>
                  React.createElement(RcCell, { key: i, fill: seg.fill }),
                ),
              ),
            ),
          ),
          React.createElement(
            "div",
            {
              style: {
                alignItems: "center",
                color: hudText,
                display: "flex",
                fontSize: 16,
                fontWeight: 700,
                inset: 0,
                justifyContent: "center",
                pointerEvents: "none",
                position: "absolute",
              },
            },
            formatCellValue(props.total ?? total),
          ),
        ),
        React.createElement(
          "ul",
          { style: { display: "grid", gap: 4, listStyle: "none", margin: 0, padding: 0 } },
          data.map((seg, i) => {
            const pct = ((seg.value / total) * 100).toFixed(1);
            return React.createElement(
              "li",
              { key: i, style: { alignItems: "center", color: hudText, display: "flex", fontSize: 13, gap: 8 } },
              React.createElement("span", { style: { background: seg.fill, borderRadius: 3, height: 10, width: 10 } }),
              React.createElement("span", { style: { flex: 1 } }, seg.label),
              React.createElement("span", { style: { color: hudTextMid } }, `${seg.value} (${pct}%)`),
            );
          }),
        ),
      ),
    );
  },
});

type TreeNode = {
  label: string;
  meta?: string;
  children?: TreeNode[];
};
const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    label: z.string(),
    meta: z.string().optional(),
    children: z.array(treeNodeSchema).optional(),
  }),
);

function renderTreeNode(node: TreeNode, depth: number): React.ReactNode {
  return React.createElement(
    "li",
    { key: `${depth}:${node.label}`, style: { color: hudText, fontFamily: "var(--font-mono, ui-monospace, monospace)", fontSize: 13, paddingLeft: depth * 14 } },
    React.createElement(
      "span",
      { style: { display: "inline-flex", gap: 6 } },
      React.createElement("span", { style: { color: hudTextSoft } }, node.children && node.children.length > 0 ? "▾" : "•"),
      React.createElement("span", null, node.label),
      node.meta ? React.createElement("span", { style: { color: hudTextSoft } }, ` ${node.meta}`) : null,
    ),
    node.children && node.children.length > 0
      ? React.createElement(
          "ul",
          { style: { listStyle: "none", margin: 0, padding: 0 } },
          node.children.map((c) => renderTreeNode(c, depth + 1)),
        )
      : null,
  );
}

const TreeView = defineComponent({
  name: "TreeView",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    nodes: z.array(treeNodeSchema),
    ...glassProps,
  }),
  description:
    "Indented hierarchy view. Use for file trees, JSON shape, org charts, dependency trees, anything nested.",
  component: ({ props }) =>
    React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "ul",
        { style: { listStyle: "none", margin: 0, padding: 14 } },
        props.nodes.map((n) => renderTreeNode(n, 0)),
      ),
    ),
});

const AnimationCard = defineComponent({
  name: "AnimationCard",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    src: z.string(),
    format: z.enum(["lottie", "video", "gif", "svg", "auto"]).optional(),
    poster: z.string().optional(),
    caption: z.string().optional(),
    loop: z.boolean().optional(),
    autoplay: z.boolean().optional(),
    speed: z.number().min(0.1).max(4).optional(),
    aspectRatio: z.string().optional(),
    ...glassProps,
  }),
  description:
    "Animation showcase card for lightweight motion clips: Lottie JSON, looping video, animated GIF/SVG, or PNG sequences. Use for empty states, micro-interactions, success/error animations, branding moments, onboarding hooks.",
  component: ({ props }) => {
    const format =
      props.format && props.format !== "auto"
        ? props.format
        : /\.json$/i.test(props.src)
          ? "lottie"
          : /\.(mp4|webm|mov|m4v)(\?|$)/i.test(props.src)
            ? "video"
            : /\.svg(\?|$)/i.test(props.src)
              ? "svg"
              : "gif";
    const aspect = props.aspectRatio ?? "16 / 9";
    const playbackRate = props.speed ?? 1;
    const loop = props.loop ?? true;
    const autoplay = props.autoplay ?? true;

    const mediaStyle: React.CSSProperties = {
      aspectRatio: aspect,
      background: hudPanelWash,
      border: `1px solid ${hudEdge}`,
      borderRadius: 10,
      display: "block",
      height: "auto",
      objectFit: "cover",
      width: "100%",
    };

    const media =
      format === "video"
        ? React.createElement("video", {
            autoPlay: autoplay,
            controls: !autoplay,
            loop,
            muted: true,
            playsInline: true,
            poster: props.poster,
            ref: (el: HTMLVideoElement | null) => {
              if (el) el.playbackRate = playbackRate;
            },
            src: props.src,
            style: mediaStyle,
          })
        : format === "lottie"
          ? React.createElement(
              "div",
              {
                style: { ...mediaStyle, alignItems: "center", color: hudTextMid, display: "flex", fontSize: 12, justifyContent: "center", padding: 14, textAlign: "center" },
              },
              `Lottie animation\n${props.src}`,
            )
          : format === "svg"
            ? React.createElement("object", { data: props.src, style: mediaStyle, type: "image/svg+xml" })
            : React.createElement("img", { alt: props.caption ?? props.title ?? "animation", src: props.src, style: mediaStyle });

    return React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 8, padding: 14 } },
        React.createElement(
          "div",
          { style: { alignItems: "center", display: "flex", flexWrap: "wrap", gap: 6 } },
          labelElement(format, "info", "xs"),
          loop ? labelElement("loop", "neutral", "xs") : null,
          props.speed !== undefined && props.speed !== 1 ? labelElement(`${props.speed}×`, "info", "xs") : null,
          autoplay ? labelElement("autoplay", "positive", "xs") : null,
        ),
        media,
        props.caption ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.5, margin: 0 } }, props.caption) : null,
      ),
    );
  },
});

const WizardForm = defineComponent({
  name: "WizardForm",
  props: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(
      z.object({
        label: z.string(),
        status: z.enum(["done", "active", "pending"]).optional(),
        fields: z
          .array(
            z.object({
              label: z.string(),
              name: z.string().optional(),
              value: z.string().optional(),
              type: z.enum(["text", "number", "date", "select", "checkbox", "textarea"]).default("text"),
              options: z.array(z.string()).optional(),
              placeholder: z.string().optional(),
              editable: z.boolean().optional(),
              required: z.boolean().optional(),
              help: z.string().optional(),
            }),
          )
          .optional(),
        instructions: z.string().optional(),
      }),
    ),
    actionId: z.string().optional(),
    submitLabel: z.string().optional(),
    completeOnSubmit: z.boolean().optional(),
    ...glassProps,
  }),
  description:
    "Multi-step wizard combining ProgressStepper-style stages with per-step form fields. Use for onboarding, configuration flows, multi-stage approvals. Set actionId to return collected fields to the agent.",
  component: ({ props }) => {
    const firstActive = props.steps.findIndex((step) => step.status === "active");
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [activeIndex, setActiveIndex] = React.useState(firstActive >= 0 ? firstActive : 0);
    // eslint-disable-next-line react-hooks/rules-of-hooks -- OpenUI component callbacks render inside React.
    const [values, setValues] = React.useState<Record<string, string>>(() => {
      const entries: Array<[string, string]> = [];
      props.steps.forEach((step) => {
        step.fields?.forEach((field, fieldIndex) => {
          entries.push([field.name ?? `${step.label}.${field.label || `field_${fieldIndex + 1}`}`, field.value ?? ""]);
        });
      });
      return Object.fromEntries(entries);
    });
    const activeStep = props.steps[Math.min(activeIndex, props.steps.length - 1)];
    if (!activeStep) {
      return React.createElement(
        "section",
        { style: panelStyleFor(props) },
        panelHeader(props.title, props.description),
        React.createElement(
          "div",
          { style: { color: hudTextMid, fontSize: 13, lineHeight: 1.5, padding: 14 } },
          "No wizard steps configured.",
        ),
      );
    }

    const setField = (key: string, value: string, reportEvent: PopupEventReporter | null) => {
      setValues((current) => ({ ...current, [key]: value }));
      emitPopupEvent(reportEvent, {
        kind: "input",
        component: "WizardForm",
        actionId: actionIdFor("WizardForm", props.actionId, `field.${key}`),
        label: key,
        value,
      });
    };

    return popupEventConsumer((reportEvent) => React.createElement(
      "section",
      { style: panelStyleFor(props) },
      panelHeader(props.title, props.description),
      React.createElement(
        "div",
        { style: { display: "grid", gap: 12, padding: 14 } },
        React.createElement(
          "ol",
          { style: { display: "grid", gap: 8, gridTemplateColumns: `repeat(${Math.min(4, props.steps.length)}, minmax(0, 1fr))`, listStyle: "none", margin: 0, padding: 0 } },
          props.steps.map((step, index) => {
            const isActive = index === activeIndex;
            const tone = toneFor(step.status === "done" ? "positive" : isActive || step.status === "active" ? "info" : "neutral");
            return React.createElement(
              "li",
              { key: index },
              React.createElement(
                "button",
                {
                  "aria-current": isActive ? "step" : undefined,
                  onClick: () => setActiveIndex(index),
                  style: { background: isActive ? tone.background : hudPanelWash, border: `1px solid ${tone.border}`, borderRadius: 10, color: tone.text, cursor: "pointer", display: "grid", gap: 5, minHeight: 64, padding: 10, textAlign: "left", width: "100%" },
                  type: "button",
                },
                React.createElement("span", { style: { fontSize: 12, fontWeight: 900 } }, `${index + 1}. ${step.label}`),
                labelElement(step.status ?? (isActive ? "active" : "pending"), step.status === "done" ? "positive" : isActive ? "info" : "neutral", "xs"),
              ),
            );
          }),
        ),
        React.createElement(
          "form",
          {
            onSubmit: (event: React.FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              emitPopupEvent(
                reportEvent,
                {
                  kind: "submit",
                  component: "WizardForm",
                  actionId: actionIdFor("WizardForm", props.actionId, "submit"),
                  label: props.submitLabel ?? "Finish",
                  fields: values,
                },
                { complete: props.completeOnSubmit !== false, outcome: "completed" },
              );
            },
            style: { background: toneFor("info").background, border: `1px solid ${toneFor("info").border}`, borderRadius: 10, display: "grid", gap: 10, padding: 12 },
          },
          React.createElement("h3", { style: { color: hudText, fontSize: 15, margin: 0 } }, activeStep.label),
          activeStep.instructions ? React.createElement("p", { style: { color: hudTextMid, fontSize: 12, lineHeight: 1.5, margin: 0 } }, activeStep.instructions) : null,
          activeStep.fields?.map((field, fieldIndex) => {
            const key = field.name ?? `${activeStep.label}.${field.label || `field_${fieldIndex + 1}`}`;
            const inputId = `genui-wizard-${key.replace(/[^a-z0-9_-]/gi, "-")}-${fieldIndex}`;
            const editable = field.editable !== false;
            const inputStyle = {
              background: "var(--tint-row, rgba(2,18,32,0.20))",
              border: "1px solid var(--edge, rgba(128,226,255,0.22))",
              borderRadius: 6,
              color: "var(--ink, rgba(235,252,255,0.96))",
              fontSize: 13,
              minHeight: field.type === "textarea" ? 64 : 34,
              padding: "7px 9px",
              width: "100%",
            };
            return React.createElement(
              "div",
              { key, style: { display: "grid", gap: 5 } },
              React.createElement(
                "label",
                { htmlFor: editable ? inputId : undefined, style: { alignItems: "center", color: hudTextMid, display: "flex", fontSize: 12, fontWeight: 800, gap: 6 } },
                labelElement(field.label, "neutral", "xs"),
                field.required ? labelElement("required", "danger", "xs") : null,
              ),
              editable && field.type === "textarea"
                ? React.createElement("textarea", { id: inputId, name: key, onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => setField(key, event.currentTarget.value, reportEvent), placeholder: field.placeholder, required: field.required, style: { ...inputStyle, resize: "vertical" }, value: values[key] ?? "" })
                : editable && field.type === "select" && field.options?.length
                  ? React.createElement(
                      "select",
                      { id: inputId, name: key, onChange: (event: React.ChangeEvent<HTMLSelectElement>) => setField(key, event.currentTarget.value, reportEvent), required: field.required, style: inputStyle, value: values[key] ?? "" },
                      React.createElement("option", { value: "" }, field.placeholder ?? "Select..."),
                      field.options.map((option) => React.createElement("option", { key: option, value: option }, option)),
                    )
                  : editable && field.type === "checkbox"
                    ? React.createElement("input", { checked: values[key] === "true", id: inputId, name: key, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setField(key, event.currentTarget.checked ? "true" : "false", reportEvent), required: field.required, style: { height: 18, width: 18 }, type: "checkbox" })
                    : editable
                      ? React.createElement("input", { id: inputId, name: key, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setField(key, event.currentTarget.value, reportEvent), placeholder: field.placeholder, required: field.required, style: inputStyle, type: field.type === "number" ? "number" : field.type === "date" ? "date" : "text", value: values[key] ?? "" })
                      : React.createElement("div", { style: inputStyle }, values[key] || "Not provided"),
              field.help ? React.createElement("span", { style: { color: hudTextSoft, fontSize: 12 } }, field.help) : null,
            );
          }),
          React.createElement(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" } },
            React.createElement("button", { disabled: activeIndex === 0, onClick: () => setActiveIndex((index) => Math.max(0, index - 1)), style: { background: hudPanelWash, border: `1px solid ${hudEdge}`, borderRadius: 8, color: hudTextMid, padding: "8px 12px" }, type: "button" }, "Back"),
            activeIndex < props.steps.length - 1
              ? React.createElement("button", { onClick: () => setActiveIndex((index) => Math.min(props.steps.length - 1, index + 1)), style: { background: toneFor("info").background, border: `1px solid ${toneFor("info").border}`, borderRadius: 8, color: toneFor("info").text, fontWeight: 800, padding: "8px 12px" }, type: "button" }, "Next")
              : React.createElement("button", { style: { background: toneFor("positive").background, border: `1px solid ${toneFor("positive").border}`, borderRadius: 8, color: toneFor("positive").text, fontWeight: 800, padding: "8px 12px" }, type: "submit" }, props.submitLabel ?? "Finish"),
          ),
        ),
      ),
    ));
  },
});

const componentGroups: ComponentGroup[] = [
  ...(openuiLibrary.componentGroups ?? []),
  {
    name: "Agent Explanation",
    components: [
      "MetricGrid",
      "Label",
      "KeyValuePanel",
      "InsightStack",
      "AlertList",
      "Gauge",
      "ChecklistPanel",
      "ProgressStepper",
      "BarChart",
      "LineChart",
      "ComboChart",
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
      "- Use InsightStack for high-signal takeaways with confidence/source annotations.",
      "- Use AlertList for risks, blockers, validation findings, incidents, and warnings.",
      "- Use Gauge for one bounded score, confidence, health, SLA, quota, or completion value.",
      "- Use ChecklistPanel for acceptance criteria, QA gates, launch checks, and requirement coverage.",
      "- Use ProgressStepper for workflows, approvals, onboarding, release steps, and investigations.",
      "- Use BarChart for category comparison, rankings, volumes, counts, and cost breakdowns. For bulky --context-file data, pass [] as data and set contextPath plus labelKey/valueKey if needed.",
      "- Use LineChart for trend, forecast, time-series, backlog, and metric movement. For bulky --context-file data, pass [] as data and set contextPath plus labelKey/valueKey if needed.",
      "- Use ComboChart when two series with different units belong together (PV + CVR, revenue + growth-rate, requests + latency). For bulky --context-file data, pass [] as data and set contextPath plus labelKey/barValueKey/lineValueKey.",
      "- Use ResourceList for files, URLs, docs, generated outputs, and references.",
      "- Use FormPanel for input review, missing fields, intake summaries, and approval requests.",
      "- Use ActionPanel whenever the UI should tell the user what to do next.",
      "- Use TimelinePanel for chronological explanations, incident flow, launches, and multi-step progress.",
      "- Use DecisionMatrix when comparing options or making a recommendation.",
      "- Use DataTable when the user needs to inspect structured rows or compare records. For bulky --context-file rows, pass [] for columns and rows and set contextPath to infer columns.",
      "- Use TaskBoard when explaining work status, queues, triage lanes, or multi-agent handoffs.",
      "- Use CodeDiff for code, config, prompt, or document change review.",
    ],
  },
  {
    name: "Maps",
    components: ["MapView", "MapWithList"],
    notes: [
      "- Use MapView for a standalone map with markers. Static, no list, no interaction beyond pan/zoom.",
      "- Use MapWithList when the user should browse multiple points by name AND see them on a map. Clicking a list item flies the map to it and opens its popup; clicking a marker highlights the list item. Items can include links (official site, review pages, etc.); a Google Maps link is auto-generated. Best for store directories, cafe lists, tour stops, customer/site maps.",
      "- Both accept center: { lat, lng } (optional for MapWithList — auto-centered on items) and zoom. MapWithList items need id, lat, lng, label, plus optional description, category, color.",
      "- Marker colors: red, blue, green, yellow, purple, gray.",
    ],
  },
  {
    name: "Media",
    components: ["AudioPlayer", "VideoPlayer", "VideoPlaylist", "ImageGallery", "AnimationCard"],
    notes: [
      "- Use AudioPlayer for music, generated speech/audio, podcasts, meeting recordings, and sound previews. It renders one focused player plus a clickable queue. Never autoplay.",
      "- Use VideoPlayer for demos, screen recordings, walkthroughs, clips, tutorials, YouTube links, and visual evidence. YouTube watch/short/embed URLs render inline as embeds. Never autoplay.",
      "- Use VideoPlaylist for recommended YouTube/video candidates: first item plays in the main slot, and the table below switches the inline player. Use this for 'おすすめ動画' and search results.",
      "- Use ImageGallery for screenshots, product photos, design candidates, store/cafe imagery, and any caption-bearing image set. It renders one focused preview plus selectable thumbnails.",
      "- Use AnimationCard for short motion clips (Lottie JSON, looping video, animated GIF/SVG): empty states, micro-interactions, success/error animations, onboarding hooks.",
      "- Prefer caller-provided media URLs. If no URL is available, explain that media source is required or use a clearly labeled sample only for demos.",
    ],
  },
  {
    name: "Decisions",
    components: ["ConfirmDialog", "CompareTable", "QuickActions"],
    notes: [
      "- Use ConfirmDialog whenever the user must say yes/no to a single high-stakes action (delete, deploy, approve, autonomous-run gate).",
      "- Use CompareTable when 2-4 options share the same set of attributes (plan tiers, libraries, APIs) and the user has to pick one.",
      "- Use QuickActions when the goal is to offer short, tile-style shortcuts with no per-item explanation — pick lots of things quickly.",
    ],
  },
  {
    name: "Code & Data",
    components: ["CodeBlock", "DataPreview", "TreeView"],
    notes: [
      "- Use CodeBlock for a single snippet of code or a command. CodeDiff is for changes; CodeBlock is for new code to paste or run.",
      "- Use DataPreview for raw structured data inspection (SQL result, CSV head, JSON sample) with column types — devs read it, not stakeholders.",
      "- Use TreeView for any hierarchy: file tree, JSON shape, org chart, dependency tree, nested config.",
    ],
  },
  {
    name: "Text & Translation",
    components: ["LongText", "TranslationPanel", "TranslationCompare"],
    notes: [
      "- Use LongText for articles, policy text, long drafts, specs, transcripts, and any text where scrolling and paragraph readability matter.",
      "- Use TranslationPanel for one focused translation with optional source excerpt, notes, and glossary terms.",
      "- Use TranslationCompare when the user needs to compare original and translated text side by side by segment.",
    ],
  },
  {
    name: "Schedule & People",
    components: ["WeatherCard", "EventList", "PersonCard"],
    notes: [
      "- Use WeatherCard for weather, atmosphere conditions, daily/hourly forecasts.",
      "- Use EventList for today/upcoming events, agendas, scheduled releases, news-of-the-day with explicit times.",
      "- Use PersonCard for team intros, reviewer lists, owner handoffs, on-call contacts.",
    ],
  },
  {
    name: "Diagnostics & Conversations",
    components: ["DiagnosticsCard", "TranscriptView", "WizardForm"],
    notes: [
      "- Use DiagnosticsCard for named checks with pass|warn|fail|skip|pending — CI status, env probes, deploy gates, lint/types/tests rollups.",
      "- Use TranscriptView for conversation logs, agent-to-agent exchanges, ticket replays, LLM dialog dumps.",
      "- Use WizardForm for multi-step onboarding or configuration flows that pair stages with per-stage inputs.",
    ],
  },
  {
    name: "Charts (extra)",
    components: ["DonutChart"],
    notes: [
      "- Use DonutChart (also good for pie-style display) for share/composition data where the parts sum to a whole (capacity by team, traffic by source).",
      "- Prefer BarChart for rankings and LineChart for trends; DonutChart is specifically for composition.",
    ],
  },
  {
    name: "Vector",
    components: ["InlineSvg"],
    notes: [
      "- Use InlineSvg whenever the user asks for SVG, vector graphics, diagrams, schematics, logos, icons, or hand-drawn illustrations.",
      "- The svg prop must be a complete <svg>…</svg> string with a viewBox; <script> and on* handlers are stripped automatically.",
      "- Set height (in pixels) to bound the render area, and background = panel | transparent | light.",
    ],
  },
  {
    name: "Conversation",
    components: ["MessageThread", "MessageBubble"],
    notes: [
      "- Use MessageThread for chat-style conversation previews: LLM dialogs, support chats, agent-to-agent exchanges. Each message has speaker, role (user|assistant|system|agent|tool), text, optional time/avatar. User bubbles right-align; others left-align.",
      "- Use MessageBubble standalone when only one message is shown (last reply, quoted snippet). For full conversations, prefer MessageThread.",
      "- MessageThread differs from TranscriptView: bubbles + role-based alignment instead of a flat time-stamped log.",
    ],
  },
  {
    name: "Hero KPI",
    components: ["Stat", "Sparkline"],
    notes: [
      "- Use Stat when one metric dominates (today's revenue, current SLA, primary error rate). Supports value, delta, target, spark trend, footnote.",
      "- Use Sparkline inline next to a label/value when you only need a tiny trend with no axes. For full charts use LineChart.",
      "- Prefer MetricGrid for 3+ peer KPIs; Stat is for the one number that matters most.",
    ],
  },
  {
    name: "Region Maps",
    components: ["GeoHeatmap"],
    notes: [
      "- Use GeoHeatmap for share/density/coverage by region (states, prefectures, countries). Each region has label, value, optional code. Tile color scales by value.",
      "- Use palette = sky | mint | amber | rose to match the data tone.",
      "- Choose MapView for individual points and GeoHeatmap for whole-region values.",
    ],
  },
  {
    name: "Notifications",
    components: ["NotificationToast"],
    notes: [
      "- Use NotificationToast for one-shot banners: success/warning/error/info with severity, optional icon, time, single CTA action, and dismiss label.",
      "- Use AlertList when there are several risks to scan; NotificationToast is the slim single-line counterpart.",
    ],
  },
];

const customComponents = [
  Card,
  CardHeader,
  Label,
  MetricGrid,
  KeyValuePanel,
  InsightStack,
  AlertList,
  Gauge,
  ChecklistPanel,
  ProgressStepper,
  BarChart,
  LineChart,
  ComboChart,
  ResourceList,
  FormPanel,
  ActionPanel,
  TimelinePanel,
  DecisionMatrix,
  DataTable,
  TaskBoard,
  CodeDiff,
  MapView,
  MapWithList,
  AudioPlayer,
  VideoPlayer,
  VideoPlaylist,
  ImageGallery,
  ConfirmDialog,
  CompareTable,
  CodeBlock,
  DataPreview,
  LongText,
  TranslationPanel,
  TranslationCompare,
  WeatherCard,
  EventList,
  PersonCard,
  DiagnosticsCard,
  QuickActions,
  TranscriptView,
  DonutChart,
  TreeView,
  WizardForm,
  AnimationCard,
  InlineSvg,
  MessageBubble,
  MessageThread,
  Sparkline,
  Stat,
  GeoHeatmap,
  NotificationToast,
];
const customComponentNames = new Set([
  "Card",
  "CardHeader",
  "Label",
  "MetricGrid",
  "KeyValuePanel",
  "InsightStack",
  "AlertList",
  "Gauge",
  "ChecklistPanel",
  "ProgressStepper",
  "BarChart",
  "LineChart",
  "ComboChart",
  "ResourceList",
  "FormPanel",
  "ActionPanel",
  "TimelinePanel",
  "DecisionMatrix",
  "DataTable",
  "TaskBoard",
  "CodeDiff",
  "MapView",
  "MapWithList",
  "AudioPlayer",
  "VideoPlayer",
  "VideoPlaylist",
  "ImageGallery",
  "ConfirmDialog",
  "CompareTable",
  "CodeBlock",
  "DataPreview",
  "LongText",
  "TranslationPanel",
  "TranslationCompare",
  "WeatherCard",
  "EventList",
  "PersonCard",
  "DiagnosticsCard",
  "QuickActions",
  "TranscriptView",
  "DonutChart",
  "TreeView",
  "WizardForm",
  "AnimationCard",
  "InlineSvg",
  "MessageBubble",
  "MessageThread",
  "Sparkline",
  "Stat",
  "GeoHeatmap",
  "NotificationToast",
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
    "For high-signal AI takeaways, research findings, evidence highlights, and executive briefs, prefer InsightStack(title, description, insights). insights = [{ title, detail?, confidence?, source?, tone? }].",
    "For risks, blockers, warnings, validation findings, and incident signals, prefer AlertList(title, description, alerts).",
    "For one bounded score, health, confidence, SLA, quota, or completion value, prefer Gauge(title, description, label, value, max, unit, target, tone). Use MetricGrid for several peer values.",
    "For acceptance criteria, QA gates, launch checks, requirements coverage, and human review items, prefer ChecklistPanel(title, description, items, summary). Use ProgressStepper only when order/time matters.",
    "For staged progress, approvals, onboarding, investigations, and release steps, prefer ProgressStepper(title, description, steps).",
    "For rankings, counts, volumes, costs, and category comparison, prefer BarChart(title, description, unit, max, data). For large data passed with --context-file, use BarChart(title, description, unit, max, [], contextPath, labelKey?, valueKey?, toneKey?).",
    "For trends, forecasts, time series, backlog movement, and metric changes, prefer LineChart(title, description, unit, data). For large time series passed with --context-file, use LineChart(title, description, unit, [], contextPath, labelKey?, valueKey?), where contextPath points to rows in the artifact context.",
    "For two series with different units shown together (e.g. PV + CVR, revenue + growth-rate, requests + latency), prefer ComboChart(title, description, data=[{label, barValue, lineValue}], barUnit, lineUnit, barLabel, lineLabel, barTone). For large data passed with --context-file, use ComboChart(title, description, [], barUnit, lineUnit, barLabel, lineLabel, barTone, contextPath, labelKey?, barValueKey?, lineValueKey?). Bars use the left axis, the line uses the right axis. If all series use the same unit, use LineChart or BarChart instead.",
    "For files, URLs, docs, generated artifacts, and references, prefer ResourceList(title, description, resources).",
    "For required inputs, intake review, confirmation, and missing fields, prefer FormPanel(title, description, fields).",
    "For recommended next steps, approvals, handoffs, and follow-up work, prefer ActionPanel(title, description, actions). actions can include href when an action should open a URL.",
    "For chronological explanations, incidents, launches, or multi-step progress, prefer TimelinePanel(title, description, events).",
    "For alternatives, tradeoffs, or recommendations, prefer DecisionMatrix(title, description, options).",
    "For structured rows, evidence, tickets, files, search results, or ranked lists, prefer DataTable(title, description, columns, rows, caption). For --context-file rows, use DataTable(title, description, [], [], caption, contextPath) to infer columns.",
    "For task queues, implementation plans, QA status, triage lanes, or multi-agent handoffs, prefer TaskBoard(title, description, columns).",
    "For code, config, prompt, or document changes, prefer CodeDiff(title, description, files).",
    "For map requests, use MapView(title, description, center, zoom, height, markers) as part of the UI. Include useful marker labels and colors.",
    "For interactive map + list directories (cafe lists, store maps, tour stops, customer directories), prefer MapWithList(title, description, center?, zoom, height, items). Each item has { id, lat, lng, label, description?, category?, color?, links?: [{label, url}] }. Pass real http(s) URLs for official sites, review pages, social profiles, etc. A 'Google Maps' link is auto-generated from lat/lng — do not duplicate it. The list and map stay in sync: clicking a list entry flies the map to it; clicking a marker highlights the entry. Links open in the user's default browser.",
    "For audio or music requests, use AudioPlayer(title, description, tracks). It shows a focused player plus a clickable queue. Do not autoplay. Prefer provided audio URLs.",
    "For video requests, use VideoPlayer(title, description, src, posterUrl, transcript, chapters). Do not autoplay. Prefer provided video URLs. YouTube watch, shorts, youtu.be, and embed URLs are supported inline.",
    "For recommended video or YouTube search results, prefer VideoPlaylist(title, description, videos, autoplay). Put the best match first; it becomes the main inline player, and candidates below switch playback when clicked. videos = [{title, src, channel?, description?, reason?, posterUrl?, transcript?}].",
    "For screenshots, photo grids, and visual evidence, prefer ImageGallery(title, description, images, columns). It shows a focused preview plus selectable thumbnails.",
    "For single high-stakes confirmation (delete, approve, deploy, autonomous-run gate), prefer ConfirmDialog(title, description, question, detail, risk, confirmLabel, cancelLabel, consequences).",
    "For side-by-side option comparison with shared specs, prefer CompareTable(title, description, options, specOrder). Each option has { name, tagline, recommended, specs }.",
    "For a single code or command snippet to paste or run, prefer CodeBlock(title, description, language, code, runnable, filename). Use CodeDiff only for changes.",
    "For raw structured data inspection (SQL result, CSV head, JSON sample), prefer DataPreview(title, description, source, schema, sampleRows, truncated, rowCount). For --context-file rows, use DataPreview(title, description, source, [], [], truncated, rowCount, contextPath) to infer schema.",
    "For long-form prose such as articles, specs, policies, transcripts, or generated drafts, prefer LongText(title, description, content, sections, language, source, maxHeight). Use sections=[{heading, body}] for structured long text.",
    "For one focused translation, prefer TranslationPanel(title, description, sourceLanguage, targetLanguage, sourceText, translatedText, notes, terms, maxHeight). Use terms=[{source,target,note?}] for glossary choices.",
    "For side-by-side bilingual review, prefer TranslationCompare(title, description, sourceLanguage, targetLanguage, segments, maxHeight). segments=[{id?, source, translation, note?, status?: ok|review|changed|missing}].",
    "For weather forecasts and atmosphere conditions, prefer WeatherCard(title, description, location, summary, temperature, feelsLike, highLow, icon, forecast).",
    "For schedules, agendas, today/upcoming events, prefer EventList(title, description, events). Each event has { title, start, end, location, category, attendees, notes }.",
    "For team intros, reviewer lists, owner handoffs, prefer PersonCard(title, description, people). Each person has { name, role, avatar, email, phone, status, bio }.",
    "For CI/env health checks with pass|warn|fail|skip|pending statuses, prefer DiagnosticsCard(title, description, checks).",
    "For tile-style shortcut rows without per-item descriptions, prefer QuickActions(title, description, actions). actions can include href for external links. Use ActionPanel when each action needs its own description.",
    "For chat or transcript replays, prefer TranscriptView(title, description, messages). Each message has { speaker, role, time, text }.",
    "For share/composition charts where parts sum to a whole, prefer DonutChart(title, description, total, segments).",
    "For any hierarchy (file tree, JSON shape, org chart, dependency tree), prefer TreeView(title, description, nodes). Nodes are recursive: { label, meta, children }.",
    "For multi-step onboarding or configuration flows with per-stage inputs, prefer WizardForm(title, description, steps).",
    "For short motion clips (Lottie JSON, looping video, animated GIF/SVG), prefer AnimationCard(title, description, src, format, poster, caption, loop, autoplay, speed, aspectRatio). Format auto-detects from src extension.",
    "For SVG, vector diagrams, schematics, logos, or icons, prefer InlineSvg(title, description, svg, height, background). svg is a full <svg…>…</svg> string with a viewBox. Set height in pixels and background = panel | transparent | light.",
    "For chat-style conversations (LLM dialogs, support chats, agent-to-agent exchanges), prefer MessageThread(title, description, messages, composer). Each message has { speaker, role: user|assistant|system|agent|tool, time, text, avatar }. User bubbles right-align.",
    "For a single chat message shown standalone, prefer MessageBubble(speaker, role, time, text, avatar).",
    "When one metric dominates (today's number, the primary KPI), prefer Stat(title, description, label, value, delta, tone, spark, target, footnote). For multiple peer KPIs, use MetricGrid instead.",
    "For tiny inline trend lines next to a value with no axes, prefer Sparkline(data, height, tone). For full charts use LineChart.",
    "For share/density/coverage by region (states, prefectures, countries), prefer GeoHeatmap(title, description, unit, regions, palette, columns). Each region has { label, value, code }. Use MapView for individual points instead.",
    "For one-shot status banners (success/warning/error/info with a single CTA), prefer NotificationToast(title, message, severity, icon, time, action, dismissLabel). Use AlertList for multi-item risk lists.",
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
    `Readiness score example:

root = Card([header, gauge, checklist, insights])
header = CardHeader("Release Readiness", "Score, gates, and agent takeaways")
gauge = Gauge("Overall Score", "Bounded launch-readiness value", "Readiness", 82, 100, "%", 90, "info")
checklist = ChecklistPanel("Required Gates", "Items that decide go/no-go", [c1, c2, c3], "2 of 3 gates are ready")
c1 = { label: "Regression suite", status: "done", description: "Unit and integration checks pass" }
c2 = { label: "Rollback note", status: "active", owner: "agent", description: "Draft exists; needs human confirmation" }
c3 = { label: "Support staffing", status: "warning", owner: "support", description: "Coverage is not confirmed for the launch window" }
insights = InsightStack("Agent Takeaways", "What matters most", [i1, i2])
i1 = { title: "Ship is plausible after rollback confirmation", detail: "Technical gates are mostly green, but operational coverage remains the constraining factor.", confidence: "high", source: "CI + release checklist", tone: "info" }
i2 = { title: "Do not skip support staffing", detail: "The remaining risk is user-facing, not build-related.", confidence: "medium", source: "launch plan", tone: "warning" }`,
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

root = Card([header, map, actions])
header = CardHeader("Tokyo Customer Map", "Priority customer sites around central Tokyo")
map = MapView("Customer locations", "Markers show priority by color", { lat: 35.6812, lng: 139.7671 }, 11, 360, [tokyo, shinjuku, shinagawa])
tokyo = { lat: 35.6812, lng: 139.7671, label: "Tokyo Station", description: "Enterprise account", color: "red" }
shinjuku = { lat: 35.6909, lng: 139.7003, label: "Shinjuku", description: "Support escalation", color: "yellow" }
shinagawa = { lat: 35.6285, lng: 139.7388, label: "Shinagawa", description: "Expansion candidate", color: "green" }
actions = ActionPanel("Next actions", "Use the mapped sites to decide the handoff", [a1])
a1 = { label: "Filter to high priority only", priority: "medium", owner: "agent" }`,
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
    `SVG example:

root = Card([header, art])
header = CardHeader("Brand mark", "Inline SVG rendered by the broker")
art = InlineSvg("Logo", "Vector mark for the active workspace", "<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 120 120\\"><defs><linearGradient id=\\"g\\" x1=\\"0\\" x2=\\"1\\" y1=\\"0\\" y2=\\"1\\"><stop offset=\\"0%\\" stop-color=\\"#4ccbff\\"/><stop offset=\\"100%\\" stop-color=\\"#80ffb4\\"/></linearGradient></defs><circle cx=\\"60\\" cy=\\"60\\" r=\\"48\\" fill=\\"url(#g)\\" opacity=\\"0.85\\"/><path d=\\"M30 78 L60 30 L90 78 Z\\" fill=\\"rgba(2,18,32,0.78)\\" stroke=\\"#f4fcff\\" stroke-width=\\"3\\" stroke-linejoin=\\"round\\"/></svg>", 280)`,
    `Chat thread example:

root = Card([header, thread])
header = CardHeader("Support Conversation", "Latest exchange with the customer")
thread = MessageThread("Ticket #SUP-1842", "Live transcript", [m1, m2, m3], { placeholder: "返信を入力", sendLabel: "Send" })
m1 = { speaker: "Customer", role: "user", time: "10:02", text: "Checkout fails at the final step." }
m2 = { speaker: "Agent", role: "assistant", time: "10:03", text: "Confirming the payment owner is paged. Could you share the order ID?" }
m3 = { speaker: "Tool", role: "tool", time: "10:04", text: "payments.lookup → order O-99821 found, status: pending" }`,
    `Hero stat example:

root = Card([stat])
stat = Stat("Today", "リアルタイム売上", "Revenue", "¥2.41M", "+12.4%", "positive", [180, 220, 195, 240, 260, 250, 310], "¥2.30M", "前日比でEnterprise契約2件分が押し上げ")`,
    `Region heatmap example:

root = Card([header, map])
header = CardHeader("売上シェア (都道府県別)", "今四半期の構成比")
map = GeoHeatmap("Prefecture share", "色が濃いほど高シェア", "%", [r1, r2, r3, r4, r5, r6], "sky", 3)
r1 = { label: "Tokyo", code: "JP-13", value: 32 }
r2 = { label: "Osaka", code: "JP-27", value: 18 }
r3 = { label: "Aichi", code: "JP-23", value: 12 }
r4 = { label: "Fukuoka", code: "JP-40", value: 9 }
r5 = { label: "Hokkaido", code: "JP-01", value: 7 }
r6 = { label: "Kanagawa", code: "JP-14", value: 14 }`,
    `Notification toast example:

root = Card([toast])
toast = NotificationToast("デプロイ完了", "本番リリースが成功しました", "positive", "✓", "10:42", { label: "リリースノートを開く", href: "https://example.com/release" })`,
  ],
};
