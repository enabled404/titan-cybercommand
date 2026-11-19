"use client";

import { useEffect, useRef, useState } from "react";
import submarineCables from "@/data/geo/submarine-cables.json";
import { angularDistance, useMapInstance } from "@/components/map/map-instance";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useSituation } from "@/stores/situation";

interface CableFeature {
  type: string;
  properties: {
    id: string;
    name: string;
    capacity: string;
    status: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
}

interface CableSegment {
  id: string;
  name: string;
  capacity: string;
  coords: [number, number][];
  cumDistances: number[];
  totalDist: number;
}

interface DataPacket {
  id: string;
  cableIndex: number;
  progress: number; // 0 to 1
  speed: number; // units per second
  direction: 1 | -1;
  color: string;
  size: number;
}

interface LandingTerminal {
  name: string;
  lon: number;
  lat: number;
  cables: string[];
}

const LANDING_TERMINALS: LandingTerminal[] = [
  { name: "VIRGINIA BEACH (US)", lon: -75.97, lat: 36.85, cables: ["MAREA", "Dunant"] },
  { name: "BILBAO (ES)", lon: -2.93, lat: 43.34, cables: ["MAREA"] },
  { name: "BUDE / CORNWALL (GB)", lon: -5.06, lat: 50.21, cables: ["Grace Hopper"] },
  { name: "NEW YORK / SHIRLEY (US)", lon: -72.95, lat: 40.8, cables: ["Grace Hopper"] },
  { name: "MARSEILLE (FR)", lon: 5.37, lat: 43.3, cables: ["SEA-ME-WE 5", "2Africa"] },
  { name: "SINGAPORE (SG)", lon: 103.8, lat: 1.3, cables: ["SEA-ME-WE 5"] },
  { name: "TOKYO / CHIKURA (JP)", lon: 139.7, lat: 35.4, cables: ["FASTER"] },
  { name: "OREGON / BANDON (US)", lon: -124.0, lat: 45.2, cables: ["FASTER"] },
  { name: "LOS ANGELES (US)", lon: -118.5, lat: 34.0, cables: ["PLCN"] },
  { name: "MANILA (PH)", lon: 121.0, lat: 14.5, cables: ["PLCN"] },
  { name: "SYDNEY (AU)", lon: 151.2, lat: -33.9, cables: ["Southern Cross"] },
  { name: "CAPE TOWN (ZA)", lon: 18.4, lat: -33.9, cables: ["2Africa"] },
  { name: "FORTALEZA (BR)", lon: -38.5, lat: -3.7, cables: ["EllaLink"] },
];

function prepareCables(): CableSegment[] {
  const list: CableSegment[] = [];
  const features = (submarineCables.features || []) as unknown as CableFeature[];

  for (const feat of features) {
    if (feat.geometry.type !== "LineString" || !feat.geometry.coordinates || feat.geometry.coordinates.length < 2) continue;
    const coords = feat.geometry.coordinates;
    const cumDistances: number[] = [0];
    let total = 0;

    for (let i = 1; i < coords.length; i++) {
      const p0 = coords[i - 1];
      const p1 = coords[i];
      const d = angularDistance(p0[0], p0[1], p1[0], p1[1]);
      total += d;
      cumDistances.push(total);
    }

    list.push({
      id: feat.properties.id || feat.properties.name,
      name: feat.properties.name,
      capacity: feat.properties.capacity,
      coords,
      cumDistances,
      totalDist: total || 1,
    });
  }

  return list;
}

function interpolateCablePoint(cable: CableSegment, progress: number): [number, number] {
  const targetDist = Math.max(0, Math.min(1, progress)) * cable.totalDist;
  const { coords, cumDistances } = cable;

  let segIndex = 0;
  for (let i = 1; i < cumDistances.length; i++) {
    if (cumDistances[i] >= targetDist) {
      segIndex = i - 1;
      break;
    }
  }

  const d0 = cumDistances[segIndex];
  const d1 = cumDistances[segIndex + 1] || cable.totalDist;
  const segLen = d1 - d0 || 0.001;
  const frac = Math.max(0, Math.min(1, (targetDist - d0) / segLen));

  const p0 = coords[segIndex];
  const p1 = coords[segIndex + 1] || p0;

  let lonDiff = p1[0] - p0[0];
  if (lonDiff > 180) lonDiff -= 360;
  if (lonDiff < -180) lonDiff += 360;

  const lon = ((p0[0] + lonDiff * frac + 540) % 360) - 180;
  const lat = p0[1] + (p1[1] - p0[1]) * frac;

  return [lon, lat];
}

export function SubseaCablesPulse() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const map = useMapInstance((s) => s.map);
  const ready = useMapInstance((s) => s.ready);
  const layers = useSituation((s) => s.layers);

