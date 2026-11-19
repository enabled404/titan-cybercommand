"use client";

import { useEffect, useRef, useState } from "react";
import { Broadcast, Crosshair, Radio, X } from "@phosphor-icons/react";
import { angularDistance, useMapInstance } from "@/components/map/map-instance";
import { soundEngine } from "@/lib/audio/sound-engine";
import type { Incident } from "@/lib/types";
import { useSituation } from "@/stores/situation";

export interface SatelliteRecord {
  id: string;
  name: string;
  callsign: string;
  noradId: number;
  type: "LEO" | "MEO" | "GEO";
  altitudeKm: number;
  inclinationDeg: number;
  periodMin: number;
  color: string;
  payload: string;
  country: string;
  agency: string;
  initialRaanDeg: number;
  initialPhaseRad: number;
  hasScanCone?: boolean;
  scanRadiusKm?: number;
}

export const SATELLITE_CONSTELLATION: SatelliteRecord[] = [
  {
    id: "usa-326",
    name: "USA-326 (NROL-91)",
    callsign: "USA-326",
    noradId: 54050,
    type: "LEO",
    altitudeKm: 512,
    inclinationDeg: 97.4,
    periodMin: 94.8,
    color: "#38bdf8",
    payload: "Classified Electro-Optical Keyhole IMINT",
    country: "US",
    agency: "National Reconnaissance Office",
    initialRaanDeg: 42,
    initialPhaseRad: 0.8,
    hasScanCone: true,
    scanRadiusKm: 620,
  },
  {
    id: "cosmos-2558",
    name: "COSMOS-2558",
    callsign: "COSMOS-2558",
    noradId: 53323,
    type: "LEO",
    altitudeKm: 450,
    inclinationDeg: 97.4,
    periodMin: 93.5,
    color: "#f43f5e",
    payload: "Orbital Inspection & Tactical SIGINT",
    country: "RU",
    agency: "VKS Aerospace Forces",
    initialRaanDeg: 45,
    initialPhaseRad: 2.3,
    hasScanCone: true,
    scanRadiusKm: 540,
  },
  {
    id: "kh11-290",
    name: "KH-11 KENNEN (USA-290)",
    callsign: "KEYHOLE-11",
    noradId: 44053,
    type: "LEO",
    altitudeKm: 390,
    inclinationDeg: 97.9,
    periodMin: 92.4,
    color: "#c084fc",
    payload: "Sub-decimeter High-Res Ground Surveillance",
    country: "US",
    agency: "US Space Force / NRO",
    initialRaanDeg: 120,
    initialPhaseRad: 3.8,
    hasScanCone: true,
    scanRadiusKm: 480,
  },
  {
    id: "starlink-g4",
    name: "STARLINK-4122",
    callsign: "STARLINK-LEO",
    noradId: 51980,
    type: "LEO",
    altitudeKm: 550,
    inclinationDeg: 53.2,
    periodMin: 95.6,
    color: "#22d3ee",
    payload: "Space Laser Optical Cross-Link Mesh",
    country: "US",
    agency: "SpaceX Starlink",
    initialRaanDeg: 210,
    initialPhaseRad: 1.1,
  },
  {
    id: "starlink-g5",
    name: "STARLINK-5308",
    callsign: "STARLINK-RELAY",
    noradId: 55900,
    type: "LEO",
    altitudeKm: 530,
    inclinationDeg: 43.0,
    periodMin: 95.2,
    color: "#22d3ee",
    payload: "High-Throughput Global Broadband Gateway",
    country: "US",
    agency: "SpaceX Starlink",
    initialRaanDeg: 315,
    initialPhaseRad: 4.4,
  },
  {
    id: "oneweb-0142",
    name: "ONEWEB-0142",
    callsign: "ONEWEB-POLAR",
    noradId: 47680,
    type: "LEO",
    altitudeKm: 1200,
    inclinationDeg: 87.4,
    periodMin: 109.4,
    color: "#06b6d4",
    payload: "Ku/Ka Band Arctic Tactical Telemetry",
    country: "GB",
    agency: "Eutelsat OneWeb",
    initialRaanDeg: 160,
    initialPhaseRad: 5.1,
  },
  {
    id: "gps-74",
    name: "NAVSTAR GPS-74 (USA-289)",
    callsign: "GPS-III-01",
    noradId: 43873,
    type: "MEO",
    altitudeKm: 20180,
    inclinationDeg: 55.0,
    periodMin: 718.0,
    color: "#fbbf24",
    payload: "L1/L2/L5 Anti-Jam Military M-Code Carrier",
    country: "US",
    agency: "US Space Force 2SOPS",
    initialRaanDeg: 60,
    initialPhaseRad: 2.1,
  },
  {
    id: "galileo-28",
    name: "GALILEO-28 (GSAT0224)",
    callsign: "GALILEO-FOC",
    noradId: 49809,
    type: "MEO",
    altitudeKm: 23222,
    inclinationDeg: 56.0,
    periodMin: 844.0,
    color: "#34d399",
    payload: "E1/E5 Public Regulated Service Encrypted Carrier",
    country: "EU",
    agency: "European Space Agency",
    initialRaanDeg: 180,
    initialPhaseRad: 4.9,
  },
  {
    id: "beidou-m21",
    name: "BEIDOU-3 M21",
    callsign: "BEIDOU-MEO",
    noradId: 44794,
    type: "MEO",
    altitudeKm: 21528,
    inclinationDeg: 55.0,
    periodMin: 773.0,
    color: "#fb923c",
    payload: "B1C/B2a Inter-Satellite Laser Link Mesh",
    country: "CN",
    agency: "CNSA Navigation Center",
    initialRaanDeg: 300,
    initialPhaseRad: 0.5,
  },
  {
    id: "mentor-8",
    name: "MENTOR-8 (PAN / USA-300)",
    callsign: "ORION-SIGINT",
    noradId: 35832,
    type: "GEO",
    altitudeKm: 35786,
    inclinationDeg: 6.5,
    periodMin: 1436.0,
    color: "#e879f9",
    payload: "100m Mesh Reflector Wideband Tactical RF Intercept",
    country: "US",
    agency: "National Reconnaissance Office",
    initialRaanDeg: 55,
    initialPhaseRad: 1.2,
    hasScanCone: true,
    scanRadiusKm: 1800,
  },
  {
    id: "shijian-21",
    name: "SHIJIAN-21",
    callsign: "SJ-21",
    noradId: 49330,
    type: "GEO",
    altitudeKm: 35800,
    inclinationDeg: 4.2,
    periodMin: 1436.0,
    color: "#f97316",
    payload: "Geosynchronous Rendezvous & Proximity Sensor",
    country: "CN",
    agency: "CNSA Deep Space",
    initialRaanDeg: 105,
    initialPhaseRad: 3.4,
  },
];

