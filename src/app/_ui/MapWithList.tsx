"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ReactLeafletRuntime = {
  MapContainer: React.ComponentType<Record<string, unknown>>;
  Marker: React.ComponentType<Record<string, unknown>>;
  Popup: React.ComponentType<Record<string, unknown>>;
  TileLayer: React.ComponentType<Record<string, unknown>>;
  useMap: () => {
    flyTo: (center: [number, number], zoom: number, options?: Record<string, unknown>) => void;
    getZoom: () => number;
  };
};

type LeafletRuntime = {
  divIcon: (options: Record<string, unknown>) => unknown;
};

type MapRuntime = {
  leaflet: LeafletRuntime;
  reactLeaflet: ReactLeafletRuntime;
};

export type MapWithListLink = {
  label: string;
  url: string;
};

export type MapWithListItem = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  description?: string;
  category?: string;
  color?: "red" | "blue" | "green" | "yellow" | "purple" | "gray";
  links?: MapWithListLink[];
};

function googleMapsLink(item: MapWithListItem): MapWithListLink {
  const q = encodeURIComponent(`${item.label} @${item.lat},${item.lng}`);
  return {
    label: "Google Maps",
    url: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

function allLinks(item: MapWithListItem): MapWithListLink[] {
  const custom = (item.links ?? []).filter((link) => /^https?:\/\//i.test(link.url));
  return [...custom, googleMapsLink(item)];
}

export type MapWithListProps = {
  title?: string;
  description?: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  items: MapWithListItem[];
};

const MARKER_COLORS: Record<NonNullable<MapWithListItem["color"]>, string> = {
  red: "#ff6b8b",
  blue: "#5fa8ff",
  green: "#5dd49a",
  yellow: "#f6d36a",
  purple: "#b88dff",
  gray: "#a3afc1",
};

function buildDivIcon(leaflet: LeafletRuntime, color: string, selected: boolean): unknown {
  const size = selected ? 30 : 22;
  const ring = selected ? "0 0 0 4px rgba(255,255,255,0.55), 0 0 16px rgba(0,0,0,0.32)" : "0 0 0 2px rgba(255,255,255,0.42)";
  const html = `<div style="
    width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
    background:${color};
    box-shadow:${ring};
    border:1px solid rgba(255,255,255,0.62);
  "><div style="
    transform:rotate(45deg);
    width:8px;height:8px;border-radius:50%;
    background:rgba(255,255,255,0.85);
    margin:${(size - 8) / 2}px auto;
  "></div></div>`;
  return leaflet.divIcon({
    className: "lg-map-pin",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function MapFlyTo({
  target,
  useMap,
}: {
  target: { lat: number; lng: number; id: string } | null;
  useMap: ReactLeafletRuntime["useMap"];
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 13), {
      animate: true,
      duration: 0.7,
    });
  }, [target, map]);
  return null;
}

function averageCenter(items: MapWithListItem[]): { lat: number; lng: number } {
  if (items.length === 0) return { lat: 0, lng: 0 };
  const lat = items.reduce((sum, item) => sum + item.lat, 0) / items.length;
  const lng = items.reduce((sum, item) => sum + item.lng, 0) / items.length;
  return { lat, lng };
}

export default function MapWithList({
  title,
  description,
  center,
  zoom = 11,
  height = 420,
  items,
}: MapWithListProps) {
  const [runtime, setRuntime] = useState<MapRuntime | null>(null);
  const initialCenter = center ?? averageCenter(items);
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; id: string } | null>(null);
  const markerRefs = useRef<Record<string, { openPopup: () => void } | null>>({});

  useEffect(() => {
    let active = true;
    Promise.all([import("react-leaflet"), import("leaflet")]).then(([reactLeafletModule, leafletModule]) => {
      if (!active) return;
      const leaflet = ("default" in leafletModule ? leafletModule.default : leafletModule) as LeafletRuntime;
      setRuntime({
        leaflet,
        reactLeaflet: reactLeafletModule as unknown as ReactLeafletRuntime,
      });
    });
    return () => {
      active = false;
    };
  }, []);

  const selectItem = (item: MapWithListItem) => {
    setSelectedId(item.id);
    setFlyTarget({ lat: item.lat, lng: item.lng, id: item.id });
    const m = markerRefs.current[item.id];
    if (m) m.openPopup();
  };

  const icons = useMemo(() => {
    if (!runtime) return {};
    const byId: Record<string, unknown> = {};
    for (const item of items) {
      const color = MARKER_COLORS[item.color ?? "red"];
      byId[`${item.id}:on`] = buildDivIcon(runtime.leaflet, color, true);
      byId[`${item.id}:off`] = buildDivIcon(runtime.leaflet, color, false);
    }
    return byId;
  }, [items, runtime]);

  if (!runtime) {
    return (
      <section
        style={{
          alignItems: "center",
          background:
            "linear-gradient(145deg, var(--aether-card-tint), var(--aether-card-tint-soft) 54%, rgba(2,18,32,0.05))",
          border: "1px solid rgba(128, 226, 255, 0.22)",
          borderRadius: 12,
          color: "rgba(248, 253, 255, 0.98)",
          display: "flex",
          height,
          justifyContent: "center",
          padding: 14,
          textShadow: "0 1px 2px rgba(20, 28, 22, 0.46), 0 8px 24px rgba(20, 28, 22, 0.28)",
        }}
      >
        Loading map...
      </section>
    );
  }

  const { MapContainer, Marker, Popup, TileLayer, useMap } = runtime.reactLeaflet;

  return (
    <section
      style={{
        background:
          "linear-gradient(145deg, var(--aether-card-tint), var(--aether-card-tint-soft) 54%, rgba(2,18,32,0.05))",
        border: "1px solid rgba(128, 226, 255, 0.22)",
        borderRadius: 12,
        color: "rgba(248, 253, 255, 0.98)",
        overflow: "hidden",
        textShadow: "0 1px 2px rgba(20, 28, 22, 0.46), 0 8px 24px rgba(20, 28, 22, 0.28)",
      }}
    >
      {(title || description) && (
        <header style={{ borderBottom: "1px solid rgba(128, 226, 255, 0.18)", padding: "12px 14px" }}>
          {title && <h3 style={{ color: "rgba(248, 253, 255, 0.98)", fontSize: 17, fontWeight: 700, margin: 0 }}>{title}</h3>}
          {description && (
            <p style={{ color: "rgba(228, 244, 251, 0.90)", fontSize: 14, lineHeight: 1.55, margin: "4px 0 0" }}>
              {description}
            </p>
          )}
        </header>
      )}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(220px, 1fr)",
          padding: 12,
        }}
      >
        <div style={{ borderRadius: 10, height, overflow: "hidden", position: "relative" }}>
          <MapContainer
            center={[initialCenter.lat, initialCenter.lng]}
            zoom={zoom}
            scrollWheelZoom
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              detectRetina
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              const icon = icons[`${item.id}:${isSelected ? "on" : "off"}`];
              return (
                <Marker
                  key={item.id}
                  position={[item.lat, item.lng]}
                  icon={icon}
                  ref={(el: { openPopup: () => void } | null) => {
                    markerRefs.current[item.id] = el;
                  }}
                  eventHandlers={{
                    click: () => setSelectedId(item.id),
                  }}
                >
                  <Popup>
                    <strong style={{ display: "block", marginBottom: 4 }}>{item.label}</strong>
                    {item.category && (
                      <div style={{ color: "rgba(80, 100, 120, 0.86)", fontSize: 12, marginBottom: 4 }}>{item.category}</div>
                    )}
                    {item.description && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{item.description}</div>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {allLinks(item).map((link, linkIndex) => (
                        <a
                          key={`${link.label}:${linkIndex}`}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: "rgba(72, 138, 82, 0.16)",
                            border: "1px solid rgba(72, 138, 82, 0.42)",
                            borderRadius: 6,
                            color: "rgba(28, 64, 38, 0.96)",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "3px 8px",
                            textDecoration: "none",
                          }}
                        >
                          {link.label} ↗
                        </a>
                      ))}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
            <MapFlyTo target={flyTarget} useMap={useMap} />
          </MapContainer>
        </div>

        <ul
          style={{
            display: "grid",
            gap: 6,
            listStyle: "none",
            margin: 0,
            maxHeight: height,
            overflow: "auto",
            padding: 0,
          }}
        >
          {items.map((item) => {
            const isSelected = item.id === selectedId;
            const color = MARKER_COLORS[item.color ?? "red"];
            return (
              <li key={item.id}>
                <button
                  onClick={() => selectItem(item)}
                  type="button"
                  style={{
                    background: isSelected ? "rgba(72, 138, 82, 0.22)" : "rgba(2, 18, 32, 0.20)",
                    border: `1px solid ${isSelected ? "rgba(132, 244, 188, 0.62)" : "rgba(128, 226, 255, 0.18)"}`,
                    borderRadius: 8,
                    color: "inherit",
                    cursor: "pointer",
                    display: "grid",
                    gap: 4,
                    padding: "8px 10px",
                    textAlign: "left",
                    transition: "background 120ms, border-color 120ms",
                    width: "100%",
                  }}
                >
                  <span
                    style={{
                      alignItems: "center",
                      display: "flex",
                      fontSize: 13,
                      fontWeight: 700,
                      gap: 8,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        background: color,
                        borderRadius: 999,
                        boxShadow: "0 0 0 2px rgba(255,255,255,0.4)",
                        flexShrink: 0,
                        height: 10,
                        width: 10,
                      }}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.category && (
                    <span style={{ color: "rgba(206, 230, 240, 0.78)", fontSize: 11 }}>{item.category}</span>
                  )}
                  {item.description && (
                    <span style={{ color: "rgba(228, 244, 251, 0.90)", fontSize: 12, lineHeight: 1.4 }}>
                      {item.description}
                    </span>
                  )}
                </button>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, padding: "0 2px" }}>
                  {allLinks(item).map((link, linkIndex) => (
                    <a
                      key={`${link.label}:${linkIndex}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      style={{
                        background: "rgba(72, 138, 82, 0.22)",
                        border: "1px solid rgba(132, 244, 188, 0.42)",
                        borderRadius: 5,
                        color: "rgba(218, 248, 230, 0.96)",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: 0.2,
                        padding: "2px 7px",
                        textDecoration: "none",
                      }}
                    >
                      {link.label} ↗
                    </a>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
