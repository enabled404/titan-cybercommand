"use client";

import greatCircle from "@turf/great-circle";
import { useEffect, useRef, useState } from "react";
import { angularDistance, useMapInstance } from "@/components/map/map-instance";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useCombatFeed } from "@/stores/combat-feed";
import type { BotnetC2Node, Incident } from "@/lib/types";
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

// Global Tier-1 internet backbone routing exchanges & transit nodes
const INTERNET_TRANSIT_HUBS = [
  { lon: 8.6821, lat: 50.1109, label: "DE-CIX / FRANKFURT", country: "DE" },
  { lon: 4.9041, lat: 52.3676, label: "AMS-IX / AMSTERDAM", country: "NL" },
  { lon: 103.8198, lat: 1.3521, label: "EQUINIX SG1 / SINGAPORE", country: "SG" },
  { lon: -77.4874, lat: 39.0438, label: "DATA ALLEY / ASHBURN", country: "US" },
  { lon: 139.6917, lat: 35.6895, label: "JPNAP / TOKYO", country: "JP" },
  { lon: -46.6333, lat: -23.5505, label: "IX.BR / SAO PAULO", country: "BR" },
  { lon: 37.6173, lat: 55.7558, label: "MSK-IX / MOSCOW", country: "RU" },
  { lon: 28.0473, lat: -26.2041, label: "NAPAFRICA / JOHANNESBURG", country: "ZA" },
  { lon: 106.8456, lat: -6.2088, label: "BOTNET POOL / JAKARTA", country: "ID" },
  { lon: 26.1025, lat: 44.4268, label: "DARKGATE / BUCHAREST", country: "RO" },
  { lon: -0.1278, lat: 51.5074, label: "LINX / LONDON", country: "GB" },
  { lon: 151.2093, lat: -33.8688, label: "EQUINIX SY3 / SYDNEY", country: "AU" },
];

function resolveThreatOrigin(target?: Incident): { lon: number; lat: number; label: string; country: string } {
  const actor = target?.actor?.toLowerCase() ?? "";

  // 1. Russian-nexus ransomware syndicates and APT groups
  if (
    actor.includes("qilin") ||
    actor.includes("akira") ||
    actor.includes("lockbit") ||
    actor.includes("blackcat") ||
    actor.includes("alphv") ||
    actor.includes("rhysida") ||
    actor.includes("play") ||
    actor.includes("medusa") ||
    actor.includes("darkgate") ||
    actor.includes("apt28") ||
    actor.includes("apt29") ||
    actor.includes("fancy bear") ||
    actor.includes("sandworm") ||
    actor.includes("russian")
  ) {
    const actorUpper = (target?.actor || "RANSOMWARE").toUpperCase();
    const ruHubs = [
      { lon: 37.6173, lat: 55.7558, label: `${actorUpper} / MOSCOW`, country: "RU" },
      { lon: 30.3351, lat: 59.9343, label: `${actorUpper} / ST. PETERSBURG`, country: "RU" },
      { lon: 26.1025, lat: 44.4268, label: `${actorUpper} / BUCHAREST RELAY`, country: "RO" },
    ];
    return ruHubs[Math.floor(Math.random() * ruHubs.length)];
  }

  // 2. Eastern European bulletproof hosting & extortion syndicates (N0n, Alduin, BYOD)
  if (
    actor.includes("n0n") ||
    actor.includes("alduin") ||
    actor.includes("byod") ||
    actor.includes("whitearmor") ||
    actor.includes("redact") ||
    actor.includes("mortem")
  ) {
    const actorUpper = (target?.actor || "CARTEL").toUpperCase();
    const bulHubs = [
      { lon: 23.3219, lat: 42.6977, label: `${actorUpper} / SOFIA RELAY`, country: "BG" },
      { lon: 28.8638, lat: 47.0105, label: `${actorUpper} / CHISINAU C2`, country: "MD" },
      { lon: 76.8512, lat: 43.222, label: `${actorUpper} / ALMATY FAST-FLUX`, country: "KZ" },
    ];
    return bulHubs[Math.floor(Math.random() * bulHubs.length)];
  }

  // 3. Chinese state-sponsored APT groups
  if (
    actor.includes("typhoon") ||
    actor.includes("volt") ||
    actor.includes("salt") ||
    actor.includes("flax") ||
    actor.includes("chimera") ||
    actor.includes("aoqin") ||
    actor.includes("crafty falcon") ||
    actor.includes("apt41") ||
    actor.includes("china") ||
    actor.includes("chinese")
  ) {
    const actorUpper = (target?.actor || "APT").toUpperCase();
    const cnHubs = [
      { lon: 116.4074, lat: 39.9042, label: `${actorUpper} / BEIJING`, country: "CN" },
      { lon: 121.4737, lat: 31.2304, label: `${actorUpper} / SHANGHAI`, country: "CN" },
    ];
    return cnHubs[Math.floor(Math.random() * cnHubs.length)];
  }

  // 4. North Korean state-sponsored APT groups
  if (actor.includes("lazarus") || actor.includes("kimsuky") || actor.includes("korea") || actor.includes("dprk")) {
    const actorUpper = (target?.actor || "LAZARUS").toUpperCase();
    return { lon: 125.7625, lat: 39.0392, label: `${actorUpper} / PYONGYANG`, country: "KP" };
  }

  // 5. Iranian state-sponsored APT groups
  if (actor.includes("kitten") || actor.includes("oilrig") || actor.includes("muddywater") || actor.includes("peach") || actor.includes("iran")) {
    const actorUpper = (target?.actor || "APT33").toUpperCase();
    return { lon: 51.389, lat: 35.6892, label: `${actorUpper} / TEHRAN`, country: "IR" };
  }

  // 6. Distributed cybercrime syndicates (ShinyHunters, Scattered Spider)
  if (actor.includes("shiny") || actor.includes("scattered") || actor.includes("spider") || actor.includes("lapsus")) {
    const actorUpper = (target?.actor || "CYBERCRIME").toUpperCase();
    const proxyHubs = [
      { lon: 4.9041, lat: 52.3676, label: `${actorUpper} / AMSTERDAM PROXY`, country: "NL" },
      { lon: 8.6821, lat: 50.1109, label: `${actorUpper} / FRANKFURT C2`, country: "DE" },
    ];
    return proxyHubs[Math.floor(Math.random() * proxyHubs.length)];
  }

  // 7. Filter candidate transit hubs to avoid domestic / close-loop collisions
  const candidateHubs = target?.country
    ? INTERNET_TRANSIT_HUBS.filter((h) => h.country !== target.country)
    : INTERNET_TRANSIT_HUBS;
  const hubs = candidateHubs.length > 0 ? candidateHubs : INTERNET_TRANSIT_HUBS;

  // 8. Named actor not in predefined catalog
  if (target?.actor) {
    const actorUpper = target.actor.toUpperCase();
    const fallback = hubs[Math.floor(Math.random() * hubs.length)];
    return { lon: fallback.lon, lat: fallback.lat, label: `${actorUpper} / ${fallback.label.split(" / ")[1]}`, country: fallback.country };
  }

  // 9. Global backbone routing exchange
  return hubs[Math.floor(Math.random() * hubs.length)];
}

