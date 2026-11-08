"use client";

import { useState, useEffect } from "react";
import { Crosshair, Play, ShieldCheck, Stop, X } from "@phosphor-icons/react";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useMapInstance } from "@/components/map/map-instance";
import { useSituation } from "@/stores/situation";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  code: string;
  title: string;
  severity: "CRITICAL" | "CATASTROPHIC" | "SEVERE";
  description: string;
  targetCoords: [number, number]; // [lon, lat]
  affectedCountries: string[];
  metrics: {
    economicLossPerHour: string;
    nodesCompromised: number;
    latencySpike: string;
    criticalInfraCount: number;
  };
  stages: string[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "cable-sever",
    code: "OP-LEVIATHAN",
    title: "Transatlantic Subsea Cable Sabotage",
    severity: "CATASTROPHIC",
    description: "Simultaneous kinetic severance of MAREA, Dunant, and TAT-14 subsea fiber optic cables connecting Europe and North America.",
    targetCoords: [-30.0, 48.0],
    affectedCountries: ["US", "GB", "DE", "FR", "IE", "NL"],
    metrics: {
      economicLossPerHour: "$18.4 Billion",
      nodesCompromised: 14800,
      latencySpike: "+320ms",
      criticalInfraCount: 184,
    },
    stages: [
      "Physical telemetry drop detected on TAT-14 subsea repeater 4",
      "MAREA & Dunant high-capacity conduits severed at depth 2,400m",
      "BGP route flapping across Tier-1 carriers; transatlantic bandwidth drops 78%",
      "SWIFT international settlement systems enter failsafe fallback queues",
    ],
  },
  {
    id: "cloud-blackout",
    code: "ZERO-CLOUD",
    title: "CrowdStrike 2.0: Kernel Agent Cascade",
    severity: "CATASTROPHIC",
    description: "Widespread boot-looping kernel panic across 9.2 million mission-critical host nodes and cloud hypervisors worldwide.",
    targetCoords: [-77.0369, 38.9072],
    affectedCountries: ["US", "GB", "DE", "JP", "AU", "CA", "SG"],
    metrics: {
      economicLossPerHour: "$12.8 Billion",
      nodesCompromised: 9200000,
      latencySpike: "+180ms",
      criticalInfraCount: 640,
    },
    stages: [
      "Defective out-of-bounds pointer in cloud telemetry driver update",
      "Immediate blue-screen crash across 4,200 airline reservation gateways",
      "Hospital emergency patient records switch to manual paper protocols",
      "Global retail POS terminal payment authorization grid disabled",
    ],
  },
  {
    id: "scada-worm",
    code: "BLACKOUT-GRID",
    title: "Volt Typhoon SCADA Grid Infiltration",
    severity: "CRITICAL",
    description: "Coordinated living-off-the-land exploit chain targeting programmable logic controllers (PLCs) across electrical transmission grids.",
    targetCoords: [-95.7129, 37.0902],
    affectedCountries: ["US", "TW", "JP", "PH"],
    metrics: {
      economicLossPerHour: "$9.6 Billion",
      nodesCompromised: 4200,
      latencySpike: "+45ms",
      criticalInfraCount: 312,
    },
    stages: [
      "Firmware integrity verification bypassed on substation RTUs",
      "Protective relay tripping commands forged across 8 regional power interconnects",
      "Generator load desynchronization triggers automatic turbine shutdowns",
      "Rolling blackouts affect 42 million commercial and residential nodes",
    ],
  },
];

