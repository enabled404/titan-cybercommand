"use client";

import { CaretDown, CaretUp, Funnel, Terminal } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useCombatFeed } from "@/stores/combat-feed";
import { useMapInstance } from "@/components/map/map-instance";
import { useSituation } from "@/stores/situation";
import type { Incident } from "@/lib/types";
import { cn } from "@/lib/utils";

type FeedFilter = "all" | "critical" | "exploits" | "c2";

export function CombatFeedDrawer({
  incidents = [],
  shiftUp = false,
  shiftLeft = false,
}: {
  incidents?: Incident[];
  shiftUp?: boolean;
  shiftLeft?: boolean;
} = {}) {
  const { intercepts, totalIntercepted, isOpen, toggleOpen } = useCombatFeed();
  const map = useMapInstance((s) => s.map);
  const select = useSituation((s) => s.select);
  const totalMonitored = totalIntercepted > 0 ? totalIntercepted : incidents.length;
  const [filter, setFilter] = useState<FeedFilter>("all");

  const displayedIntercepts = useMemo(() => {
    if (filter === "critical") return intercepts.filter((i) => i.severity >= 4);
    if (filter === "exploits") return intercepts.filter((i) => i.vector.toLowerCase().includes("exploit") || i.vector.toLowerCase().includes("cve"));
    if (filter === "c2") return intercepts.filter((i) => i.vector.toLowerCase().includes("c2"));
    return intercepts;
  }, [intercepts, filter]);

  return (
    <div
      className={cn(
        "pointer-events-auto fixed z-30 hidden flex-col items-end md:flex",
        shiftUp ? "bottom-[236px]" : "bottom-14",
        shiftLeft ? "md:hidden xl:flex xl:right-[475px]" : "right-3",
      )}
    >
      {/* Minimized Pill Toggle */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick();
            toggleOpen();
          }}
          className="press glass-pill flex h-8 items-center gap-2 rounded-full border border-white/10 bg-surface/90 px-3 font-mono text-[11px] text-ink-2 shadow-xl backdrop-blur transition-colors hover:border-cyan-500/40 hover:text-ink"
        >
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-cyan-400/60 motion-safe:animate-ping" />
            <span className="size-1.5 rounded-full bg-cyan-400" />
          </span>
          <span className="font-bold text-cyan-300">COMBAT TELEMETRY</span>
          <span className="text-ink-4">|</span>
          <span className="text-ink-3">{intercepts.length} ACTIVE</span>
          <CaretUp size={12} className="text-ink-4" />
        </button>
      )}

      {/* Expanded Tactical Terminal */}
      {isOpen && (
        <div className="flex w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/95 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all">
          {/* Terminal Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-surface-2/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2 items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-cyan-400/60 motion-safe:animate-ping" />
                <span className="size-1.5 rounded-full bg-cyan-400" />
              </span>
              <Terminal size={14} className="text-cyan-400" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                Live Combat Intercept Feed
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] tabular text-ink-3">
                <span className="text-cyan-400 font-bold">{intercepts.length}</span> ACTIVE CORRIDORS
              </span>
              <span className="font-mono text-[10px] tabular text-ink-4">
                {totalMonitored.toLocaleString()} MONITORED
              </span>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  toggleOpen();
                }}
                className="text-ink-4 transition-colors hover:text-ink"
                title="Collapse combat feed"
                aria-label="Collapse combat feed"
              >
                <CaretDown size={14} />
              </button>
            </div>
          </div>

          {/* Tactical Filter Segment */}
          <div className="flex items-center gap-1 border-b border-white/[0.06] bg-surface/80 px-2 py-1 font-mono text-[9.5px]">
            <Funnel size={10} className="text-ink-4 mr-0.5" />
            {(["all", "critical", "exploits", "c2"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setFilter(mode);
                }}
                className={cn(
                  "rounded px-1.5 py-0.5 font-bold uppercase tracking-wider transition-colors",
                  filter === mode ? "bg-cyan-500/20 text-cyan-300" : "text-ink-4 hover:text-ink-2",
                )}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Intercepts List */}
          <div className="h-44 overflow-y-auto overscroll-contain p-1.5 font-mono text-[10.5px] leading-tight scrollbar-thin">
            {displayedIntercepts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-ink-4">
                No telemetry matching current filter
              </div>
            ) : (
              <div className="space-y-1">
                {displayedIntercepts.slice(0, 15).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      soundEngine.playClick();
                      const targetIncident =
                        (item.incidentId && incidents.find((i) => i.id === item.incidentId)) ||
                        incidents.find((i) => {
                          const cleanTarget = item.target.replace(/\s*\([^)]*\)\s*/g, "").trim().toLowerCase();
                          return (
                            i.victim.toLowerCase() === cleanTarget ||
                            i.victim.toLowerCase().includes(cleanTarget) ||
                            cleanTarget.includes(i.victim.toLowerCase())
                          );
                        });
                      if (targetIncident) {
                        select(targetIncident.id);
                        if (map) {
                          map.flyTo({
                            center: [targetIncident.lon, targetIncident.lat],
                            zoom: 4.8,
                            pitch: 45,
                            duration: 2200,
                            essential: true,
                          });
                        }
                      } else if (item.targetCoords && map) {
                        map.flyTo({
                          center: item.targetCoords,
                          zoom: 4.8,
                          pitch: 45,
                          duration: 2200,
                          essential: true,
                        });
                      }
                    }}
                    title="Click to track verified incident on globe"
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded bg-white/[0.02] px-2 py-1 text-left transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-ink-4 shrink-0">{item.timestamp}</span>
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate font-semibold text-ink-2">
                        {item.origin.split(" / ")[0]}
                      </span>
                      <span className="text-ink-4">→</span>
                      <span className="truncate text-ink font-bold">
                        {item.target}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.verificationStatus && (
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider",
                            item.verificationStatus === "confirmed" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                            item.verificationStatus === "reported" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                            item.verificationStatus === "claimed" && "bg-white/[0.08] text-slate-300 border border-white/20",
                          )}
                        >
                          {item.verificationStatus}
                        </span>
                      )}

                      <span
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: `${item.color}20`,
                          color: item.color,
                          border: `1px solid ${item.color}40`,
                        }}
                      >
                        {item.vector}
                      </span>

                      <span
                        className={cn(
                          "rounded px-1 py-0.5 text-[8.5px] font-bold tracking-wider",
                          item.status === "INTERCEPTED" && "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
                          item.status === "SINKHOLED" && "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
                          item.status === "CONTAINED" && "bg-amber-500/15 text-amber-400 border border-amber-500/30",
                          item.status === "ENGAGED" && "bg-red-500/15 text-red-400 border border-red-500/30",
                        )}
                      >
                        {item.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