  const [cables] = useState<CableSegment[]>(() => prepareCables());
  const packetsRef = useRef<DataPacket[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastChirpRef = useRef<number>(0);

  // Initialize packet photon swarm
  useEffect(() => {
    if (cables.length === 0) return;
    const packetList: DataPacket[] = [];
    const colors = ["#22d3ee", "#06b6d4", "#38bdf8", "#67e8f9"];

    cables.forEach((cable, cIdx) => {
      // 2 packets per cable traveling in forward and reverse directions
      packetList.push({
        id: `pkt-${cable.id}-0`,
        cableIndex: cIdx,
        progress: (cIdx * 0.17) % 1,
        speed: 0.06 + ((cIdx * 7) % 5) * 0.015,
        direction: 1,
        color: colors[cIdx % colors.length],
        size: 2.2,
      });
      packetList.push({
        id: `pkt-${cable.id}-1`,
        cableIndex: cIdx,
        progress: (cIdx * 0.17 + 0.5) % 1,
        speed: 0.055 + ((cIdx * 3) % 4) * 0.012,
        direction: -1,
        color: colors[(cIdx + 1) % colors.length],
        size: 2.0,
      });
    });

    packetsRef.current = packetList;
  }, [cables]);

  useEffect(() => {
    if (!ready || !map || !layers.cables || cables.length === 0) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).has("still");

    let running = true;
    let lastTime = performance.now();

    const render = (scheduleNext: boolean) => {
      if (!running) return;

      if (document.hidden) {
        lastTime = performance.now();
        if (scheduleNext) animFrameRef.current = requestAnimationFrame(() => render(true));
        return;
      }

      const mapCanvas = map.getCanvas();
      if (!mapCanvas) {
        if (scheduleNext) animFrameRef.current = requestAnimationFrame(() => render(true));
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = mapCanvas.clientWidth;
      const height = mapCanvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) * 0.001);
      lastTime = now;

      const center = map.getCenter();
      const zoom = map.getZoom();

      // 1. Draw Subsea Landing Terminals with gentle status beacons
      for (const terminal of LANDING_TERMINALS) {
        const dist = angularDistance(center.lng, center.lat, terminal.lon, terminal.lat);
        if (dist <= 88) {
          try {
            const p = map.project([terminal.lon, terminal.lat]);
            const pulse = (Math.sin(now * 0.003 + terminal.lat) + 1) * 0.5;

            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            // Outer subtle radar ripple
            ctx.strokeStyle = "#22d3ee";
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.25 + pulse * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4 + pulse * 5, 0, Math.PI * 2);
            ctx.stroke();

            // Terminal hub dot
            ctx.fillStyle = "#67e8f9";
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
            ctx.fill();

            // Label at higher zoom
            if (zoom >= 3.2) {
              ctx.font = "8px 'Martian Mono', monospace";
              ctx.fillStyle = "#a5f3fc";
              ctx.globalAlpha = 0.8;
              ctx.fillText(terminal.name, p.x + 6, p.y + 3);
            }

            ctx.restore();
          } catch {
            // Coordinate projection safety
          }
        }
      }

      // 2. Animate Optical Data Packets along Subsea Cable routes
      for (const pkt of packetsRef.current) {
        const cable = cables[pkt.cableIndex];
        if (!cable) continue;

        if (!reduced) {
          if (pkt.direction === 1) {
            pkt.progress = (pkt.progress + dt * pkt.speed) % 1;
          } else {
            pkt.progress = (pkt.progress - dt * pkt.speed + 1) % 1;
          }
        }

        const [curLon, curLat] = interpolateCablePoint(cable, pkt.progress);
        const distFromCenter = angularDistance(center.lng, center.lat, curLon, curLat);

        if (distFromCenter <= 88) {
          try {
            const p = map.project([curLon, curLat]);

            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            // Draw trailing optical motion trail along cable route
            const trailStep = pkt.direction === 1 ? -0.018 : 0.018;
            const trailPoints: { x: number; y: number }[] = [];
            for (let i = 1; i <= 4; i++) {
              const tProg = Math.max(0, Math.min(1, pkt.progress + trailStep * i));
              const [tLon, tLat] = interpolateCablePoint(cable, tProg);
              if (angularDistance(center.lng, center.lat, tLon, tLat) <= 88) {
                trailPoints.push(map.project([tLon, tLat]));
              }
            }

            if (trailPoints.length > 0) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              for (const tp of trailPoints) {
                ctx.lineTo(tp.x, tp.y);
              }
              ctx.strokeStyle = pkt.color;
              ctx.lineWidth = 1.4;
              ctx.globalAlpha = 0.45;
              ctx.stroke();
            }

            // Outer radiant photon corona glow
            const grad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 8);
            grad.addColorStop(0, pkt.color);
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();

            // Core white-hot data packet
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 0.95;
            ctx.beginPath();
            ctx.arc(p.x, p.y, pkt.size, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // Periodic subtle acoustic chirp when packets reach major landing hubs
            if (
              pkt.progress < 0.02 &&
              now - lastChirpRef.current > 7000 &&
              (cable.name.includes("MAREA") || cable.name.includes("FASTER"))
            ) {
              lastChirpRef.current = now;
              soundEngine.playSubseaPacketPulse();
            }
          } catch {
            // Projection safety
          }
        }
      }

      ctx.restore();

      if (scheduleNext) {
        animFrameRef.current = requestAnimationFrame(() => render(true));
      }
    };

    if (reduced) {
      render(false);
      map.on("move", () => render(false));
      map.on("resize", () => render(false));
      return () => {
        running = false;
        map.off("move", () => render(false));
        map.off("resize", () => render(false));
        if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    }

    animFrameRef.current = requestAnimationFrame(() => render(true));

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [ready, map, layers.cables, cables]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[5]"
      aria-hidden="true"
    />
  );
}