export function WargamesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(SCENARIOS[0]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [mitigated, setMitigated] = useState<boolean>(false);
  const map = useMapInstance((s) => s.map);

  const handleClose = () => {
    setIsSimulating(false);
    setSimStep(0);
    setMitigated(false);
    useSituation.getState().setWargameSim(null);
    soundEngine.playClick();
    onClose();
  };

  useEffect(() => {
    if (isSimulating) {
      useSituation.getState().setWargameSim({
        active: true,
        scenarioId: selectedScenario.id,
        code: selectedScenario.code,
        title: selectedScenario.title,
        coords: selectedScenario.targetCoords,
        mitigated,
        step: simStep,
      });
    } else {
      useSituation.getState().setWargameSim(null);
    }
  }, [isSimulating, selectedScenario, mitigated, simStep]);

  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setSimStep((prev) => {
        if (prev < selectedScenario.stages.length - 1) {
          soundEngine.playAlert();
          return prev + 1;
        }
        return prev;
      });
    }, 2800);

    return () => clearInterval(interval);
  }, [isSimulating, selectedScenario]);

  const handleStartSimulation = () => {
    setIsSimulating(true);
    setSimStep(0);
    setMitigated(false);
    soundEngine.playKlaxon();
    soundEngine.playAttackLaunch(selectedScenario.targetCoords[0]);

    if (map) {
      map.flyTo({
        center: selectedScenario.targetCoords,
        zoom: 3.2,
        pitch: 45,
        duration: 2500,
        essential: true,
      });
    }
  };

  const handleMitigate = () => {
    setMitigated(true);
    soundEngine.playEmpDischarge();
    soundEngine.playImpact(4);
  };

  const handleStopSimulation = () => {
    setIsSimulating(false);
    setSimStep(0);
    setMitigated(false);
    useSituation.getState().setWargameSim(null);
    soundEngine.playClick();
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wargames-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-confirmed/30 bg-confirmed/10 text-confirmed">
              <Crosshair size={20} weight="bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-confirmed">DEFCON SIMULATION ENGINE v2.6</span>
                {isSimulating && (
                  <span className="flex items-center gap-1 rounded bg-confirmed/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-confirmed">
                    <span className="size-1.5 animate-ping rounded-full bg-confirmed" />
                    LIVE CASUALTY STREAM
                  </span>
                )}
              </div>
              <h2 id="wargames-modal-title" className="font-display text-lg font-bold text-ink">WarGames: Global Cyber Disaster Simulator</h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-ink-3 transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Legal & Educational Disclaimer Banner */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-6 py-2 text-[11px] text-ink-3">
          <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono text-[9px] font-bold text-ink uppercase">Hypothetical Simulation</span>
          <span>Scenarios represent educational mathematical models for resilience planning. No actual infrastructure is targeted or altered.</span>
        </div>

        {/* Body content */}
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-12">
          {/* Scenario Selector */}
          <div className="space-y-3 md:col-span-5">
            <p className="font-mono text-[11px] uppercase tracking-wider text-ink-4">Select Threat Scenario</p>
            <div className="space-y-2">
              {SCENARIOS.map((sc) => {
                const active = selectedScenario.id === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => {
                      if (isSimulating) handleStopSimulation();
                      setSelectedScenario(sc);
                      soundEngine.playClick();
                    }}
                    className={cn(
                      "w-full rounded-xl border p-3.5 text-left transition-all",
                      active
                        ? "border-confirmed/40 bg-confirmed/10 shadow-[0_0_20px_rgba(255,74,61,0.15)]"
                        : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-ink-3">{sc.code}</span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                          sc.severity === "CATASTROPHIC" ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400",
                        )}
                      >
                        {sc.severity}
                      </span>
                    </div>
                    <div className="mt-1 font-sans text-sm font-semibold text-ink">{sc.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-ink-3">{sc.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scenario Details & Live Telemetry */}
          <div className="flex flex-col justify-between space-y-5 rounded-xl border border-white/5 bg-white/[0.015] p-5 md:col-span-7">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider text-ink-4">SIMULATION BRIEFING</span>
                <span className="font-mono text-xs text-confirmed">{selectedScenario.code}</span>
              </div>
              <h3 className="mt-1 text-base font-bold text-ink">{selectedScenario.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">{selectedScenario.description}</p>

              {/* Real-time Impact Metrics */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <div className="font-mono text-[10px] uppercase text-ink-4">Economic Drain</div>
                  <div className="mt-1 font-mono text-xs font-bold text-red-400">{selectedScenario.metrics.economicLossPerHour}</div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <div className="font-mono text-[10px] uppercase text-ink-4">Latency Surge</div>
                  <div className="mt-1 font-mono text-xs font-bold text-amber-400">{selectedScenario.metrics.latencySpike}</div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <div className="font-mono text-[10px] uppercase text-ink-4">Hosts Down</div>
                  <div className="mt-1 font-mono text-xs font-bold text-ink">{selectedScenario.metrics.nodesCompromised.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5">
                  <div className="font-mono text-[10px] uppercase text-ink-4">Critical Targets</div>
                  <div className="mt-1 font-mono text-xs font-bold text-confirmed">{selectedScenario.metrics.criticalInfraCount}</div>
                </div>
              </div>

              {/* Cascade Timeline Progression */}
              <div className="mt-5 space-y-2">
                <div className="font-mono text-[10.5px] uppercase tracking-wider text-ink-4">Cascading Contagion Sequence</div>
                <div className="space-y-2">
                  {selectedScenario.stages.map((stage, idx) => {
                    const isReached = isSimulating && simStep >= idx;
                    const isCurrent = isSimulating && simStep === idx;
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-2.5 rounded-lg border p-2 text-xs transition-all",
                          isCurrent
                            ? "border-confirmed/50 bg-confirmed/10 text-ink"
                            : isReached
                              ? "border-white/10 bg-white/[0.04] text-ink-2"
                              : "border-white/5 bg-transparent text-ink-4 opacity-50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold",
                            isCurrent ? "bg-confirmed text-space" : isReached ? "bg-white/20 text-ink" : "bg-white/5 text-ink-4",
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span className="flex-1 font-mono text-[11px] leading-tight">{stage}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-3">
              {mitigated && (
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 font-mono text-xs text-emerald-300">
                  <ShieldCheck size={18} weight="bold" />
                  <span>COUNTERMEASURE ENGAGED: Infiltration vectors arrested and routed to tactical sinkholes.</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                {!isSimulating ? (
                  <button
                    onClick={handleStartSimulation}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-confirmed py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:bg-confirmed/90 active:scale-[0.99]"
                  >
                    <Play size={16} weight="fill" />
                    INITIATE WARGAME CASCADE
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleMitigate}
                      disabled={mitigated}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl py-3 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all active:scale-[0.99]",
                        mitigated ? "bg-emerald-600/50 cursor-default" : "bg-emerald-600 hover:bg-emerald-500",
                      )}
                    >
                      <ShieldCheck size={16} weight="bold" />
                      {mitigated ? "DEFENSE ACTIVE" : "DEPLOY COUNTERMEASURE"}
                    </button>
                    <button
                      onClick={handleStopSimulation}
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-3 font-mono text-xs font-bold uppercase tracking-wider text-red-300 transition-all hover:bg-red-500/30 active:scale-[0.99]"
                    >
                      <Stop size={16} weight="fill" />
                      ABORT
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
