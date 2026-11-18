"use client";

import {
  ArrowsIn,
  ArrowsOut,
  Cube,
  Minus,
  NavigationArrow,
  Plus,
  StackSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { StatusMark } from "@/components/kit/status-mark";
import { useMapInstance } from "@/components/map/map-instance";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { soundEngine } from "@/lib/audio/sound-engine";
import { STATUS_LABEL, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/perf/use-now";
import { TIP_JAR_URL } from "@/lib/site";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSituation } from "@/stores/situation";

const LAYERS = [
  { id: "incidents", label: "Incidents" },
  { id: "countries", label: "Country shading" },
  { id: "outages", label: "Connectivity drops" },
  { id: "arcs", label: "Links between victims of the same gang" },
  { id: "cables", label: "Subsea fiber optic cables" },
  { id: "ballistics", label: "Kinetic ballistic laser tracers" },
  { id: "botnets", label: "Botnet C2 command servers" },
  { id: "grid", label: "Tactical cyber graticule" },
] as const;

/** Map layers and tactical camera navigation controls. */
export function MapControls({ generatedAt, feeds, shiftForPanel }: { generatedAt: string; feeds: Snapshot["feeds"]; shiftForPanel: boolean }) {
  const map = useMapInstance((s) => s.map);
  const layers = useSituation((s) => s.layers);
  const toggleLayer = useSituation((s) => s.toggleLayer);
  const tacticalCrt = useSituation((s) => s.tacticalCrt);
  const toggleTacticalCrt = useSituation((s) => s.toggleTacticalCrt);
  const okFeeds = Object.values(feeds).filter((feed) => feed.ok).length;
  // The popover is prerendered with the page, so its "updated" time uses the server-safe clock.
  const now = useNow(Date.parse(generatedAt));

  const [bearing, setBearing] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!map) return;
    const updateAngles = () => {
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };
    updateAngles();
    map.on("rotate", updateAngles);
    map.on("pitch", updateAngles);
    return () => {
      map.off("rotate", updateAngles);
      map.off("pitch", updateAngles);
    };
  }, [map]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const handleZoomIn = useCallback(() => {
    soundEngine.playClick();
    if (map) map.zoomIn({ duration: 250 });
  }, [map]);

  const handleZoomOut = useCallback(() => {
    soundEngine.playClick();
    if (map) map.zoomOut({ duration: 250 });
  }, [map]);

  const handleResetNorth = useCallback(() => {
    soundEngine.playClick();
    if (map) {
      map.easeTo({ bearing: 0, pitch: 0, duration: 600, essential: true });
    }
  }, [map]);

  const handleToggle3D = useCallback(() => {
    soundEngine.playClick();
    if (!map) return;
    const targetPitch = pitch > 15 ? 0 : 45;
    map.easeTo({ pitch: targetPitch, duration: 600, essential: true });
  }, [map, pitch]);

  const handleToggleFullscreen = useCallback(() => {
    soundEngine.playClick();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  return (
    <div
      className={cn(
        "pointer-events-auto z-20 flex items-center gap-1.5 transition-all duration-300 ease-out-expo",
        "fixed bottom-4 right-3 md:absolute md:bottom-auto md:top-[76px]",
        shiftForPanel ? "md:right-[480px]" : "md:right-4",
      )}
    >
      {/* Tactical Camera Controls Group */}
      <div className="glass-pill flex items-center divide-x divide-white/[0.08] rounded-full p-0.5 shadow-xl">
        <button
          type="button"
          onClick={handleZoomIn}
          className="press flex size-7 items-center justify-center rounded-l-full text-ink-2 hover:bg-white/10 hover:text-ink transition-colors"
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="press flex size-7 items-center justify-center text-ink-2 hover:bg-white/10 hover:text-ink transition-colors"
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetNorth}
          className="press flex size-7 items-center justify-center text-ink-2 hover:bg-white/10 hover:text-ink transition-colors"
          title={`Reset North (${Math.round(bearing)}°) (0)`}
          aria-label="Reset North alignment"
        >
          <NavigationArrow
            className="size-3.5 text-cyan-400 transition-transform duration-200"
            style={{ transform: `rotate(${-bearing}deg)` }}
            weight="fill"
          />
        </button>
        <button
          type="button"
          onClick={handleToggle3D}
          className={cn(
            "press flex size-7 items-center justify-center rounded-r-full transition-colors",
            pitch > 15 ? "bg-cyan-500/25 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]" : "text-ink-2 hover:bg-white/10 hover:text-ink",
          )}
          title={pitch > 15 ? "Switch to 2D Nadir View (3)" : "Switch to 3D Tactical Pitch (3)"}
          aria-label="Toggle 3D View"
        >
          <Cube className="size-3.5" weight={pitch > 15 ? "fill" : "regular"} />
        </button>
      </div>

      {/* Fullscreen Toggle (Hidden on touch mobile where browser handles viewport) */}
      <button
        type="button"
        onClick={handleToggleFullscreen}
        className="press glass-pill hidden sm:flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white/10 hover:text-ink transition-colors shadow-xl"
        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        aria-label="Toggle Fullscreen Mode"
      >
        {isFullscreen ? <ArrowsIn className="size-3.5" /> : <ArrowsOut className="size-3.5" />}
      </button>

      {/* Layers & Key Popover */}
      <Popover>
        <PopoverTrigger
          className="glass-pill press flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink shadow-xl"
          aria-label="Map layers and key"
        >
          <StackSimple className="size-3.5" /> <span className="hidden xs:inline">Layers</span>
        </PopoverTrigger>
        <PopoverContent
          side={isMobile ? "top" : "bottom"}
          align="end"
          sideOffset={8}
          className="w-72 max-h-[min(500px,80vh)] overflow-y-auto rounded-[16px] border-0 bg-surface p-1.5 ring-1 ring-hairline-2 shadow-xl"
        >
          <p className="px-2.5 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">Layers</p>
          {LAYERS.map((layer) => (
            <label
              key={layer.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-[13px] text-ink transition-colors hover:bg-white/[0.04]"
            >
              {layer.label}
              <input type="checkbox" className="size-4 accent-ink" checked={layers[layer.id]} onChange={() => toggleLayer(layer.id)} />
            </label>
          ))}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-[13px] text-cyan-300 transition-colors hover:bg-white/[0.04]">
            <span>Tactical CRT HUD filter</span>
            <input type="checkbox" className="size-4 accent-cyan-400" checked={tacticalCrt} onChange={toggleTacticalCrt} />
          </label>
          <p className="mt-1 border-t border-white/[0.06] px-2.5 pb-1 pt-2.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-4">Key</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 px-2.5 pb-2 pt-1 text-[12.5px] text-ink-2">
            {(["confirmed", "reported", "claimed"] as const).map((status) => (
              <span key={status} className="flex items-center gap-2">
                <StatusMark status={status} size={9} />
                {STATUS_LABEL[status]}
              </span>
            ))}
            <span className="flex items-center gap-2">
              <span className="size-[9px] rounded-full ring-[1.5px] ring-outage" />
              Connectivity drop
            </span>
            <span className="flex items-center gap-2">
              <span className="size-[9px] rounded-full bg-fuchsia-500 ring-[1.5px] ring-fuchsia-400" />
              Botnet C2 beacon
            </span>
          </div>
          <p suppressHydrationWarning className="border-t border-white/[0.06] px-2.5 pb-1.5 pt-2.5 text-[12px] leading-relaxed text-ink-4">
            Updated {relativeTime(generatedAt, now)} from {okFeeds} of {Object.keys(feeds).length} live sources.
          </p>
          <div className="flex items-center justify-between border-t border-white/[0.06] px-2.5 py-1.5 text-[11px] text-ink-4">
            <Link href="/terms" className="transition-colors hover:text-ink">Terms & Safe Harbor</Link>
            <Link href="/privacy" className="transition-colors hover:text-ink">Privacy</Link>
            <a href={TIP_JAR_URL} target="_blank" rel="noreferrer" className="text-amber-400 font-medium transition-colors hover:text-amber-300">Tip Jar</a>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
