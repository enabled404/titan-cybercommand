"use client";

import { useEffect, useRef } from "react";
import { globeCircle, useMapInstance } from "@/components/map/map-instance";

export function OrbitalHud() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const map = useMapInstance((s) => s.map);
  const ready = useMapInstance((s) => s.ready);

  useEffect(() => {
    if (!ready || !map) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).has("still");

    let animId = 0;
    let scanAngle = 0;
    let running = true;

    const renderFrame = (scheduleNext: boolean) => {
      if (!running) return;

      if (document.hidden) {
        if (scheduleNext) animId = requestAnimationFrame(() => renderFrame(true));
        return;
      }

      const mapCanvas = map.getCanvas();
      if (!mapCanvas) {
        if (scheduleNext) animId = requestAnimationFrame(() => renderFrame(true));
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const w = mapCanvas.clientWidth;
      const h = mapCanvas.clientHeight;

      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const zoom = map.getZoom();
      const pitch = map.getPitch();
      const bearing = map.getBearing();

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // Four Tactical Viewport Corner Brackets (Aerospace / Situation Room HUD)
      const bracketMargin = 16;
      const bracketLen = 14;
      ctx.strokeStyle = "rgba(6, 182, 212, 0.22)";
      ctx.lineWidth = 1;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(bracketMargin, bracketMargin + bracketLen);
      ctx.lineTo(bracketMargin, bracketMargin);
      ctx.lineTo(bracketMargin + bracketLen, bracketMargin);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(w - bracketMargin - bracketLen, bracketMargin);
      ctx.lineTo(w - bracketMargin, bracketMargin);
      ctx.lineTo(w - bracketMargin, bracketMargin + bracketLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(bracketMargin, h - bracketMargin - bracketLen);
      ctx.lineTo(bracketMargin, h - bracketMargin);
      ctx.lineTo(bracketMargin + bracketLen, h - bracketMargin);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(w - bracketMargin - bracketLen, h - bracketMargin);
      ctx.lineTo(w - bracketMargin, h - bracketMargin);
      ctx.lineTo(w - bracketMargin, h - bracketMargin - bracketLen);
      ctx.stroke();

      if (zoom >= 5) {
        // High-Zoom Tactical Grid Viewport
        const cx = w / 2;
        const cy = h / 2;
        const ch = 12;

        ctx.strokeStyle = "rgba(6, 182, 212, 0.35)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx - ch, cy);
        ctx.lineTo(cx + ch, cy);
        ctx.moveTo(cx, cy - ch);
        ctx.lineTo(cx, cy + ch);
        ctx.stroke();

        const mapCenter = map.getCenter();
        const latStr = `${Math.abs(mapCenter.lat).toFixed(2)}°${mapCenter.lat >= 0 ? "N" : "S"}`;
        const lngStr = `${Math.abs(mapCenter.lng).toFixed(2)}°${mapCenter.lng >= 0 ? "E" : "W"}`;
        ctx.font = "8.5px 'Martian Mono', monospace";
        ctx.fillStyle = "rgba(6, 182, 212, 0.65)";
        ctx.textAlign = "center";
        ctx.fillText(`LOCAL RECON TARGET // ${latStr} ${lngStr} // Z${zoom.toFixed(1)} // HDG ${Math.round(bearing)}°`, cx, cy + 20);

        ctx.restore();
        if (scheduleNext) animId = requestAnimationFrame(() => renderFrame(true));
        return;
      }

      const { x, y, r } = globeCircle(map);

      if (r > 40 && x > -r && x < w + r && y > -r && y < h + r) {
        const orbitR = r * 1.04;
        const outerR = r * 1.08;

        // 0. Atmospheric Rim Glow (Limb Illumination)
        const atmoGrad = ctx.createRadialGradient(x, y, r * 0.93, x, y, r * 1.08);
        atmoGrad.addColorStop(0, "rgba(6, 182, 212, 0)");
        atmoGrad.addColorStop(0.6, "rgba(6, 182, 212, 0.08)");
        atmoGrad.addColorStop(0.85, "rgba(14, 165, 233, 0.18)");
        atmoGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
        ctx.fillStyle = atmoGrad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.08, 0, Math.PI * 2);
        ctx.fill();

        // 1. Orbital Ring
        ctx.strokeStyle = "rgba(6, 182, 212, 0.18)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(x, y, orbitR, 0, Math.PI * 2);
        ctx.stroke();

        // 2. Outer Thin Hairline
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 8]);
        ctx.beginPath();
        ctx.arc(x, y, outerR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // 3. Dynamic Rotating Compass Degree Ticks (synchronized with camera bearing)
        for (let deg = 0; deg < 360; deg += 30) {
          const rad = ((deg - bearing) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          const isNorth = deg === 270;
          const isCardinal = deg % 90 === 0;

          const p1x = x + cos * (orbitR - (isNorth ? 6 : 4));
          const p1y = y + sin * (orbitR - (isNorth ? 6 : 4));
          const p2x = x + cos * (orbitR + (isNorth ? 6 : 4));
          const p2y = y + sin * (orbitR + (isNorth ? 6 : 4));

          ctx.strokeStyle = isNorth
            ? "#06b6d4"
            : isCardinal
              ? "rgba(6, 182, 212, 0.55)"
              : "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = isNorth ? 2 : isCardinal ? 1.4 : 0.8;
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.stroke();

          // Cardinal marks (N, E, S, W)
          if (isCardinal) {
            const label = deg === 270 ? "N" : deg === 0 ? "E" : deg === 90 ? "S" : "W";
            ctx.font = isNorth ? "bold 9.5px 'Martian Mono', monospace" : "8.5px 'Martian Mono', monospace";
            ctx.fillStyle = isNorth ? "#22d3ee" : "rgba(6, 182, 212, 0.7)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x + cos * (orbitR + 15), y + sin * (orbitR + 15));
          }
        }

        // 4. Rotating Radar Scan Sweep (static angle under reduced motion)
        if (!reduced) {
          scanAngle += 0.008;
        }
        const sweepGrad = ctx.createConicGradient(scanAngle, x, y);
        sweepGrad.addColorStop(0, "rgba(6, 182, 212, 0.08)");
        sweepGrad.addColorStop(0.12, "rgba(6, 182, 212, 0.0)");
        sweepGrad.addColorStop(1, "rgba(6, 182, 212, 0.0)");

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.arc(x, y, orbitR, 0, Math.PI * 2);
        ctx.fill();

        // 5. Subtle Center Targeting Crosshair
        const chSize = 10;
        ctx.strokeStyle = "rgba(6, 182, 212, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - chSize, y);
        ctx.lineTo(x - 3, y);
        ctx.moveTo(x + 3, y);
        ctx.lineTo(x + chSize, y);
        ctx.moveTo(x, y - chSize);
        ctx.lineTo(x, y - 3);
        ctx.moveTo(x, y + 3);
        ctx.lineTo(x, y + chSize);
        ctx.stroke();

        // 6. Real-time Telemetry Coordinates Readout
        const mapCenter = map.getCenter();
        const latStr = `${Math.abs(mapCenter.lat).toFixed(1)}°${mapCenter.lat >= 0 ? "N" : "S"}`;
        const lngStr = `${Math.abs(mapCenter.lng).toFixed(1)}°${mapCenter.lng >= 0 ? "E" : "W"}`;
        const zoomStr = `Z${map.getZoom().toFixed(1)}`;
        const pitchStr = pitch > 2 ? ` // PITCH ${Math.round(pitch)}°` : "";
        const bearingStr = Math.abs(bearing) > 2 ? ` // HDG ${Math.round((bearing + 360) % 360)}°` : "";
        ctx.font = "8.5px 'Martian Mono', monospace";
        ctx.fillStyle = "rgba(6, 182, 212, 0.65)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(`GEO ${latStr} ${lngStr} // ${zoomStr}${pitchStr}${bearingStr}`, x, y + orbitR + 10);
      }

      ctx.restore();
      if (scheduleNext) {
        animId = requestAnimationFrame(() => renderFrame(true));
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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    }

    animId = requestAnimationFrame(() => renderFrame(true));
    return () => {
      running = false;
      cancelAnimationFrame(animId);
    };
  }, [ready, map]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[6]" aria-hidden="true" />;
}
