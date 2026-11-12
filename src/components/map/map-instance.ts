"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import { create } from "zustand";

interface MapInstanceState {
  map: MapLibreMap | null;
  ready: boolean;
  setMap: (map: MapLibreMap | null) => void;
  setReady: (ready: boolean) => void;
}

/** Shares the live MapLibre instance with panels, cinema mode and the command palette. */
export const useMapInstance = create<MapInstanceState>((set) => ({
  map: null,
  ready: false,
  setMap: (map) => set({ map }),
  setReady: (ready) => set({ ready }),
}));

export function flyToIncident(map: MapLibreMap, lon: number, lat: number, opts: { zoom?: number; pitch?: number; duration?: number } = {}): void {
  map.flyTo({
    center: [lon, lat],
    zoom: opts.zoom ?? Math.max(map.getZoom(), 4.2),
    pitch: opts.pitch ?? 35,
    bearing: map.getBearing(),
    duration: opts.duration ?? 2600,
    curve: 1.5,
    essential: true,
  });
}

const RAD = Math.PI / 180;

/** Angle in degrees between two points on the sphere: over 90 means the second faces away from the first. */
export function angularDistance(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const cos = Math.sin(lat1 * RAD) * Math.sin(lat2 * RAD) + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lng2 - lng1) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
}

/** Point at angular distance d (radians) from lat/lng along bearing b (degrees). */
function destination(lat: number, lng: number, bearing: number, d: number): [number, number] {
  const la = lat * RAD;
  const b = bearing * RAD;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lng * RAD + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return [((lo2 / RAD + 540) % 360) - 180, la2 / RAD];
}

/**
 * Screen-space circle of the globe in CSS pixels. Globe scale varies near low zoom, so rather
 * than trust a formula we project points towards the horizon and keep the farthest: that is the limb.
 */
export function globeCircle(map: MapLibreMap): { x: number; y: number; r: number } {
  const center = map.getCenter();
  const origin = map.project(center);
  let r = 0;
  for (const deg of [70, 74, 78, 82, 86]) {
    const p = map.project(destination(center.lat, center.lng, 90, deg * RAD));
    r = Math.max(r, Math.hypot(p.x - origin.x, p.y - origin.y));
  }
  return { x: origin.x, y: origin.y, r };
}

/**
 * Applies a style change now, or once the style can take it. Vector and GeoJSON sources can re-evaluate
 * briefly after the map reports ready; retrying on idle keeps the change instead of throwing into React.
 * Returns a cancel callback for effect cleanup.
 */
export function applyStyle(map: MapLibreMap, change: () => void): () => void {
  let cancelled = false;
  const attempt = () => {
    if (cancelled) return;
    try {
      change();
    } catch {
      map.once("idle", attempt);
    }
  };
  attempt();
  return () => {
    cancelled = true;
    map.off("idle", attempt);
  };
}

/** For per-frame animation: skip a frame rather than throw while the style is busy. */
export function tryStyle(change: () => void): void {
  try {
    change();
  } catch {
    // The next frame tries again.
  }
}