/**
 * Computes sub-satellite geographic coordinates (lon, lat) at a given elapsed time.
 */
export function calculateSatellitePosition(sat: SatelliteRecord, timeSec: number): { lon: number; lat: number; velocityKms: number } {
  const periodSec = sat.periodMin * 60;
  const meanMotionRadSec = (2 * Math.PI) / periodSec;
  const u = (timeSec * meanMotionRadSec + sat.initialPhaseRad) % (2 * Math.PI);
  const incRad = (sat.inclinationDeg * Math.PI) / 180;

  // Spherical orbital geometry:
  // sin(lat) = sin(inc) * sin(u)
  const latRad = Math.asin(Math.max(-1, Math.min(1, Math.sin(incRad) * Math.sin(u))));
  const lat = (latRad * 180) / Math.PI;

  // tan(lon_orbit) = cos(inc) * tan(u)
  const y = Math.cos(incRad) * Math.sin(u);
  const x = Math.cos(u);
  const lonOrbit = (Math.atan2(y, x) * 180) / Math.PI;

  // Earth rotation offset (360 degrees per 86164 seconds sidereal day)
  const earthRotDeg = (timeSec / 86164) * 360;
  let lon = (sat.initialRaanDeg + lonOrbit - earthRotDeg) % 360;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  // Orbital velocity via vis-viva equation: v = sqrt(mu / r) where mu = 398600.4418 km^3/s^2, r = 6371 + alt
  const r = 6371 + sat.altitudeKm;
  const velocityKms = Math.sqrt(398600.4418 / r);

  return { lon, lat, velocityKms };
}

