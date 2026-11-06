"use client";

import { CaretDown, CaretUp, Terminal } from "@phosphor-icons/react";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useCombatFeed } from "@/stores/combat-feed";
import { cn } from "@/lib/utils";

export function CombatFeedDrawer({
  shiftUp = false,
  shiftLeft = false,
}: {
  shiftUp?: boolean;
  shiftLeft?: boolean;
} = {}) {
  const { intercepts, totalIntercepted, attacksPerSec, isOpen, toggleOpen } = useCombatFeed();

  return (
    <div
      className={cn(
        "pointer-events-auto fixed z-30 hidden flex-col items-end transition-all duration-300 ease-out md:flex",
        shiftUp ? "bottom-[195px]" : "bottom-3",
        shiftLeft ? "right-[475px]" : "right-3",
      )}
    >
      {/* Minimized Pill Toggle */}
      {!isOpen && (
        <button
          onClick={() => {
            soundEngine.playClick();
            toggleOpen();
          }}
          className="press glass-pill flex h-8 items-center gap-2 rounded-full border border-white/10 bg-surface/90 px-3 font-mono text-[11px] text-ink-2 shadow-xl backdrop-blur transition-colors hover:border-cyan-500/40 hover:text-ink"
        >
          <span className="relative flex size-2 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/60" />
            <span className="size-1.5 rounded-full bg-cyan-400" />
          </span>
          <span className="font-bold text-cyan-300">COMBAT TELEMETRY</span>
          <span className="text-ink-4">|</span>
          <span className="text-ink-3">{attacksPerSec} ATK/S</span>
          <CaretUp size={12} className="text-ink-4" />
        </button>
      )}

      {/* Expanded Tactical Terminal */}
      {isOpen && (
        <div className="flex w-[460px] flex-col overflow-hidden rounded-xl border border-white/10 bg-surface/95 shadow-[0_8px_32px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all">
          {/* Terminal Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-surface-2/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/60" />
                <span className="size-1.5 rounded-full bg-cyan-400" />
              </span>
              <Terminal size={14} className="text-cyan-400" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
                Live Combat Intercept Feed
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] tabular text-ink-3">
                <span className="text-cyan-400 font-bold">{attacksPerSec}</span> ATK/S
              </span>
              <span className="font-mono text-[10px] tabular text-ink-4">
                {totalIntercepted.toLocaleString()} TOTAL
              </span>
              <button
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

          {/* Intercepts List */}
          <div className="h-44 overflow-y-auto p-1.5 font-mono text-[10.5px] leading-tight scrollbar-thin">
            {intercepts.length === 0 ? (
              <div className="flex h-full items-center justify-center text-ink-4">
                Initializing satellite packet sniffer...
              </div>
            ) : (
              <div className="space-y-1">
                {intercepts.slice(0, 15).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded bg-white/[0.02] px-2 py-1 transition-colors hover:bg-white/[0.05]"
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
