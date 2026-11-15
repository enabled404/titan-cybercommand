"use client";

import { OrgLogo } from "@/components/kit/org-logo";
import { StatusMark } from "@/components/kit/status-mark";
import { countryName } from "@/lib/countries";
import { STATUS_LABEL, placeLabel, relativeTime } from "@/lib/format";
import type { Incident } from "@/lib/types";

export function HoverCard({ incident, x, y }: { incident: Incident; x: number; y: number }) {
  const flip = typeof window !== "undefined" && x > window.innerWidth - 340;
  return (
    <div
      className="pointer-events-none absolute z-40 w-[300px] rounded-[16px] bg-surface p-3.5 ring-1 ring-hairline-2 shadow-2xl backdrop-blur motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
      style={{ left: flip ? x - 316 : x + 18, top: Math.max(72, y - 28) }}
    >
      <div className="flex items-center gap-2.5">
        <OrgLogo name={incident.victim} domain={incident.domain} size={32} className="rounded-[9px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semicondensed text-[15px] font-semibold text-ink">{incident.victim}</p>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-3">
            <StatusMark status={incident.status} size={8} />
            {STATUS_LABEL[incident.status]} · {relativeTime(incident.date)}
          </p>
        </div>
      </div>

      {/* Threat Intel Provenance Chips */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1 font-mono text-[9.5px]">
        {incident.actor && (
          <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-bold text-rose-400 border border-rose-500/30">
            {incident.actor.toUpperCase()}
          </span>
        )}
        {incident.cves.length > 0 && (
          <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 font-bold text-fuchsia-300 border border-fuchsia-500/30">
            {incident.cves[0]}
          </span>
        )}
        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-ink-3">
          {incident.type.replace("_", " ").toUpperCase()}
        </span>
        {incident.sources?.[0]?.publisher && (
          <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
            {incident.sources[0].publisher}
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-[12.5px] leading-snug text-ink-2">{incident.title}</p>
      <p className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11.5px] text-ink-4">
        <span className="truncate">{placeLabel(incident, countryName)}</span>
        <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-cyan-400/80">Click for dossier</span>
      </p>
    </div>
  );
}
