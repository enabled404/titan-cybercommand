"use client";

import { useEffect, useRef, useState } from "react";
import { angularDistance, useMapInstance } from "@/components/map/map-instance";
import { soundEngine } from "@/lib/audio/sound-engine";
import type { Incident } from "@/lib/types";
import { useSituation } from "@/stores/situation";

interface BallisticAttack {
  id: string;
  origin: { lon: number; lat: number; label: string };
  target: { lon: number; lat: number; label: string };
  color: string;
  protocol: string;
  severity: 1 | 2 | 3 | 4;
  startTime: number;
  duration: number; // ms
  arcHeight: number; // px peak
  trail: { x: number; y: number; time: number }[];
}

interface ImpactShockwave {
  id: string;
  lon: number;
  lat: number;
  color: string;
  severity: 1 | 2 | 3 | 4;
  startTime: number;
  duration: number; // ms
}

const ATTACK_PROTOCOLS = [
  { label: "DDoS SYN-FLOOD", color: "#ff4a3d", severity: 3 },
  { label: "COBALT STRIKE BEACON", color: "#ff7a00", severity: 4 },
  { label: "ZERO-DAY RCE", color: "#ff2a5f", severity: 4 },
  { label: "RANSOMWARE EXFIL", color: "#c084fc", severity: 4 },
  { label: "BGP ROUTE HIJACK", color: "#5ec8ff", severity: 3 },
  { label: "CREDENTIAL BRUTE FORCE", color: "#ffb547", severity: 2 },
  { label: "SQL INJECTION SPRAY", color: "#6ee7a8", severity: 2 },
  { label: "API TOKEN HARVEST", color: "#38bdf8", severity: 3 },
] as const;

// Global threat actor C2 origin hubs for simulated kinetic feeds
const THREAT_ACTOR_HUBS = [
  { lon: 37.6173, lat: 55.7558, label: "APT-28 / MOSCOW" },
  { lon: 116.4074, lat: 39.9042, label: "VOLT TYPHOON / BEIJING" },
  { lon: 125.7625, lat: 39.0392, label: "LAZARUS / PYONGYANG" },
  { lon: 51.389, lat: 35.6892, label: "CHARMING KITTEN / TEHRAN" },
  { lon: -77.0369, lat: 38.9072, label: "SHADOW BROKERS / VIRGINIA" },
  { lon: 2.3522, lat: 48.8566, label: "PROXY NODE / PARIS" },
  { lon: 106.8456, lat: -6.2088, label: "BOTNET POOL / JAKARTA" },
  { lon: -46.6333, lat: -23.5505, label: "FIN7 RELAY / SAO PAULO" },
  { lon: 28.0473, lat: -26.2041, label: "PHISHING GATEWAY / JOHANNESBURG" },
  { lon: 103.8198, lat: 1.3521, label: "C2 CLUSTER / SINGAPORE" },
  { lon: 139.6917, lat: 35.6895, label: "BOTNET SATELLITE / TOKYO" },
  { lon: -122.4194, lat: 37.7749, label: "TEST HARNESS / SILICON VALLEY" },
];

