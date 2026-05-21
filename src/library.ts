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

const componentGroups: ComponentGroup[] = [
  ...(openuiLibrary.componentGroups ?? []),
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
  components: [...Object.values(openuiLibrary.components), MapView, AudioPlayer, VideoPlayer],
  componentGroups,
  root: openuiLibrary.root,
});

export const promptOptions: PromptOptions = {
  ...openuiPromptOptions,
  additionalRules: [
    ...(openuiPromptOptions.additionalRules ?? []),
    "For map requests, use MapView(title, description, center, zoom, height, markers) as part of the UI. Include useful marker labels and colors.",
    "For audio or music requests, use AudioPlayer(title, description, tracks). Do not autoplay. Prefer provided audio URLs.",
    "For video requests, use VideoPlayer(title, description, src, posterUrl, transcript, chapters). Do not autoplay. Prefer provided video URLs.",
  ],
  examples: [
    ...(openuiPromptOptions.examples ?? []),
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
