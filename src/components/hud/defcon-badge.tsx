"use client";

import { Siren } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { soundEngine } from "@/lib/audio/sound-engine";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PostureStats = Pick<Snapshot["stats"], "incidents24h" | "kevAdded30d" | "criticalCves72h" | "outagesActive">;

function computeCyberPosture(stats?: PostureStats) {
  if (!stats) {
    return {
      pillLabel: "POSTURE",
      tag: "MONITOR",
      title: "CYBER TELEMETRY MONITOR",
      statusBadge: "FEED ACTIVE",
      tone: "text-cyan-400",
      dotBg: "bg-cyan-400",
      badgeBg: "bg-cyan-500/20 text-cyan-300",
      hoverClass: "hover:bg-cyan-500/15 hover:text-cyan-200",
      summary: "Open the Situation Map for live readiness calculations from active incidents, CISA KEV additions, and network outages.",
    };
  }

  const score =
    stats.outagesActive * 2 +
    (stats.kevAdded30d >= 8 ? 2 : stats.kevAdded30d >= 3 ? 1 : 0) +
    (stats.criticalCves72h >= 4 ? 2 : stats.criticalCves72h >= 1 ? 1 : 0) +
    (stats.incidents24h >= 6 ? 1 : 0);

  if (score >= 5) {
    return {
      pillLabel: "DEFCON 2",
      tag: "ESCALATED",
      title: "CYBER DEFCON 2",
      statusBadge: "ACTIVE SEVERE",
      tone: "text-confirmed",
      dotBg: "bg-confirmed",
      badgeBg: "bg-confirmed/20 text-confirmed",
      hoverClass: "hover:bg-confirmed/15 hover:text-red-300",
      summary: "Elevated global cyber incident velocity, active network disruptions, and weaponized KEV disclosures in the current snapshot.",
    };
  }

  if (score >= 3) {
    return {
      pillLabel: "DEFCON 3",
      tag: "ELEVATED",
      title: "CYBER DEFCON 3",
      statusBadge: "HEIGHTENED",
      tone: "text-reported",
      dotBg: "bg-reported",
      badgeBg: "bg-amber-500/20 text-amber-300",
      hoverClass: "hover:bg-amber-500/15 hover:text-amber-200",
      summary: "Moderate incident velocity and exploited vulnerability disclosures tracked in the active telemetry snapshot.",
    };
  }

  return {
    pillLabel: "DEFCON 4",
    tag: "GUARDED",
    title: "CYBER DEFCON 4",
    statusBadge: "NOMINAL",
    tone: "text-cyan-400",
    dotBg: "bg-cyan-400",
    badgeBg: "bg-cyan-500/20 text-cyan-300",
    hoverClass: "hover:bg-cyan-500/15 hover:text-cyan-200",
    summary: "Baseline threat feed polling active across sourced disclosures, CISA KEV advisories, and subsea telemetry.",
  };
}

export function DefconBadge({ stats }: { stats?: PostureStats }) {
  const posture = computeCyberPosture(stats);

  return (
    <Popover>
      <PopoverTrigger
        onClick={() => soundEngine.playClick()}
        className={cn(
          "press glass-pill hidden h-7 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-mono tracking-wider transition-colors sm:flex",
          posture.hoverClass,
        )}
        title="Global Cyber Readiness Posture"
      >
        <span className="relative flex size-2">
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping", posture.dotBg)} />
          <span className={cn("relative inline-flex size-2 rounded-full", posture.dotBg)} />
        </span>
        <span className={cn("font-bold", posture.tone)}>{posture.pillLabel}</span>
        <span className="hidden 2xl:inline text-ink-4">| {posture.tag}</span>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] rounded-[16px] border-0 bg-surface p-3.5 ring-1 ring-hairline-2 shadow-2xl font-mono text-[12px] text-ink"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
          <div className="flex items-center gap-2">
            <Siren size={16} className={cn(posture.tone, "motion-safe:animate-pulse")} />
            <span className="font-bold text-ink">{posture.title}</span>
          </div>
          <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", posture.badgeBg)}>{posture.statusBadge}</span>
        </div>

        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-3 font-sans">{posture.summary}</p>

        {stats ? (
          <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2.5 text-[11px]">
            <div className="flex items-center justify-between text-ink-3">
              <span>Incidents (24h window):</span>
              <span className="font-bold text-ink">{stats.incidents24h}</span>
            </div>
            <div className="flex items-center justify-between text-ink-3">
              <span>CISA KEV Added (30d):</span>
              <span className="font-bold text-confirmed">{stats.kevAdded30d}</span>
            </div>
            <div className="flex items-center justify-between text-ink-3">
              <span>Critical CVEs (72h):</span>
              <span className="font-bold text-cyan-400">{stats.criticalCves72h}</span>
            </div>
            <div className="flex items-center justify-between text-ink-3">
              <span>Active Outages Tracked:</span>
              <span className="font-bold text-ink">{stats.outagesActive}</span>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-2.5 text-[11px]">
            <div className="flex items-center justify-between text-ink-3">
              <span>Threat Feeds:</span>
              <span className="font-bold text-cyan-400">ONLINE</span>
            </div>
            <div className="flex items-center justify-between text-ink-3">
              <span>CVE / KEV Index:</span>
              <span className="font-bold text-ink">CACHED SNAPSHOT</span>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg bg-surface-2 p-2 text-[10.5px] text-ink-4 leading-normal font-sans">
          *Readiness tier is computed deterministically from current snapshot 24h incidents, 30d CISA KEV additions, 72h critical CVEs, and active outage feeds.
        </div>
      </PopoverContent>
    </Popover>
  );
}
