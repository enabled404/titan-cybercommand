"use client";

import { useState } from "react";
import { CaretDown, CaretUp, Crosshair } from "@phosphor-icons/react";

import { generateIncidentKillChain } from "@/lib/kill-chain";
import type { Incident } from "@/lib/types";
import { cn } from "@/lib/utils";

export function KillChainTimeline({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(true);
  const steps = generateIncidentKillChain(incident);

  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-surface-2">
      {/* Header bar */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Crosshair size={16} className="text-cyan-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink">
            ATTACK KILL CHAIN TIMELINE
          </span>
          <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-cyan-300">
            4 PHASES
          </span>
        </div>
        <div className="flex items-center gap-2 text-ink-4">
          <span className="text-[11px] font-mono">{expanded ? "COLLAPSE" : "EXPAND"}</span>
          {expanded ? <CaretUp size={13} /> : <CaretDown size={13} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/[0.06] p-4 space-y-4">
          <p className="text-[12px] leading-snug text-ink-3">
            Reconstructed attack execution progression mapped to Lockheed Martin &amp; MITRE ATT&amp;CK frameworks:
          </p>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-400 before:via-purple-400 before:to-red-400">
            {steps.map((step) => {
              const statusColor =
                step.status === "CONFIRMED" || step.status === "EXFILTRATED"
                  ? "bg-red-500/15 text-red-300 border-red-500/30"
                  : step.status === "CONTAINED"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";

              return (
                <div key={step.phase} className="relative group">
                  {/* Step node dot on vertical timeline */}
                  <div className="absolute -left-[22px] top-1 size-3 rounded-full border-2 border-space bg-cyan-400 group-last:bg-red-500" />

                  <div className="rounded-xl border border-white/5 bg-space/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-ink-4">
                          PHASE 0{step.phase}
                        </span>
                        <h4 className="font-semibold text-xs text-ink">{step.phaseName}</h4>
                      </div>

                      <span className={cn("rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold", statusColor)}>
                        {step.status}
                      </span>
                    </div>

                    {/* MITRE and IoC badges */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-cyan-300">
                        {step.mitreId}: {step.mitreName}
                      </span>
                      <span className="font-mono text-[9.5px] text-ink-4">
                        {step.timestamp}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-2">
                      {step.detail}
                    </p>

                    {/* Technical IoC block */}
                    <div className="mt-2 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-cyan-300/90 truncate border border-white/[0.04]">
                      <span className="text-ink-4 mr-1">IoC:</span> {step.technicalIoC}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