function resolveThreatVector(target?: Incident): {
  label: string;
  color: string;
  severity: 1 | 2 | 3 | 4;
  resolved: "INTERCEPTED" | "SINKHOLED" | "CONTAINED";
} {
  if (target?.cves && target.cves.length > 0) {
    return {
      label: `EXPLOIT: ${target.cves[0]}`,
      color: "#d946ef",
      severity: 4,
      resolved: "INTERCEPTED",
    };
  }

  if (target?.type === "ransomware") {
    const label = target.actor ? `${target.actor.toUpperCase()} EXFIL` : "RANSOMWARE EXFIL";
    return {
      label,
      color: "#ef4444",
      severity: 4,
      resolved: "SINKHOLED",
    };
  }

  if (target?.type === "ddos") {
    return {
      label: "DDoS SYN-FLOOD",
      color: "#ff7800",
      severity: 3,
      resolved: "SINKHOLED",
    };
  }

  if (target?.type === "supply_chain") {
    return {
      label: "SUPPLY CHAIN INJECTION",
      color: "#06b6d4",
      severity: 4,
      resolved: "INTERCEPTED",
    };
  }

  if (target?.type === "espionage") {
    return {
      label: "APT C2 INFILTRATION",
      color: "#ff3344",
      severity: 4,
      resolved: "CONTAINED",
    };
  }

  if (target?.type === "data_breach") {
    return {
      label: "CREDENTIAL EXFILTRATION",
      color: "#f59e0b",
      severity: target.severity || 3,
      resolved: "CONTAINED",
    };
  }

  if (target?.type === "extortion") {
    return {
      label: "DATA EXTORTION PROBE",
      color: "#ec4899",
      severity: 3,
      resolved: "SINKHOLED",
    };
  }

  return {
    label: "TACTICAL INTRUSION",
    color: "#38bdf8",
    severity: target?.severity || 2,
    resolved: "CONTAINED",
  };
}

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

