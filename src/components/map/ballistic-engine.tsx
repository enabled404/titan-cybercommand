"use client";

import greatCircle from "@turf/great-circle";
import { useEffect, useRef, useState } from "react";
import { angularDistance, useMapInstance } from "@/components/map/map-instance";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useCombatFeed } from "@/stores/combat-feed";
import type { Incident } from "@/lib/types";
import { useSituation } from "@/stores/situation";

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  color: string;
  size: number;
}

interface BallisticAttack {
  id: string;
  combatId: string;
  origin: { lon: number; lat: number; label: string };
  target: { lon: number; lat: number; label: string };
  color: string;
  protocol: string;
  severity: 1 | 2 | 3 | 4;
  startTime: number;
  duration: number; // ms
  arcHeight: number; // px peak
  points: [number, number][]; // Pre-calculated Great Circle geodesic points
  trail: { x: number; y: number; time: number }[];
  embers: EmberParticle[];
}

interface ImpactShockwave {
  id: string;
  lon: number;
  lat: number;
  color: string;
  severity: 1 | 2 | 3 | 4;
  label: string;
  startTime: number;
  duration: number; // ms
}

const ATTACK_PROTOCOLS = [
  { label: "DDoS SYN-FLOOD", color: "#ff7800", severity: 3, resolved: "SINKHOLED" },
  { label: "COBALT STRIKE C2", color: "#ff3344", severity: 4, resolved: "INTERCEPTED" },
  { label: "ZERO-DAY RCE", color: "#d946ef", severity: 4, resolved: "CONTAINED" },
  { label: "LOCKBIT 3.0 EXFIL", color: "#ef4444", severity: 4, resolved: "INTERCEPTED" },
  { label: "BGP ROUTE HIJACK", color: "#06b6d4", severity: 3, resolved: "SINKHOLED" },
  { label: "CREDENTIAL BRUTE", color: "#f59e0b", severity: 2, resolved: "CONTAINED" },
  { label: "SUBSEA CABLE PROBE", color: "#38bdf8", severity: 3, resolved: "INTERCEPTED" },
  { label: "SQLi INJECTION", color: "#10b981", severity: 2, resolved: "SINKHOLED" },
] as const;

// Global threat actor C2 origin hubs for simulated kinetic feeds
const THREAT_ACTOR_HUBS = [
  { lon: 37.6173, lat: 55.7558, label: "APT28 / MOSCOW", country: "RU" },
  { lon: 116.4074, lat: 39.9042, label: "VOLT TYPHOON / BEIJING", country: "CN" },
  { lon: 125.7625, lat: 39.0392, label: "LAZARUS / PYONGYANG", country: "KP" },
  { lon: 51.389, lat: 35.6892, label: "CHARMING KITTEN / TEHRAN", country: "IR" },
  { lon: -77.0369, lat: 38.9072, label: "SHADOW BROKERS / VIRGINIA", country: "US" },
  { lon: 2.3522, lat: 48.8566, label: "PROXY RELAY / PARIS", country: "FR" },
  { lon: 106.8456, lat: -6.2088, label: "BOTNET POOL / JAKARTA", country: "ID" },
  { lon: -46.6333, lat: -23.5505, label: "FIN7 RELAY / SAO PAULO", country: "BR" },
  { lon: 28.0473, lat: -26.2041, label: "GATEWAY / JOHANNESBURG", country: "ZA" },
  { lon: 103.8198, lat: 1.3521, label: "C2 CLUSTER / SINGAPORE", country: "SG" },
  { lon: 139.6917, lat: 35.6895, label: "SATELLITE / TOKYO", country: "JP" },
  { lon: 26.1025, lat: 44.4268, label: "DARKGATE / BUCHAREST", country: "RO" },
];

