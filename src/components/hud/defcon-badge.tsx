"use client";

import { Siren } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { soundEngine } from "@/lib/audio/sound-engine";

export function DefconBadge() {
  return (
    <Popover>
      <PopoverTrigger
        onClick={() => soundEngine.playClick()}
        className="press glass-pill hidden h-7 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-mono tracking-wider transition-colors hover:bg-confirmed/15 hover:text-red-300 sm:flex"
        title="Global Cyber Readiness Posture"
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-confirmed opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-confirmed" />
        </span>
        <span className="font-bold text-confirmed">DEFCON 2</span>
        <span className="hidden 2xl:inline text-ink-4">| ESCALATED</span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="w-80 rounded-[16px] border-0 bg-surface p-3.5 ring-1 ring-hairline-2 shadow-2xl font-mono text-[12px] text-ink"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-2">
            <Siren size={16} className="text-confirmed animate-pulse" />
            <span className="font-bold text-ink">CYBER DEFCON 2</span>
          </div>
          <span className="rounded bg-confirmed/20 px-1.5 py-0.5 text-[10px] font-bold text-confirmed">
            ACTIVE SEVERE
          </span>
        </div>

        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3 font-sans">
          Worldwide adversary kinetic operations, state-sponsored APT intrusions, and weaponized zero-days are actively tracked.
        </p>

        <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2.5 text-[11px]">
          <div className="flex items-center justify-between text-ink-3">
            <span>C2 Ballistic Tracers:</span>
            <span className="font-bold text-confirmed">LIVE INTERCEPTION</span>
          </div>
          <div className="flex items-center justify-between text-ink-3">
            <span>Subsea Fiber Infrastructure:</span>
            <span className="font-bold text-cyan-400">MONITORED</span>
          </div>
          <div className="flex items-center justify-between text-ink-3">
            <span>Dark Web Leak Feeds:</span>
            <span className="font-bold text-ink">ACTIVE POLLING</span>
          </div>
        </div>

        <div className="mt-3 rounded-lg bg-surface-2 p-2 text-[10.5px] text-ink-4 leading-normal font-sans">
          *DEFCON posture updates based on CISA KEV publication velocity and global outage severity.
        </div>
      </PopoverContent>
    </Popover>
  );
}