export function BallisticEngine({
  incidents,
  botnetC2s = [],
  hudLeft = 452,
  hudBottom = 236,
  showHud = true,
}: {
  incidents: Incident[];
  botnetC2s?: BotnetC2Node[];
  hudLeft?: number;
  hudBottom?: number;
  showHud?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const map = useMapInstance((s) => s.map);
  const ready = useMapInstance((s) => s.ready);
  const selectedId = useSituation((s) => s.selectedId);
  const selectedActor = useSituation((s) => s.selectedActor);
  const actorFilter = useSituation((s) => s.actorFilter || s.selectedActor);
  const layers = useSituation((s) => s.layers);
  const cinema = useSituation((s) => s.cinema);
  const wargameSim = useSituation((s) => s.wargameSim);
  const reconTarget = useSituation((s) => s.reconTarget);
  const replay = useSituation((s) => s.replay);
  const selectedIncident = incidents.find((i) => i.id === selectedId);

  const selectedIncidentRef = useRef(selectedIncident);
  useEffect(() => {
    selectedIncidentRef.current = selectedIncident;
  }, [selectedIncident]);

  const botnetC2sRef = useRef(botnetC2s);
  useEffect(() => {
    botnetC2sRef.current = botnetC2s;
  }, [botnetC2s]);

  const wargameSimRef = useRef(wargameSim);
  useEffect(() => {
    wargameSimRef.current = wargameSim;
  }, [wargameSim]);

  const reconTargetRef = useRef(reconTarget);
  useEffect(() => {
    reconTargetRef.current = reconTarget;
  }, [reconTarget]);

  const selectedActorRef = useRef(selectedActor);
  useEffect(() => {
    selectedActorRef.current = selectedActor;
  }, [selectedActor]);

  const actorFilterRef = useRef(actorFilter);
  useEffect(() => {
    actorFilterRef.current = actorFilter;
  }, [actorFilter]);

  const replayRef = useRef(replay);
  useEffect(() => {
    replayRef.current = replay;
  }, [replay]);

  const attacksRef = useRef<BallisticAttack[]>([]);
  const shockwavesRef = useRef<ImpactShockwave[]>([]);
  const lastSpawnRef = useRef<number>(0);
  const lastC2SpawnRef = useRef<number>(0);
  const lastReplayCountRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const [activeCount, setActiveCount] = useState(0);
  const activeCountRef = useRef(0);
  const hasOverlayTarget = Boolean(wargameSim?.active || reconTarget);

  // Spawn attacks continuously
  useEffect(() => {
    if (!ready || !map || incidents.length === 0 || !layers.ballistics) {
      if (!hasOverlayTarget) {
        attacksRef.current = [];
        shockwavesRef.current = [];
      }
      return;
    }

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).has("still");
    if (reduced) return;

    const spawnAttack = (forcedTarget?: Incident) => {
      const target = forcedTarget ?? incidents[Math.floor(Math.random() * incidents.length)];
      if (!target) return;

      const origin = resolveThreatOrigin(target);
      const proto = resolveThreatVector(target);

      // Calculate True Geodesic Great Circle points
      const points = computeGeodesicPoints([origin.lon, origin.lat], [target.lon, target.lat]);

      // Log to Combat Intercept Feed with deep data provenance
      const combatId = useCombatFeed.getState().addIntercept({
        origin: origin.label,
        originCountry: origin.country,
        target: target.country ? `${target.victim} (${target.country})` : target.victim,
        targetCountry: target.country,
        vector: proto.label,
        severity: target.severity || proto.severity,
        color: proto.color,
        status: "ENGAGED",
        incidentId: target.id,
        verificationStatus: target.status,
        sourceName: target.sources?.[0]?.publisher || target.origin.toUpperCase(),
        cve: target.cves?.[0],
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
  }, [ready, map, incidents, selectedIncident, layers.ballistics, hasOverlayTarget]);

  // Main rendering loop synchronized with requestAnimationFrame
  useEffect(() => {
    if (!ready || !map) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const syncCount = (next: number) => {
      if (activeCountRef.current !== next) {
        activeCountRef.current = next;
        setActiveCount(next);
      }
    };

    if (!layers.ballistics && !hasOverlayTarget) {
      attacksRef.current = [];
      shockwavesRef.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      syncCount(0);
      return;
    }

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).has("still");

    let running = true;

    const renderFrame = (scheduleNext: boolean) => {
      if (!running) return;

      if (document.hidden) {
        lastSpawnRef.current = performance.now();
        if (scheduleNext) animFrameRef.current = requestAnimationFrame(() => renderFrame(true));
        return;
      }

      const mapCanvas = map.getCanvas();
      if (!mapCanvas) {
        if (scheduleNext) animFrameRef.current = requestAnimationFrame(() => renderFrame(true));
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

      // Autonomous spawning: handle focused WarGames barrage or global threat actor traffic
      const curWargame = wargameSimRef.current;
      const curRecon = reconTargetRef.current;

      const spawnAttackForTarget = (target: Incident) => {
        const origin = resolveThreatOrigin(target);
        const proto = resolveThreatVector(target);
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
          incidentId: target.id,
          verificationStatus: target.status,
          sourceName: target.sources?.[0]?.publisher || target.origin.toUpperCase(),
          cve: target.cves?.[0],
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
      };

      if (!reduced && curWargame?.active && !curWargame.mitigated) {
        if (now - lastSpawnRef.current > 380 && attacksRef.current.length < 24) {
          lastSpawnRef.current = now;
          const origin = resolveThreatOrigin();
          const points = computeGeodesicPoints([origin.lon, origin.lat], [curWargame.coords[0], curWargame.coords[1]]);

          const combatId = useCombatFeed.getState().addIntercept({
            origin: origin.label,
            originCountry: origin.country,
            target: `${curWargame.code} (${curWargame.title.slice(0, 16)}...)`,
            targetCountry: "TARGET",
            vector: "DEFCON-1 BARRAGE",
            severity: 4,
            color: "#ff2233",
            status: "ENGAGED",
          });

          attacksRef.current.push({
            id: `wg-${now}-${Math.random().toString(36).slice(2, 6)}`,
            combatId,
            origin: { lon: origin.lon, lat: origin.lat, label: origin.label },
            target: { lon: curWargame.coords[0], lat: curWargame.coords[1], label: curWargame.code },
            color: "#ff2233",
            protocol: "DEFCON-1 BARRAGE",
            severity: 4,
            startTime: now,
            duration: 1900 + Math.random() * 800,
            arcHeight: 65 + Math.random() * 95,
            points,
            trail: [],
            embers: [],
          });
          soundEngine.playAttackLaunch(origin.lon);
        }
      } else if (!reduced && layers.ballistics && incidents.length > 0) {
        // In replay mode, launch a synchronized attack trajectory to any newly unveiled victims
        if (replayRef.current?.active && incidents.length > lastReplayCountRef.current) {
          const diff = incidents.length - lastReplayCountRef.current;
          lastReplayCountRef.current = incidents.length;
          // In newest-first filtered incidents list, the newly arrived attacks are the first `diff` items
          const newlyAdded = incidents.slice(0, Math.min(diff, 4));
          for (const target of newlyAdded) {
            if (attacksRef.current.length < 24) {
              spawnAttackForTarget(target);
            }
          }
        } else if (replayRef.current?.active && incidents.length < lastReplayCountRef.current) {
          // Seeking backward in scrubber resets threshold so playing forward launches attacks again
          lastReplayCountRef.current = incidents.length;
        } else if (!replayRef.current?.active) {
          lastReplayCountRef.current = incidents.length;
        }

        // Autonomous ambient spawning only runs when NOT in replay mode
        if (!replayRef.current?.active && now - lastSpawnRef.current > (cinema ? 900 : 320) && attacksRef.current.length < 24) {
          lastSpawnRef.current = now;
          const currentActor = actorFilterRef.current?.toLowerCase();
          let target = incidents[Math.floor(Math.random() * incidents.length)];
          if (currentActor) {
            const actorMatches = incidents.filter((i) => i.actor && i.actor.toLowerCase().includes(currentActor));
            if (actorMatches.length > 0) {
              target = actorMatches[Math.floor(Math.random() * actorMatches.length)];
            }
          }
          if (target) {
            spawnAttackForTarget(target);
          }
        }

        // Periodic C2 botnet telemetry heartbeat tracers
        if (layers.botnets && botnetC2sRef.current.length > 0 && now - lastC2SpawnRef.current > 4200 && attacksRef.current.length < 9) {
          lastC2SpawnRef.current = now;
          const c2 = botnetC2sRef.current[Math.floor(Math.random() * botnetC2sRef.current.length)];
          const hub = INTERNET_TRANSIT_HUBS[Math.floor(Math.random() * INTERNET_TRANSIT_HUBS.length)];
          if (c2 && hub) {
            const points = computeGeodesicPoints([c2.lon, c2.lat], [hub.lon, hub.lat]);
            const combatId = useCombatFeed.getState().addIntercept({
              origin: `C2 / ${c2.city || "NODE"} (${c2.country})`,
              originCountry: c2.country,
              target: hub.label,
              targetCountry: hub.country,
              vector: "C2 BEACON HEARTBEAT",
              severity: 2,
              color: "#d946ef",
              status: "ENGAGED",
              sourceName: c2.framework,
            });

            attacksRef.current.push({
              id: `c2-pulse-${now}-${Math.random().toString(36).slice(2, 6)}`,
              combatId,
              origin: { lon: c2.lon, lat: c2.lat, label: `${c2.framework} (${c2.ip})` },
              target: { lon: hub.lon, lat: hub.lat, label: hub.label },
              color: "#d946ef",
              protocol: "C2 HEARTBEAT",
              severity: 2,
              startTime: now,
              duration: 2600 + Math.random() * 800,
              arcHeight: 45 + Math.random() * 50,
              points,
              trail: [],
              embers: [],
            });
            soundEngine.playRadarPing();
          }
        }
      }

      // Precompute screen-space center for spherical radial normal projection
      const centerProj = map.project(center);
      const curZoom = map.getZoom();
      const globeBlend = Math.max(0, Math.min(1, (5.2 - curZoom) / 1.5));

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

        let lonDiff = p1[0] - p0[0];
        if (lonDiff > 180) lonDiff -= 360;
        if (lonDiff < -180) lonDiff += 360;
        const curLon = ((p0[0] + lonDiff * frac + 540) % 360) - 180;
        const curLat = p0[1] + (p1[1] - p0[1]) * frac;

        const distFromCenter = angularDistance(center.lng, center.lat, curLon, curLat);

        // A. Draw Luminous Multi-Pass Glowing Arc Ray across Great Circle
        if (atk.points.length > 2) {
          ctx.beginPath();
          let started = false;
          let prevLon: number | null = null;
          for (let i = 0; i < atk.points.length; i += 2) {
            const pt = atk.points[i];
            const d = angularDistance(center.lng, center.lat, pt[0], pt[1]);
            // Break path if point is behind globe or crosses antimeridian wrap
            const antimeridianBreak = prevLon !== null && Math.abs(pt[0] - prevLon) > 180;
            prevLon = pt[0];

            if (d <= 88 && !antimeridianBreak) {
              try {
                const sp = map.project([pt[0], pt[1]]);
                const ptProgress = i / (atk.points.length - 1);
                const alt = Math.sin(ptProgress * Math.PI) * atk.arcHeight;
                const rdx = sp.x - centerProj.x;
                const rdy = sp.y - centerProj.y;
                const rdist = Math.hypot(rdx, rdy);
                const normX = rdist > 0.5 ? rdx / rdist : 0;
                const normY = rdist > 0.5 ? rdy / rdist : -1;
                const dirX = normX * globeBlend;
                const dirY = normY * globeBlend - (1 - globeBlend);
                const dirLen = Math.hypot(dirX, dirY) || 1;
                const arcX = sp.x + (dirX / dirLen) * alt;
                const arcY = sp.y + (dirY / dirLen) * alt;
                if (!started) {
                  ctx.moveTo(arcX, arcY);
                  started = true;
                } else {
                  ctx.lineTo(arcX, arcY);
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
            // Pass 1: Vibrant ambient glowing aura
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = atk.color;
            ctx.lineWidth = 3.6;
            ctx.globalAlpha = 0.38;
            ctx.stroke();

            // Pass 2: High-contrast core trajectory line
            ctx.lineWidth = 1.4;
            ctx.globalAlpha = 0.85;
            ctx.stroke();

            // Pass 3: White-hot animated energy pulse traveling along the arc
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1.8;
            ctx.globalAlpha = 0.95;
            ctx.setLineDash([8, 22]);
            ctx.lineDashOffset = -(now * 0.045 + (atk.startTime % 1000) * 0.05);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }

          // Threat Actor Origin Hub Pulsing Beacon
          const originDist = angularDistance(center.lng, center.lat, atk.origin.lon, atk.origin.lat);
          if (originDist <= 88) {
            try {
              const op = map.project([atk.origin.lon, atk.origin.lat]);
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              const pulseProg = (now * 0.0018 + (atk.startTime % 1000) * 0.001) % 1;
              const beaconRadius = 3 + pulseProg * 13;

              // Outer radar ping
              ctx.strokeStyle = atk.color;
              ctx.lineWidth = 1.1;
              ctx.globalAlpha = (1 - pulseProg) * 0.75;
              ctx.beginPath();
              ctx.arc(op.x, op.y, beaconRadius, 0, Math.PI * 2);
              ctx.stroke();

              // Center origin hub pin
              ctx.fillStyle = atk.color;
              ctx.globalAlpha = 0.9;
              ctx.beginPath();
              ctx.arc(op.x, op.y, 2.2, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            } catch {
              // Projection edge safety
            }
          }
        }

        // B. Render Plasma Missile Head & Trail
        if (distFromCenter <= 88) {
          try {
            const p = map.project([curLon, curLat]);
            const altOffset = Math.sin(progress * Math.PI) * atk.arcHeight;
            const rdx = p.x - centerProj.x;
            const rdy = p.y - centerProj.y;
            const rdist = Math.hypot(rdx, rdy);
            const normX = rdist > 0.5 ? rdx / rdist : 0;
            const normY = rdist > 0.5 ? rdy / rdist : -1;
            const dirX = normX * globeBlend;
            const dirY = normY * globeBlend - (1 - globeBlend);
            const dirLen = Math.hypot(dirX, dirY) || 1;
            const screenX = p.x + (dirX / dirLen) * altOffset;
            const screenY = p.y + (dirY / dirLen) * altOffset;

            // Append trail point
            atk.trail.push({ x: screenX, y: screenY, time: now });
            atk.trail = atk.trail.filter((t) => now - t.time < 550);

            // Spawn directional hyper-velocity exhaust embers
            let thrustVx = 0;
            let thrustVy = 0;
            if (atk.trail.length >= 2) {
              const prev = atk.trail[atk.trail.length - 2];
              const tdx = screenX - prev.x;
              const tdy = screenY - prev.y;
              const tlen = Math.hypot(tdx, tdy) || 1;
              thrustVx = -(tdx / tlen) * (1.2 + Math.random() * 1.5);
              thrustVy = -(tdy / tlen) * (1.2 + Math.random() * 1.5);
            }
            if (Math.random() < 0.7) {
              atk.embers.push({
                x: screenX + (Math.random() - 0.5) * 3,
                y: screenY + (Math.random() - 0.5) * 3,
                vx: thrustVx + (Math.random() - 0.5) * 0.8,
                vy: thrustVy + (Math.random() - 0.5) * 0.8,
                alpha: 1,
                color: atk.color,
                size: 1 + Math.random() * 1.6,
              });
            }

            // Draw glowing luminous laser trail (triple-pass laser bloom with additive photon glow)
            if (atk.trail.length > 1) {
              ctx.lineCap = "round";
              ctx.lineJoin = "round";
              ctx.globalCompositeOperation = "lighter";

              // Pass 1: Outer radiant glow bloom
              ctx.lineWidth = 5.2;
              ctx.strokeStyle = atk.color;
              ctx.globalAlpha = 0.35;
              ctx.beginPath();
              ctx.moveTo(atk.trail[0].x, atk.trail[0].y);
              for (let i = 1; i < atk.trail.length; i++) {
                ctx.lineTo(atk.trail[i].x, atk.trail[i].y);
              }
              ctx.stroke();

              // Pass 2: High-energy core laser beam
              ctx.lineWidth = 2.0;
              ctx.strokeStyle = atk.color;
              ctx.globalAlpha = 0.88;
              ctx.beginPath();
              ctx.moveTo(atk.trail[0].x, atk.trail[0].y);
              for (let i = 1; i < atk.trail.length; i++) {
                ctx.lineTo(atk.trail[i].x, atk.trail[i].y);
              }
              ctx.stroke();

              // Pass 3: White-hot center plasma filament
              ctx.lineWidth = 0.9;
              ctx.strokeStyle = "#ffffff";
              ctx.globalAlpha = 0.95;
              ctx.beginPath();
              ctx.moveTo(atk.trail[0].x, atk.trail[0].y);
              for (let i = 1; i < atk.trail.length; i++) {
                ctx.lineTo(atk.trail[i].x, atk.trail[i].y);
              }
              ctx.stroke();

              ctx.globalCompositeOperation = "source-over";
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

            // Draw glowing white plasma missile head with additive photon corona
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = 1;
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(screenX, screenY, 3.0, 0, Math.PI * 2);
            ctx.fill();

            // Outer radiant corona glow
            const grad = ctx.createRadialGradient(screenX, screenY, 1, screenX, screenY, 13);
            grad.addColorStop(0, atk.color);
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

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
          const resolvedStatus: "INTERCEPTED" | "SINKHOLED" | "CONTAINED" =
            atk.protocol.includes("EXFIL") || atk.protocol.includes("SYN-FLOOD") || atk.protocol.includes("PROBE")
              ? "SINKHOLED"
              : atk.protocol.includes("INFILTRATION") || atk.protocol.includes("INTRUSION") || atk.protocol.includes("EXFILTRATION")
                ? "CONTAINED"
                : "INTERCEPTED";
          useCombatFeed.getState().updateStatus(atk.combatId, resolvedStatus);

          shockwavesRef.current.push({
            id: `shk-${now}-${Math.random()}`,
            lon: atk.target.lon,
            lat: atk.target.lat,
            color: atk.color,
            severity: atk.severity,
            label: atk.target.label,
            startTime: now,
            duration: 1400,
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
              const radius = 3 + progress * (36 + shk.severity * 10);
              const alpha = 1 - progress;

              ctx.save();
              ctx.globalCompositeOperation = "lighter";

              // Concentric expanding ring 1 (primary high-energy shockwave)
              ctx.lineWidth = 2.4;
              ctx.strokeStyle = shk.color;
              ctx.globalAlpha = alpha * 0.95;
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.stroke();

              // Secondary inner ring
              if (progress > 0.08) {
                ctx.lineWidth = 1.4;
                ctx.globalAlpha = alpha * 0.8;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 0.62, 0, Math.PI * 2);
                ctx.stroke();
              }

              // Tertiary outer ripple ring
              if (progress > 0.18) {
                ctx.lineWidth = 0.9;
                ctx.globalAlpha = alpha * 0.55;
                ctx.beginPath();
                ctx.arc(p.x, p.y, radius * 1.25, 0, Math.PI * 2);
                ctx.stroke();
              }

              // Ground flash core on initial impact
              if (progress < 0.28) {
                const flashAlpha = 1 - progress / 0.28;
                const flashGrad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 18);
                flashGrad.addColorStop(0, `rgba(255, 255, 255, ${flashAlpha})`);
                flashGrad.addColorStop(0.35, shk.color);
                flashGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
                ctx.fillStyle = flashGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
                ctx.fill();
              }
              ctx.restore();
            } catch {
              // Ignore projection edge
            }
          }
          activeShockwaves.push(shk);
        }
      }

      shockwavesRef.current = activeShockwaves;

      // 3. Render WarGames Target Reticle & Blast Perimeter if active
      if (curWargame?.active) {
        const dist = angularDistance(center.lng, center.lat, curWargame.coords[0], curWargame.coords[1]);
        if (dist <= 88) {
          try {
            const p = map.project([curWargame.coords[0], curWargame.coords[1]]);
            const pulse = (Math.sin(now * 0.007) + 1) * 0.5;
            const radius = 22 + pulse * 14;

            if (curWargame.mitigated) {
              // Defensive EMP shield ring
              ctx.lineWidth = 2.2;
              ctx.strokeStyle = "#06b6d4";
              ctx.fillStyle = "rgba(6, 182, 212, 0.12)";
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius * 1.3, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              ctx.font = "bold 9px 'Martian Mono', monospace";
              ctx.fillStyle = "#22d3ee";
              ctx.textAlign = "center";
              ctx.fillText("[DEFENSE COUNTERMEASURES ONLINE]", p.x, p.y + radius + 18);
            } else {
              // Active strike reticle
              ctx.lineWidth = 2;
              ctx.strokeStyle = "#ef4444";
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
              ctx.stroke();

              // Outer dashed targeting ring
              ctx.lineWidth = 1.2;
              ctx.strokeStyle = "rgba(239, 68, 68, 0.65)";
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc(p.x, p.y, radius * 1.5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.setLineDash([]);

              // Crosshairs
              ctx.strokeStyle = "#ff4444";
              ctx.beginPath();
              ctx.moveTo(p.x - radius - 8, p.y);
              ctx.lineTo(p.x + radius + 8, p.y);
              ctx.moveTo(p.x, p.y - radius - 8);
              ctx.lineTo(p.x, p.y + radius + 8);
              ctx.stroke();

              // Red alert target tag
              ctx.font = "bold 9.5px 'Martian Mono', monospace";
              ctx.fillStyle = "#ef4444";
              ctx.textAlign = "center";
              ctx.fillText(`DEFCON 1 TARGET: ${curWargame.code}`, p.x, p.y - radius - 10);
            }
          } catch {
            // Coordinate projection safety
          }
        }
      }

      // 4. Render Target Recon Sonar Reticle if active
      if (curRecon) {
        const dist = angularDistance(center.lng, center.lat, curRecon.coords[0], curRecon.coords[1]);
        if (dist <= 88) {
          try {
            const p = map.project([curRecon.coords[0], curRecon.coords[1]]);
            const radius = 24;

            // Sonar radar ripples
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = "#06b6d4";
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.stroke();

            // Expanding wave
            const waveR = 8 + ((now * 0.035) % 36);
            ctx.lineWidth = 1;
            ctx.strokeStyle = `rgba(6, 182, 212, ${1 - waveR / 44})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, waveR, 0, Math.PI * 2);
            ctx.stroke();

            // Crosshairs
            ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
            ctx.beginPath();
            ctx.moveTo(p.x - radius - 4, p.y);
            ctx.lineTo(p.x + radius + 4, p.y);
            ctx.moveTo(p.x, p.y - radius - 4);
            ctx.lineTo(p.x, p.y + radius + 4);
            ctx.stroke();

            // Label callout box
            ctx.font = "bold 9px 'Martian Mono', monospace";
            ctx.fillStyle = "#06b6d4";
            ctx.textAlign = "center";
            ctx.fillText(`OSINT TARGET: ${curRecon.domain.toUpperCase()}`, p.x, p.y - radius - 8);
            ctx.font = "8px 'Martian Mono', monospace";
            ctx.fillStyle = "#a5f3fc";
            ctx.fillText(`POSTURE: ${curRecon.grade} (${curRecon.score}/100)`, p.x, p.y + radius + 14);
          } catch {
            // Projection safety
          }
        }
      }

      // 5. Render Selected Incident Tactical Lock & Reticle
      const curSelected = selectedIncidentRef.current;
      if (curSelected && !curWargame?.active) {
        const dist = angularDistance(center.lng, center.lat, curSelected.lon, curSelected.lat);
        if (dist <= 88) {
          try {
            const p = map.project([curSelected.lon, curSelected.lat]);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";

            const pulse = (Math.sin(now * 0.005) + 1) * 0.5;
            const r = 24 + pulse * 6;
            const bracketSize = 8;
            const lockColor = "#06b6d4";

            // Dual Corner Brackets [ ]
            ctx.strokeStyle = lockColor;
            ctx.lineWidth = 1.8;

            // Top-left bracket
            ctx.beginPath();
            ctx.moveTo(p.x - r, p.y - r + bracketSize);
            ctx.lineTo(p.x - r, p.y - r);
            ctx.lineTo(p.x - r + bracketSize, p.y - r);
            ctx.stroke();

            // Top-right bracket
            ctx.beginPath();
            ctx.moveTo(p.x + r - bracketSize, p.y - r);
            ctx.lineTo(p.x + r, p.y - r);
            ctx.lineTo(p.x + r, p.y - r + bracketSize);
            ctx.stroke();

            // Bottom-right bracket
            ctx.beginPath();
            ctx.moveTo(p.x + r, p.y + r - bracketSize);
            ctx.lineTo(p.x + r, p.y + r);
            ctx.lineTo(p.x + r - bracketSize, p.y + r);
            ctx.stroke();

            // Bottom-left bracket
            ctx.beginPath();
            ctx.moveTo(p.x - r + bracketSize, p.y + r);
            ctx.lineTo(p.x - r, p.y + r);
            ctx.lineTo(p.x - r, p.y + r - bracketSize);
            ctx.stroke();

            // Rotating Azimuth Compass Tick Ring
            const spinAngle = now * 0.0012;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(spinAngle);
            ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 5]);
            ctx.beginPath();
            ctx.arc(0, 0, r + 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();

            // Focal Crosshairs
            ctx.strokeStyle = "rgba(6, 182, 212, 0.65)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x - r - 8, p.y);
            ctx.lineTo(p.x - r + 3, p.y);
            ctx.moveTo(p.x + r - 3, p.y);
            ctx.lineTo(p.x + r + 8, p.y);
            ctx.moveTo(p.x, p.y - r - 8);
            ctx.lineTo(p.x, p.y - r + 3);
            ctx.moveTo(p.x, p.y + r - 3);
            ctx.lineTo(p.x, p.y + r + 8);
            ctx.stroke();

            // Tactical Data Callout Tag
            ctx.font = "bold 9px 'Martian Mono', monospace";
            ctx.fillStyle = lockColor;
            ctx.textAlign = "left";
            const tagX = p.x + r + 12;
            const tagY = p.y - 12;

            // Callout connecting angled bracket line
            ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
            ctx.beginPath();
            ctx.moveTo(p.x + r, p.y);
            ctx.lineTo(tagX - 4, tagY + 4);
            ctx.lineTo(tagX + 80, tagY + 4);
            ctx.stroke();

            // Text readouts
            ctx.fillText(`TARGET: ${curSelected.victim.toUpperCase()}`, tagX, tagY);
            ctx.font = "8px 'Martian Mono', monospace";
            ctx.fillStyle = "#a5f3fc";
            const coordsStr = `${Math.abs(curSelected.lat).toFixed(1)}°${curSelected.lat >= 0 ? "N" : "S"} ${Math.abs(curSelected.lon).toFixed(1)}°${curSelected.lon >= 0 ? "E" : "W"}`;
            const statusStr = `${curSelected.status.toUpperCase()} // SEV-${curSelected.severity || 3}`;
            ctx.fillText(`${coordsStr} // ${statusStr}`, tagX, tagY + 13);

            if (curSelected.actor) {
              ctx.fillStyle = "#fdba74";
              ctx.fillText(`ACTOR: ${curSelected.actor.toUpperCase()}`, tagX, tagY + 23);
            }

            ctx.restore();
          } catch {
            // Projection safety
          }
        }
      }

      ctx.restore();

      syncCount(activeAttacks.length);
      if (scheduleNext) {
        animFrameRef.current = requestAnimationFrame(() => renderFrame(true));
      }
    };

    if (reduced) {
      const drawStatic = () => renderFrame(false);
      drawStatic();
      map.on("move", drawStatic);
      map.on("resize", drawStatic);
      return () => {
        running = false;
        map.off("move", drawStatic);
        map.off("resize", drawStatic);
        if (canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        syncCount(0);
      };
    }

    animFrameRef.current = requestAnimationFrame(() => renderFrame(true));

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      syncCount(0);
    };
  }, [ready, map, incidents, layers.ballistics, layers.botnets, hasOverlayTarget, cinema]);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden="true" />
      {/* Live Ballistic Missile HUD telemetry indicator */}
      {ready && layers.ballistics && showHud && (
        <div
          style={{ left: hudLeft, bottom: hudBottom }}
          className="pointer-events-none absolute z-20 hidden items-center gap-2 rounded-full border border-white/[0.08] bg-surface-2/80 px-3 py-1 font-mono text-[10px] tracking-wider text-ink-3 backdrop-blur md:flex"
        >
          <span className="size-1.5 rounded-full bg-confirmed motion-safe:animate-pulse" />
          <span>BALLISTIC KINETIC SWARM:</span>
          <span className="font-bold text-ink">{activeCount} ACTIVE TRACERS</span>
        </div>
      )}
    </>
  );
}