export function BallisticEngine({ incidents }: { incidents: Incident[] }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const map = useMapInstance((s) => s.map);
  const ready = useMapInstance((s) => s.ready);
  const selectedId = useSituation((s) => s.selectedId);
  const layers = useSituation((s) => s.layers);
  const selectedIncident = incidents.find((i) => i.id === selectedId);

  const attacksRef = useRef<BallisticAttack[]>([]);
  const shockwavesRef = useRef<ImpactShockwave[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  // Spawn attacks continuously
  useEffect(() => {
    if (!ready || !map || incidents.length === 0 || !layers.ballistics) {
      attacksRef.current = [];
      shockwavesRef.current = [];
      return;
    }

    const spawnAttack = (forcedTarget?: Incident) => {
      const target = forcedTarget ?? incidents[Math.floor(Math.random() * incidents.length)];
      if (!target) return;

      const origin = THREAT_ACTOR_HUBS[Math.floor(Math.random() * THREAT_ACTOR_HUBS.length)];
      const proto = ATTACK_PROTOCOLS[Math.floor(Math.random() * ATTACK_PROTOCOLS.length)];

      const attack: BallisticAttack = {
        id: `atk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        origin: { lon: origin.lon, lat: origin.lat, label: origin.label },
        target: { lon: target.lon, lat: target.lat, label: target.victim },
        color: proto.color,
        protocol: proto.label,
        severity: target.severity || proto.severity,
        startTime: performance.now(),
        duration: 2200 + Math.random() * 1400,
        arcHeight: 50 + Math.random() * 80,
        trail: [],
      };

      attacksRef.current.push(attack);
      soundEngine.playAttackLaunch(origin.lon);
    };

    // If an incident is selected, fire focused attacks to it
    if (selectedIncident) {
      spawnAttack(selectedIncident);
      const timer = window.setTimeout(() => spawnAttack(selectedIncident), 800);
      return () => window.clearTimeout(timer);
    }
  }, [ready, map, incidents, selectedIncident, layers.ballistics]);

  // Main rendering loop synchronized with requestAnimationFrame
  useEffect(() => {
    if (!ready || !map) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;

      const mapCanvas = map.getCanvas();
      if (!mapCanvas) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Synchronize dimensions
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
      const center = map.getCenter();

      // Periodically spawn new autonomous background attacks
      if (now - lastSpawnRef.current > 1800 && attacksRef.current.length < 9 && incidents.length > 0) {
        lastSpawnRef.current = now;
        const target = incidents[Math.floor(Math.random() * incidents.length)];
        const origin = THREAT_ACTOR_HUBS[Math.floor(Math.random() * THREAT_ACTOR_HUBS.length)];
        const proto = ATTACK_PROTOCOLS[Math.floor(Math.random() * ATTACK_PROTOCOLS.length)];

        attacksRef.current.push({
          id: `atk-${now}`,
          origin: { lon: origin.lon, lat: origin.lat, label: origin.label },
          target: { lon: target.lon, lat: target.lat, label: target.victim },
          color: proto.color,
          protocol: proto.label,
          severity: target.severity || proto.severity,
          startTime: now,
          duration: 2500 + Math.random() * 1200,
          arcHeight: 60 + Math.random() * 90,
          trail: [],
        });
        soundEngine.playAttackLaunch(origin.lon);
      }

      // 1. Render and update ballistic attacks
      const activeAttacks: BallisticAttack[] = [];

      for (const atk of attacksRef.current) {
        const elapsed = now - atk.startTime;
        const progress = Math.min(1, elapsed / atk.duration);

        // Check spherical visibility for interpolation
        const curLon = atk.origin.lon + (atk.target.lon - atk.origin.lon) * progress;
        const curLat = atk.origin.lat + (atk.target.lat - atk.origin.lat) * progress;
        const distFromCenter = angularDistance(center.lng, center.lat, curLon, curLat);

        if (distFromCenter <= 88) {
          try {
            const p = map.project([curLon, curLat]);
            // Parabolic altitude arching into space
            const altOffset = Math.sin(progress * Math.PI) * atk.arcHeight;
            const screenX = p.x;
            const screenY = p.y - altOffset;

            // Append trail
            atk.trail.push({ x: screenX, y: screenY, time: now });
            // Keep trail up to 450ms old
            atk.trail = atk.trail.filter((t) => now - t.time < 450);

            // Draw glowing comet trail
            if (atk.trail.length > 1) {
              ctx.lineWidth = 1.8;
              ctx.lineCap = "round";
              for (let i = 0; i < atk.trail.length - 1; i++) {
                const p1 = atk.trail[i];
                const p2 = atk.trail[i + 1];
                const ageRatio = (now - p1.time) / 450;
                const alpha = (1 - ageRatio) * 0.75;

                ctx.strokeStyle = atk.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }

            // Draw glowing missile head
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(screenX, screenY, 2.4, 0, Math.PI * 2);
            ctx.fill();

            // Outer glow halo
            const grad = ctx.createRadialGradient(screenX, screenY, 1, screenX, screenY, 9);
            grad.addColorStop(0, atk.color);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 9, 0, Math.PI * 2);
            ctx.fill();

            // Draw floating telemetry tag at mid-flight
            if (progress > 0.25 && progress < 0.85) {
              ctx.font = "8.5px 'Martian Mono', monospace";
              ctx.fillStyle = atk.color;
              ctx.globalAlpha = 0.85;
              ctx.fillText(atk.protocol, screenX + 8, screenY - 4);
            }
          } catch {
            // Coordinate projection safety
          }
        }

        // Impact reached!
        if (progress >= 1) {
          shockwavesRef.current.push({
            id: `shk-${now}-${Math.random()}`,
            lon: atk.target.lon,
            lat: atk.target.lat,
            color: atk.color,
            severity: atk.severity,
            startTime: now,
            duration: 850,
          });
          soundEngine.playImpact(atk.severity);
        } else {
          activeAttacks.push(atk);
        }
      }

      attacksRef.current = activeAttacks;

      // 2. Render impact shockwaves
      const activeShockwaves: ImpactShockwave[] = [];

      for (const shk of shockwavesRef.current) {
        const elapsed = now - shk.startTime;
        const progress = elapsed / shk.duration;

        if (progress < 1) {
          const distFromCenter = angularDistance(center.lng, center.lat, shk.lon, shk.lat);
          if (distFromCenter <= 88) {
            try {
              const p = map.project([shk.lon, shk.lat]);
              const radius = 3 + progress * (28 + shk.severity * 6);
              const alpha = (1 - progress) * 0.9;

              ctx.lineWidth = 1.4;
              ctx.strokeStyle = shk.color;
              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.stroke();

              // Secondary inner ring
              if (progress > 0.15) {
                ctx.lineWidth = 0.8;
                ctx.globalAlpha = alpha * 0.6;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 0.55, 0, Math.PI * 2);
                ctx.stroke();
              }
            } catch {
              // Ignore projection edge
            }
          }
          activeShockwaves.push(shk);
        }
      }

      shockwavesRef.current = activeShockwaves;
      ctx.restore();

      setActiveCount(activeAttacks.length);
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [ready, map, incidents, layers.ballistics]);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" />
      {/* Live Ballistic Missile HUD telemetry indicator */}
      {ready && layers.ballistics && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-20 hidden items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2/80 px-3 py-1 font-mono text-[10px] tracking-wider text-ink-3 backdrop-blur md:flex">
          <span className="size-1.5 animate-pulse rounded-full bg-confirmed" />
          <span>BALLISTIC THREAT FEED:</span>
          <span className="font-bold text-ink">{activeCount} ACTIVE TRACERS</span>
        </div>
      )}
    </>
  );
}