function computeGeodesicPoints(origin: [number, number], target: [number, number]): [number, number][] {
  try {
    const gc = greatCircle(origin, target, { npoints: 48 });
    if (gc && gc.geometry) {
      if (gc.geometry.type === "LineString") {
        const coords = gc.geometry.coordinates as [number, number][];
        if (coords && coords.length >= 2) return coords;
      } else if (gc.geometry.type === "MultiLineString") {
        const coords = (gc.geometry.coordinates as [number, number][][]).flat(1);
        if (coords && coords.length >= 2) return coords;
      }
    }
  } catch {
    // Fallback to straight vector
  }
  return [origin, target];
}

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

      // Calculate True Geodesic Great Circle points
      const points = computeGeodesicPoints([origin.lon, origin.lat], [target.lon, target.lat]);

      // Log to Combat Intercept Feed
      const combatId = useCombatFeed.getState().addIntercept({
        origin: origin.label,
        originCountry: origin.country,
        target: target.country ? `${target.victim} (${target.country})` : target.victim,
        targetCountry: target.country,
        vector: proto.label,
        severity: target.severity || proto.severity,
        color: proto.color,
        status: "ENGAGED",
      });

      const attack: BallisticAttack = {
        id: `atk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        combatId,
        origin: { lon: origin.lon, lat: origin.lat, label: origin.label },
        target: { lon: target.lon, lat: target.lat, label: target.country ? `${target.victim} (${target.country})` : target.victim },
        color: proto.color,
        protocol: proto.label,
        severity: target.severity || proto.severity,
        startTime: performance.now(),
        duration: 2400 + Math.random() * 1600,
        arcHeight: 55 + Math.random() * 85,
        points,
        trail: [],
        embers: [],
      };

      attacksRef.current.push(attack);
      soundEngine.playAttackLaunch(origin.lon);
    };

    // If an incident is selected, fire focused barrage to it
    if (selectedIncident) {
      spawnAttack(selectedIncident);
      const timer = window.setTimeout(() => spawnAttack(selectedIncident), 600);
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

      // Synchronize canvas dimensions
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

      // High-density autonomous spawning: keep 16-22 concurrent attacks flying across Earth
      if (now - lastSpawnRef.current > 550 && attacksRef.current.length < 20 && incidents.length > 0) {
        lastSpawnRef.current = now;
        const target = incidents[Math.floor(Math.random() * incidents.length)];
        const origin = THREAT_ACTOR_HUBS[Math.floor(Math.random() * THREAT_ACTOR_HUBS.length)];
        const proto = ATTACK_PROTOCOLS[Math.floor(Math.random() * ATTACK_PROTOCOLS.length)];

        const points = computeGeodesicPoints([origin.lon, origin.lat], [target.lon, target.lat]);

        const combatId = useCombatFeed.getState().addIntercept({
          origin: origin.label,
          originCountry: origin.country,
          target: target.country ? `${target.victim} (${target.country})` : target.victim,
          targetCountry: target.country,
          vector: proto.label,
          severity: target.severity || proto.severity,
          color: proto.color,
          status: "ENGAGED",
        });

        attacksRef.current.push({
          id: `atk-${now}-${Math.random().toString(36).slice(2, 6)}`,
          combatId,
          origin: { lon: origin.lon, lat: origin.lat, label: origin.label },
          target: { lon: target.lon, lat: target.lat, label: target.country ? `${target.victim} (${target.country})` : target.victim },
          color: proto.color,
          protocol: proto.label,
          severity: target.severity || proto.severity,
          startTime: now,
          duration: 2500 + Math.random() * 1400,
          arcHeight: 50 + Math.random() * 80,
          points,
          trail: [],
          embers: [],
        });
        soundEngine.playAttackLaunch(origin.lon);
      }

      // 1. Render and update ballistic attacks
      const activeAttacks: BallisticAttack[] = [];

      for (const atk of attacksRef.current) {
        if (!atk.points || atk.points.length < 2) continue;
        const elapsed = now - atk.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / atk.duration));

        // Interpolate along pre-computed Great Circle coordinates
        const numPoints = atk.points.length;
        const indexFloat = progress * (numPoints - 1);
        const idx0 = Math.max(0, Math.min(numPoints - 1, Math.floor(indexFloat)));
        const idx1 = Math.max(0, Math.min(numPoints - 1, idx0 + 1));
        const frac = indexFloat - idx0;

        const p0 = atk.points[idx0];
        const p1 = atk.points[idx1];
        if (!p0 || !p1) continue;

        const curLon = p0[0] + (p1[0] - p0[0]) * frac;
        const curLat = p0[1] + (p1[1] - p0[1]) * frac;

        const distFromCenter = angularDistance(center.lng, center.lat, curLon, curLat);

        // A. Draw Subtle Holographic Arc Ray across Great Circle
        if (atk.points.length > 2) {
          ctx.beginPath();
          let started = false;
          for (let i = 0; i < atk.points.length; i += 2) {
            const pt = atk.points[i];
            const d = angularDistance(center.lng, center.lat, pt[0], pt[1]);
            if (d <= 88) {
              try {
                const sp = map.project([pt[0], pt[1]]);
                const ptProgress = i / (atk.points.length - 1);
                const arcY = sp.y - Math.sin(ptProgress * Math.PI) * atk.arcHeight;
                if (!started) {
                  ctx.moveTo(sp.x, arcY);
                  started = true;
                } else {
                  ctx.lineTo(sp.x, arcY);
                }
              } catch {
                // Projection safety
              }
            }
          }
          if (started) {
            ctx.strokeStyle = atk.color;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.16;
            ctx.stroke();
          }
        }

        // B. Render Plasma Missile Head & Trail
        if (distFromCenter <= 88) {
          try {
            const p = map.project([curLon, curLat]);
            const altOffset = Math.sin(progress * Math.PI) * atk.arcHeight;
            const screenX = p.x;
            const screenY = p.y - altOffset;

            // Append trail point
            atk.trail.push({ x: screenX, y: screenY, time: now });
            atk.trail = atk.trail.filter((t) => now - t.time < 550);

            // Spawn drifting ember spark particles
            if (Math.random() < 0.65) {
              atk.embers.push({
                x: screenX + (Math.random() - 0.5) * 4,
                y: screenY + (Math.random() - 0.5) * 4,
                vx: (Math.random() - 0.5) * 1.2,
                vy: (Math.random() - 0.5) * 1.2,
                alpha: 1,
                color: atk.color,
                size: 1 + Math.random() * 1.5,
              });
            }

            // Draw glowing luminous laser trail
            if (atk.trail.length > 1) {
              ctx.lineWidth = 2.2;
              ctx.lineCap = "round";
              for (let i = 0; i < atk.trail.length - 1; i++) {
                const p1 = atk.trail[i];
                const p2 = atk.trail[i + 1];
                const ageRatio = (now - p1.time) / 550;
                const alpha = (1 - ageRatio) * 0.85;

                ctx.strokeStyle = atk.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
              }
            }

            // Draw drifting embers
            const aliveEmbers: EmberParticle[] = [];
            for (const emb of atk.embers) {
              emb.x += emb.vx;
              emb.y += emb.vy;
              emb.alpha -= 0.045;
              if (emb.alpha > 0) {
                ctx.fillStyle = emb.color;
                ctx.globalAlpha = emb.alpha * 0.9;
                ctx.beginPath();
                ctx.arc(emb.x, emb.y, emb.size, 0, Math.PI * 2);
                ctx.fill();
                aliveEmbers.push(emb);
              }
            }
            atk.embers = aliveEmbers;

            // Draw glowing white plasma missile head
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(screenX, screenY, 2.8, 0, Math.PI * 2);
            ctx.fill();

            // Outer radiant corona glow
            const grad = ctx.createRadialGradient(screenX, screenY, 1, screenX, screenY, 11);
            grad.addColorStop(0, atk.color);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 11, 0, Math.PI * 2);
            ctx.fill();

            // Floating tactical HUD vector tag mid-flight
            if (progress > 0.3 && progress < 0.8) {
              ctx.font = "8.5px 'Martian Mono', monospace";
              ctx.fillStyle = atk.color;
              ctx.globalAlpha = 0.9;
              ctx.fillText(atk.protocol, screenX + 9, screenY - 4);
            }
          } catch {
            // Coordinate projection safety
          }
        }

        // Impact reached!
        if (progress >= 1) {
          const proto = ATTACK_PROTOCOLS.find((p) => p.label === atk.protocol) || ATTACK_PROTOCOLS[0];
          useCombatFeed.getState().updateStatus(atk.combatId, proto.resolved as "INTERCEPTED");

          shockwavesRef.current.push({
            id: `shk-${now}-${Math.random()}`,
            lon: atk.target.lon,
            lat: atk.target.lat,
            color: atk.color,
            severity: atk.severity,
            label: atk.target.label,
            startTime: now,
            duration: 950,
          });
          soundEngine.playImpact(atk.severity);
        } else {
          activeAttacks.push(atk);
        }
      }

      attacksRef.current = activeAttacks;

      // 2. Render impact shockwaves and ground detonation flashes
      const activeShockwaves: ImpactShockwave[] = [];

      for (const shk of shockwavesRef.current) {
        const elapsed = now - shk.startTime;
        const progress = elapsed / shk.duration;

        if (progress < 1) {
          const distFromCenter = angularDistance(center.lng, center.lat, shk.lon, shk.lat);
          if (distFromCenter <= 88) {
            try {
              const p = map.project([shk.lon, shk.lat]);
              const radius = 3 + progress * (32 + shk.severity * 8);
              const alpha = (1 - progress);

              // Concentric expanding ring 1 (primary)
              ctx.lineWidth = 1.6;
              ctx.strokeStyle = shk.color;
              ctx.globalAlpha = alpha * 0.95;
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.stroke();

              // Secondary inner ring
              if (progress > 0.12) {
                ctx.lineWidth = 1.0;
                ctx.globalAlpha = alpha * 0.7;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 0.6, 0, Math.PI * 2);
                ctx.stroke();
              }

              // Ground flash core on initial impact
              if (progress < 0.25) {
                const flashAlpha = (1 - progress / 0.25);
                ctx.fillStyle = "#ffffff";
                ctx.globalAlpha = flashAlpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fill();
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
          <span>BALLISTIC KINETIC SWARM:</span>
          <span className="font-bold text-ink">{activeCount} ACTIVE TRACERS</span>
        </div>
      )}
    </>
  );
}