export function OrbitalSurveillance({
  incidents = [],
  hudLeft = 452,
  hudBottom = 236,
  showHud = true,
}: {
  incidents?: Incident[];
  hudLeft?: number;
  hudBottom?: number;
  showHud?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const map = useMapInstance((s) => s.map);
  const ready = useMapInstance((s) => s.ready);
  const layers = useSituation((s) => s.layers);
  const cinema = useSituation((s) => s.cinema);
  const selectedSatellite = useSituation((s) => s.selectedSatellite);
  const selectSatellite = useSituation((s) => s.selectSatellite);

  const [hoveredSat, setHoveredSat] = useState<SatelliteRecord | null>(null);
  const [hoveredPos, setHoveredPos] = useState<{ x: number; y: number; alt: number; vel: number } | null>(null);
  const lastScanSoundRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const satScreenPositionsRef = useRef<Map<string, { x: number; y: number; sat: SatelliteRecord; alt: number; vel: number }>>(new Map());

  // Handle click on canvas to select satellite
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let clickedSat: SatelliteRecord | null = null;
    let closestDist = 22; // 22px click radius

    for (const [, pos] of satScreenPositionsRef.current) {
      const d = Math.hypot(pos.x - clickX, pos.y - clickY);
      if (d < closestDist) {
        closestDist = d;
        clickedSat = pos.sat;
      }
    }

    if (clickedSat) {
      soundEngine.playClick();
      soundEngine.playOrbitalScan();
      selectSatellite(clickedSat.id === selectedSatellite ? null : clickedSat.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let nearest: { sat: SatelliteRecord; x: number; y: number; alt: number; vel: number } | null = null;
    let closestDist = 20;

    for (const [, pos] of satScreenPositionsRef.current) {
      const d = Math.hypot(pos.x - mouseX, pos.y - mouseY);
      if (d < closestDist) {
        closestDist = d;
        nearest = pos;
      }
    }

    if (nearest) {
      setHoveredSat(nearest.sat);
      setHoveredPos({ x: nearest.x, y: nearest.y, alt: nearest.alt, vel: nearest.vel });
    } else if (hoveredSat) {
      setHoveredSat(null);
      setHoveredPos(null);
    }
  };

  useEffect(() => {
    if (!ready || !map || !layers.satellites) {
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
    const startTime = performance.now();

    const render = (scheduleNext: boolean) => {
      if (!running) return;

      if (document.hidden) {
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
      const elapsedSec = reduced ? 3600 : (now - startTime) * 0.001 * 8.0; // 8x real-time scale for visible tactical orbital motion
      const center = map.getCenter();
      const centerProj = map.project(center);
      const zoom = map.getZoom();
      const globeBlend = Math.max(0, Math.min(1, (5.2 - zoom) / 1.5));

      const updatedScreenPositions = new Map<string, { x: number; y: number; sat: SatelliteRecord; alt: number; vel: number }>();

      for (const sat of SATELLITE_CONSTELLATION) {
        const { lon, lat, velocityKms } = calculateSatellitePosition(sat, elapsedSec);
        const distFromCenter = angularDistance(center.lng, center.lat, lon, lat);

        // Render ground track line segment (future 30 minutes of ground track)
        if (sat.hasScanCone || sat.type === "GEO" || sat.id === selectedSatellite) {
          ctx.beginPath();
          let started = false;
          let prevLon: number | null = null;
          for (let step = 0; step <= 24; step++) {
            const futureTime = elapsedSec + step * (sat.periodMin * 60 * 0.02);
            const futurePos = calculateSatellitePosition(sat, futureTime);
            const futureDist = angularDistance(center.lng, center.lat, futurePos.lon, futurePos.lat);
            const antimeridianBreak = prevLon !== null && Math.abs(futurePos.lon - prevLon) > 180;
            prevLon = futurePos.lon;

            if (futureDist <= 88 && !antimeridianBreak) {
              try {
                const gp = map.project([futurePos.lon, futurePos.lat]);
                if (!started) {
                  ctx.moveTo(gp.x, gp.y);
                  started = true;
                } else {
                  ctx.lineTo(gp.x, gp.y);
                }
              } catch {
                started = false;
              }
            } else {
              started = false;
            }
          }

          if (started) {
            ctx.save();
            ctx.lineWidth = sat.id === selectedSatellite ? 1.5 : 0.8;
            ctx.strokeStyle = sat.color;
            ctx.globalAlpha = sat.id === selectedSatellite ? 0.45 : 0.2;
            ctx.setLineDash([3, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        }

        // Sub-satellite point visible on the front hemisphere
        if (distFromCenter <= 88) {
          try {
            const groundProj = map.project([lon, lat]);

            // Calculate altitude offset above Earth surface:
            // LEO: 20px-35px, MEO: 40px-65px, GEO: 70px-105px
            let altitudePx = 22;
            if (sat.type === "LEO") altitudePx = 18 + (sat.altitudeKm / 1200) * 16;
            else if (sat.type === "MEO") altitudePx = 42 + (sat.altitudeKm / 24000) * 22;
            else if (sat.type === "GEO") altitudePx = 76;

            const rdx = groundProj.x - centerProj.x;
            const rdy = groundProj.y - centerProj.y;
            const rdist = Math.hypot(rdx, rdy);
            const normX = rdist > 0.5 ? rdx / rdist : 0;
            const normY = rdist > 0.5 ? rdy / rdist : -1;
            const dirX = normX * globeBlend;
            const dirY = normY * globeBlend - (1 - globeBlend);
            const dirLen = Math.hypot(dirX, dirY) || 1;

            const satX = groundProj.x + (dirX / dirLen) * altitudePx;
            const satY = groundProj.y + (dirY / dirLen) * altitudePx;

            updatedScreenPositions.set(sat.id, {
              x: satX,
              y: satY,
              sat,
              alt: sat.altitudeKm,
              vel: Number(velocityKms.toFixed(2)),
            });

            // 1. Render Sensor Scan Footprint Cone if active reconnaissance satellite
            if (sat.hasScanCone) {
              const footprintRadius = sat.type === "GEO" ? 54 : 28 + (sat.altitudeKm / 1000) * 12;
              const scanPhase = (now * 0.0015 + (sat.noradId % 100) * 0.05) % 1;

              ctx.save();
              ctx.globalCompositeOperation = "lighter";

              // Translucent projection cone from satellite node down to Earth ground footprint
              const coneGrad = ctx.createLinearGradient(satX, satY, groundProj.x, groundProj.y);
              coneGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
              coneGrad.addColorStop(0.25, sat.color + "33"); // 20% alpha
              coneGrad.addColorStop(1, sat.color + "12"); // 7% alpha
              ctx.fillStyle = coneGrad;
              ctx.beginPath();
              ctx.moveTo(satX, satY);
              ctx.lineTo(groundProj.x - footprintRadius, groundProj.y);
              ctx.lineTo(groundProj.x + footprintRadius, groundProj.y);
              ctx.closePath();
              ctx.fill();

              // Ground footprint circular boundary
              ctx.strokeStyle = sat.color;
              ctx.lineWidth = 1;
              ctx.globalAlpha = 0.55;
              ctx.setLineDash([2, 4]);
              ctx.beginPath();
              ctx.ellipse(groundProj.x, groundProj.y, footprintRadius, footprintRadius * 0.65, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);

              // Rotating azimuth sweep line inside footprint
              const sweepAngle = (now * 0.002 + sat.noradId) % (Math.PI * 2);
              const sweepX = groundProj.x + Math.cos(sweepAngle) * footprintRadius;
              const sweepY = groundProj.y + Math.sin(sweepAngle) * footprintRadius * 0.65;
              ctx.strokeStyle = sat.color;
              ctx.lineWidth = 1.2;
              ctx.globalAlpha = 0.7;
              ctx.beginPath();
              ctx.moveTo(groundProj.x, groundProj.y);
              ctx.lineTo(sweepX, sweepY);
              ctx.stroke();

              // Ground tether anchor point
              ctx.fillStyle = sat.color;
              ctx.globalAlpha = 0.8;
              ctx.beginPath();
              ctx.arc(groundProj.x, groundProj.y, 1.8, 0, Math.PI * 2);
              ctx.fill();

              // Footprint expanding radar wave pulse
              const waveR = footprintRadius * scanPhase;
              ctx.strokeStyle = sat.color;
              ctx.lineWidth = 0.8;
              ctx.globalAlpha = (1 - scanPhase) * 0.6;
              ctx.beginPath();
              ctx.ellipse(groundProj.x, groundProj.y, waveR, waveR * 0.65, 0, 0, Math.PI * 2);
              ctx.stroke();

              ctx.restore();

              // Check if sensor cone intersects any cyber incident
              if (incidents.length > 0 && now - lastScanSoundRef.current > 4500) {
                for (const inc of incidents) {
                  const d = angularDistance(lon, lat, inc.lon, inc.lat);
                  if (d < (sat.scanRadiusKm || 600) / 111.0) {
                    lastScanSoundRef.current = now;
                    soundEngine.playOrbitalScan();
                    break;
                  }
                }
              }
            }

            // 2. Connector line between ground point and satellite in space
            ctx.save();
            ctx.strokeStyle = sat.color;
            ctx.lineWidth = 0.7;
            ctx.globalAlpha = 0.35;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(groundProj.x, groundProj.y);
            ctx.lineTo(satX, satY);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // 3. Draw Satellite Node & Solar Panels
            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            const isSelected = sat.id === selectedSatellite;
            const isHovered = hoveredSat?.id === sat.id;

            // Halo glow
            const glowR = isSelected || isHovered ? 14 : 8;
            const grad = ctx.createRadialGradient(satX, satY, 1, satX, satY, glowR);
            grad.addColorStop(0, sat.color);
            grad.addColorStop(1, "rgba(0, 0, 0, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(satX, satY, glowR, 0, Math.PI * 2);
            ctx.fill();

            // Solar Array Wings (horizontal rectangular bars)
            ctx.fillStyle = "#a5f3fc";
            ctx.globalAlpha = 0.9;
            const wingW = isSelected ? 8 : 5.5;
            const wingH = isSelected ? 2.5 : 1.8;
            // Left wing
            ctx.fillRect(satX - wingW - 2.5, satY - wingH / 2, wingW, wingH);
            // Right wing
            ctx.fillRect(satX + 2.5, satY - wingH / 2, wingW, wingH);

            // Center spacecraft bus
            ctx.fillStyle = "#ffffff";
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(satX, satY, isSelected ? 2.8 : 2.0, 0, Math.PI * 2);
            ctx.fill();

            // Tactical Ring on Selected
            if (isSelected) {
              const pulse = (Math.sin(now * 0.008) + 1) * 0.5;
              ctx.strokeStyle = sat.color;
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.arc(satX, satY, 11 + pulse * 4, 0, Math.PI * 2);
              ctx.stroke();

              // Crosshairs
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(satX - 16, satY);
              ctx.lineTo(satX - 11, satY);
              ctx.moveTo(satX + 11, satY);
              ctx.lineTo(satX + 16, satY);
              ctx.moveTo(satX, satY - 16);
              ctx.lineTo(satX, satY - 11);
              ctx.moveTo(satX, satY + 11);
              ctx.lineTo(satX, satY + 16);
              ctx.stroke();
            }

            // Compact Callout Label in 3D Space
            if (zoom >= 1.6 || isSelected || isHovered || sat.hasScanCone) {
              ctx.font = "8px 'Martian Mono', monospace";
              ctx.fillStyle = isSelected ? "#ffffff" : sat.color;
              ctx.globalAlpha = isSelected ? 1 : 0.85;
              ctx.fillText(sat.callsign, satX + 8, satY - 4);
              if (isSelected) {
                ctx.font = "7.5px 'Martian Mono', monospace";
                ctx.fillStyle = "#a5f3fc";
                ctx.fillText(`ALT: ${sat.altitudeKm}KM // ${velocityKms.toFixed(1)}KM/S`, satX + 8, satY + 6);
              }
            }

            ctx.restore();
          } catch {
            // Coordinate projection safety
          }
        }
      }

      satScreenPositionsRef.current = updatedScreenPositions;

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
  }, [ready, map, layers.satellites, incidents, selectedSatellite, hoveredSat]);

  const selectedSatObj = SATELLITE_CONSTELLATION.find((s) => s.id === selectedSatellite);

  return (
    <>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setHoveredSat(null);
          setHoveredPos(null);
        }}
        className="pointer-events-auto absolute inset-0 z-[7] cursor-crosshair"
        aria-label="Orbital Satellite Constellation Surveillance Layer"
      />

      {/* Floating Hover Card */}
      {hoveredSat && hoveredPos && !selectedSatObj && !cinema && (
        <div
          style={{
            left: Math.max(16, Math.min(window.innerWidth - 240, hoveredPos.x + 14)),
            top: Math.max(70, Math.min(window.innerHeight - 140, hoveredPos.y - 45)),
          }}
          className="pointer-events-none fixed z-30 rounded-[12px] border border-white/10 bg-surface-2/95 p-2.5 font-mono text-xs shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-center gap-1.5 font-bold text-ink">
            <Broadcast size={14} className="text-cyan-400" />
            <span style={{ color: hoveredSat.color }}>{hoveredSat.name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10.5px] text-ink-3">
            <span>NORAD {hoveredSat.noradId}</span>
            <span>{"//"}</span>
            <span className="uppercase text-cyan-300">{hoveredSat.type} ORBIT</span>
          </div>
          <div className="mt-1 text-[10px] text-ink-4">
            ALT: <span className="text-ink">{hoveredPos.alt} KM</span> {"//"} VEL:{" "}
            <span className="text-ink">{hoveredPos.vel} KM/S</span>
          </div>
          <div className="mt-1 max-w-[200px] truncate text-[10px] text-ink-3">
            {hoveredSat.payload}
          </div>
        </div>
      )}

      {/* Selected Satellite Detailed Telemetry Card */}
      {selectedSatObj && !cinema && (
        <div className="pointer-events-auto fixed bottom-24 right-4 z-30 w-80 rounded-[16px] border border-cyan-500/40 bg-surface-2/95 p-3.5 font-mono text-xs shadow-2xl backdrop-blur-xl transition-all">
          <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-2">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-cyan-400/60 motion-safe:animate-ping" />
                <span className="size-1.5 rounded-full bg-cyan-400" />
              </span>
              <div>
                <div className="font-bold text-ink" style={{ color: selectedSatObj.color }}>
                  {selectedSatObj.name}
                </div>
                <div className="text-[10px] text-ink-4">
                  NORAD #{selectedSatObj.noradId} {"//"} {selectedSatObj.country} {selectedSatObj.agency}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                selectSatellite(null);
              }}
              className="rounded-full p-1 text-ink-4 hover:bg-white/10 hover:text-ink transition-colors"
              aria-label="Close satellite card"
            >
              <X size={14} />
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-[8px] bg-white/[0.03] p-1.5">
              <span className="text-[9.5px] uppercase text-ink-4">Orbit Class</span>
              <div className="font-bold text-ink">{selectedSatObj.type}</div>
            </div>
            <div className="rounded-[8px] bg-white/[0.03] p-1.5">
              <span className="text-[9.5px] uppercase text-ink-4">Altitude</span>
              <div className="font-bold text-cyan-300">{selectedSatObj.altitudeKm} KM</div>
            </div>
            <div className="rounded-[8px] bg-white/[0.03] p-1.5">
              <span className="text-[9.5px] uppercase text-ink-4">Inclination</span>
              <div className="font-bold text-ink">{selectedSatObj.inclinationDeg}°</div>
            </div>
            <div className="rounded-[8px] bg-white/[0.03] p-1.5">
              <span className="text-[9.5px] uppercase text-ink-4">Orbital Period</span>
              <div className="font-bold text-ink">{selectedSatObj.periodMin} MIN</div>
            </div>
          </div>

          <div className="mt-2 rounded-[8px] bg-white/[0.03] p-2 text-[11px]">
            <span className="text-[9.5px] uppercase text-ink-4">Mission & Payload</span>
            <div className="mt-0.5 text-ink-2 leading-relaxed">{selectedSatObj.payload}</div>
          </div>

          <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.08] pt-2 text-[10.5px]">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Radio size={13} className="motion-safe:animate-pulse" />
              <span>SIGINT TELEMETRY LOCK</span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundEngine.playOrbitalScan();
                const pos = calculateSatellitePosition(selectedSatObj, 0);
                if (map) {
                  map.easeTo({
                    center: [pos.lon, pos.lat],
                    zoom: Math.max(map.getZoom(), 2.8),
                    duration: 1200,
                  });
                }
              }}
              className="press flex items-center gap-1 rounded-full bg-cyan-500/20 px-2 py-0.5 text-cyan-300 hover:bg-cyan-500/30 font-bold"
            >
              <Crosshair size={11} />
              <span>CENTER</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Constellation Telemetry Indicator */}
      {ready && layers.satellites && showHud && (
        <div
          style={{ left: hudLeft + 230, bottom: hudBottom }}
          className="pointer-events-none absolute z-20 hidden items-center gap-2 rounded-full border border-cyan-500/30 bg-surface-2/80 px-3 py-1 font-mono text-[10px] tracking-wider text-ink-3 backdrop-blur md:flex"
        >
          <span className="size-1.5 rounded-full bg-cyan-400 motion-safe:animate-pulse" />
          <span>ORBITAL RECON:</span>
          <span className="font-bold text-cyan-200">
            {SATELLITE_CONSTELLATION.length} CONSTELLATION SATS ACTIVE
          </span>
        </div>
      )}
    </>
  );
}
