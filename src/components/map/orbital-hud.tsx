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
    let wasBlank = false;

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
        wasBlank = false;
      }

      const zoom = map.getZoom();
      if (zoom >= 5) {
        if (!wasBlank) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          wasBlank = true;
        }
        if (scheduleNext) animId = requestAnimationFrame(() => renderFrame(true));
        return;
      }
      wasBlank = false;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const { x, y, r } = globeCircle(map);

      if (r > 40 && x > -r && x < w + r && y > -r && y < h + r) {
        const orbitR = r * 1.04;
        const outerR = r * 1.08;

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

        // 3. Degree Ticks (every 30 deg)
        for (let deg = 0; deg < 360; deg += 30) {
          const rad = (deg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);

          const p1x = x + cos * (orbitR - 4);
          const p1y = y + sin * (orbitR - 4);
          const p2x = x + cos * (orbitR + 4);
          const p2y = y + sin * (orbitR + 4);

          ctx.strokeStyle = deg % 90 === 0 ? "rgba(6, 182, 212, 0.45)" : "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = deg % 90 === 0 ? 1.5 : 0.8;
          ctx.beginPath();
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
          ctx.stroke();

          // Cardinal marks (N, E, S, W)
          if (deg % 90 === 0) {
            const label = deg === 270 ? "N" : deg === 0 ? "E" : deg === 90 ? "S" : "W";
            ctx.font = "8.5px 'Martian Mono', monospace";
            ctx.fillStyle = "rgba(6, 182, 212, 0.7)";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, x + cos * (orbitR + 14), y + sin * (orbitR + 14));
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
