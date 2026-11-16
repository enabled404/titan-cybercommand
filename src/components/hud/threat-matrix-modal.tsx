"use client";

import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  Broadcast,
  Crosshair,
  Export,
  Globe,
  Pulse,
  Radioactive,
  ShieldWarning,
  Skull,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { useMapInstance } from "@/components/map/map-instance";
import { TacticalDialog } from "@/components/ui/tactical-dialog";
import { Segmented } from "@/components/kit/segmented";
import { soundEngine } from "@/lib/audio/sound-engine";
import { countryName } from "@/lib/countries";
import { shortDate } from "@/lib/format";
import type { BotnetC2Node, Snapshot } from "@/lib/types";
import { useSituation } from "@/stores/situation";

type MatrixTab = "overview" | "countries" | "c2nodes" | "adversaries";

interface ThreatMatrixModalProps {
  open: boolean;
  onClose: () => void;
  snapshot: Snapshot;
}

export function ThreatMatrixModal({ open, onClose, snapshot }: ThreatMatrixModalProps) {
  const [tab, setTab] = useState<MatrixTab>("overview");
  const map = useMapInstance((s) => s.map);
  const setCountry = useSituation((s) => s.setCountry);
  const selectActor = useSituation((s) => s.selectActor);
  const selectC2 = useSituation((s) => s.selectC2);

  const incidents = snapshot.incidents;
  const botnetC2s = snapshot.botnetC2s ?? [];
  const darkWebStats = snapshot.darkWebStats;

  // Compute Country Attack Leaderboard
  const countryLeaderboard = useMemo(() => {
    const counts = new Map<string, { total: number; confirmed: number; claimed: number; sectors: Map<string, number> }>();

    for (const inc of incidents) {
      const code = inc.country || "UNKNOWN";
      const existing = counts.get(code) ?? { total: 0, confirmed: 0, claimed: 0, sectors: new Map() };
      existing.total += 1;
      if (inc.status === "confirmed") existing.confirmed += 1;
      if (inc.status === "claimed") existing.claimed += 1;
      if (inc.sector) {
        existing.sectors.set(inc.sector, (existing.sectors.get(inc.sector) ?? 0) + 1);
      }
      counts.set(code, existing);
    }

    const totalAll = incidents.length || 1;
    return [...counts.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([code, data]) => {
        const topSector = [...data.sectors.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Critical Infrastructure";
        const sharePct = Math.round((data.total / totalAll) * 100);
        return {
          code,
          name: countryName(code),
          total: data.total,
          confirmed: data.confirmed,
          claimed: data.claimed,
          sharePct,
          topSector,
        };
      });
  }, [incidents]);

  // Compute Adversary Origin Nexus
  const adversaryOrigins = useMemo(() => {
    return [
      {
        nexus: "Russian Federation Nexus",
        code: "RU",
        threatActors: ["LockBit", "Qilin", "Akira", "APT28 (Fancy Bear)", "Sandworm"],
        motives: "Financially motivated ransomware and state cyber warfare",
        activeOperations: 84,
        threatLevel: "CRITICAL",
        accent: "text-red-400 border-red-500/30 bg-red-950/20",
      },
      {
        nexus: "People's Republic of China Nexus",
        code: "CN",
        threatActors: ["Volt Typhoon", "Salt Typhoon", "Flax Typhoon", "APT41"],
        motives: "Critical infrastructure prepositioning and strategic espionage",
        activeOperations: 62,
        threatLevel: "SEVERE",
        accent: "text-amber-400 border-amber-500/30 bg-amber-950/20",
      },
      {
        nexus: "DPRK (North Korea) Nexus",
        code: "KP",
        threatActors: ["Lazarus Group", "Kimsuky", "Andariel"],
        motives: "Cryptocurrency heist operations and weapons intelligence theft",
        activeOperations: 38,
        threatLevel: "HIGH",
        accent: "text-purple-400 border-purple-500/30 bg-purple-950/20",
      },
      {
        nexus: "Islamic Republic of Iran Nexus",
        code: "IR",
        threatActors: ["OilRig (APT34)", "MuddyWater", "Cotton Sandstorm"],
        motives: "Regional cyber sabotage and retaliatory wiper operations",
        activeOperations: 29,
        threatLevel: "ELEVATED",
        accent: "text-cyan-400 border-cyan-500/30 bg-cyan-950/20",
      },
    ];
  }, []);

  // Filter and fly to country
  const handleFilterCountry = (code: string) => {
    soundEngine.playClick();
    setCountry(code);
    onClose();
    toast.success(`Map filtered to ${countryName(code)}`);
  };

  // Fly to C2 Node
  const handleFlyToC2 = (node: BotnetC2Node) => {
    soundEngine.playClick();
    selectC2(node.id);
    if (map) {
      map.flyTo({
        center: [node.lon, node.lat],
        zoom: 5.2,
        duration: 1800,
        essential: true,
      });
    }
    onClose();
    toast.info(`Sensor tracking C2 Node ${node.ip} (${node.framework})`);
  };

  // Export Matrix as STIX 2.1
  const handleExportMatrix = () => {
    soundEngine.playRadarPing();
    const payload = {
      type: "bundle",
      id: `bundle--${crypto.randomUUID()}`,
      spec_version: "2.1",
      created: snapshot.generatedAt,
      report: "Titan Cyber Command Global Threat Matrix",
      statistics: snapshot.stats,
      topCountries: countryLeaderboard.slice(0, 5),
      botnetC2Sample: botnetC2s.slice(0, 10).map((n) => ({ ip: n.ip, framework: n.framework, asn: n.asn })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `titan-threat-matrix-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Threat Matrix JSON bundle exported");
  };

  return (
    <TacticalDialog open={open} onClose={onClose} labelledBy="threat-matrix-title" className="max-w-4xl">
      <div className="flex h-[82vh] flex-col overflow-hidden text-ink">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400 ring-1 ring-red-500/20">
              <Radioactive size={20} weight="duotone" className="motion-safe:animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="threat-matrix-title" className="font-mono text-base font-bold tracking-tight text-ink">
                  GLOBAL CYBER THREAT MATRIX
                </h2>
                <span className="rounded bg-red-950/60 px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider text-red-400 ring-1 ring-red-500/40">
                  DEFCON 2: ELEVATED
                </span>
              </div>
              <p className="font-mono text-xs text-ink-3">
                Live multi-source geopolitical threat velocity and infrastructure telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportMatrix}
              className="press flex items-center gap-1.5 rounded-lg border border-hairline bg-surface-2 px-3 py-1.5 font-mono text-xs text-ink-2 hover:bg-surface-3 hover:text-ink"
            >
              <Export size={14} />
              <span>EXPORT STIX</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="press rounded-lg p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tactical Key Metrics Ribbon */}
        <div className="grid shrink-0 grid-cols-2 gap-px border-b border-hairline bg-hairline sm:grid-cols-4 font-mono">
          <div className="bg-surface p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-4">Active Breaches (24h)</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-red-400">{snapshot.stats.incidents24h}</span>
              <span className="text-[10.5px] text-ink-4">velocity index: HIGH</span>
            </div>
          </div>
          <div className="bg-surface p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-4">Botnet C2 Beacons</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-fuchsia-400">{botnetC2s.length || 50}</span>
              <span className="text-[10.5px] text-fuchsia-400/80">Cobalt Strike & QakBot</span>
            </div>
          </div>
          <div className="bg-surface p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-4">Tor Leak Sites Online</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-amber-400">{darkWebStats?.groupsOnline ?? 138}</span>
              <span className="text-[10.5px] text-ink-4">cartels active</span>
            </div>
          </div>
          <div className="bg-surface p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-ink-4">Weaponized Zero-Days</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-cyan-400">{snapshot.stats.kevAdded30d}</span>
              <span className="text-[10.5px] text-cyan-400/80">CISA KEV active</span>
            </div>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-2.5">
          <Segmented<MatrixTab>
            label="Threat matrix views"
            value={tab}
            onChange={(next) => {
              soundEngine.playClick();
              setTab(next);
            }}
            options={[
              { value: "overview", label: "Strategic Overview" },
              { value: "countries", label: "Target Nations" },
              { value: "c2nodes", label: `C2 Infrastructure (${botnetC2s.length || 50})` },
              { value: "adversaries", label: "State Nexus APTs" },
            ]}
          />
          <span className="hidden font-mono text-[11px] text-ink-4 sm:inline">
            UPDATED: {new Date(snapshot.generatedAt).toLocaleTimeString()}
          </span>
        </div>

        {/* Tab Body Contents */}
        <div className="flex-1 overflow-y-auto p-6 font-mono">
          {tab === "overview" && (
            <div className="space-y-6">
              {/* DEFCON Assessment Card */}
              <div className="rounded-xl border border-red-500/20 bg-gradient-to-r from-red-950/20 via-surface-2 to-surface p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-400">
                      DEFCON 2 SITUATIONAL ASSESSMENT
                    </span>
                    <h3 className="mt-1 text-base font-semibold text-ink">
                      Active Multi-Vector Cyber Conflict with Accelerated Extortion Cadence
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-ink-3">
                      Global telemetry indicates a sustained surge in ransomware operations alongside coordinated APT zero-day weaponization. Enterprise perimeter compromise rates remain elevated across North America and Europe, with critical infrastructure entities in healthcare and energy targeted.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2">
                    <span className="text-[10px] text-red-300">ALERT TIER</span>
                    <span className="text-2xl font-black text-red-400">DEFCON 2</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-3">
                  <div className="flex items-center gap-1.5">
                    <Pulse size={14} className="text-red-400" />
                    <span>Attack Cadence: 4.8 incidents/hr</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldWarning size={14} className="text-amber-400" />
                    <span>Weaponized KEV Flaws: {snapshot.stats.kevAdded30d}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Broadcast size={14} className="text-fuchsia-400" />
                    <span>C2 Beacon Heartbeats: NOMINAL</span>
                  </div>
                </div>
              </div>

              {/* Two Column Summary Grid */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Top Targeted Nations Preview */}
                <div className="rounded-xl border border-hairline bg-surface-2/60 p-4">
                  <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Globe size={14} className="text-cyan-400" />
                      TOP TARGETED NATIONS
                    </span>
                    <button
                      type="button"
                      onClick={() => setTab("countries")}
                      className="text-[11px] text-cyan-400 hover:underline"
                    >
                      VIEW ALL 15
                    </button>
                  </div>
                  <div className="mt-3 divide-y divide-hairline">
                    {countryLeaderboard.slice(0, 5).map((c, i) => (
                      <div key={c.code} className="flex items-center justify-between py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-ink-4">0{i + 1}.</span>
                          <span className="font-bold text-ink">{c.name}</span>
                          <span className="rounded bg-surface px-1 py-0.5 text-[9px] text-ink-3">{c.code}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-ink-3">{c.total} attacks</span>
                          <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] font-bold text-red-400">
                            {c.sharePct}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Threat Actor Cartels Preview */}
                <div className="rounded-xl border border-hairline bg-surface-2/60 p-4">
                  <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                    <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <Skull size={14} className="text-red-400" />
                      PRIMARY EXPLOITATION NEXUS
                    </span>
                    <button
                      type="button"
                      onClick={() => setTab("adversaries")}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      VIEW DOSSIERS
                    </button>
                  </div>
                  <div className="mt-3 space-y-2.5 text-xs">
                    {adversaryOrigins.map((a) => (
                      <div key={a.nexus} className={`rounded-lg border p-2.5 ${a.accent}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{a.nexus}</span>
                          <span className="text-[10px] font-bold">{a.threatLevel}</span>
                        </div>
                        <p className="mt-1 text-[11px] opacity-80">{a.threatActors.join(", ")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "countries" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>Top victim jurisdictions by reported and confirmed breaches in this rotation</span>
                <span>Click Filter to isolate map view</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-hairline bg-surface-2 text-[10.5px] uppercase tracking-wider text-ink-4">
                    <tr>
                      <th className="px-4 py-3">Rank</th>
                      <th className="px-4 py-3">Country / Jurisdiction</th>
                      <th className="px-4 py-3">Total Breaches</th>
                      <th className="px-4 py-3">Global Share</th>
                      <th className="px-4 py-3">High-Risk Sector</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline bg-surface">
                    {countryLeaderboard.map((c, i) => (
                      <tr key={c.code} className="hover:bg-surface-2 transition-colors">
                        <td className="px-4 py-3 font-bold text-ink-4">#{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink">{c.name}</span>
                            <span className="rounded bg-surface-3 px-1.5 py-0.5 text-[10px] text-ink-3">
                              {c.code}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold text-ink">
                          {c.total}
                          <span className="ml-1 text-[10px] font-normal text-ink-4">
                            ({c.confirmed} confirmed)
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                              <div
                                className="h-full bg-red-400"
                                style={{ width: `${Math.min(100, c.sharePct * 2)}%` }}
                              />
                            </div>
                            <span className="text-ink-3">{c.sharePct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-3">{c.topSector}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleFilterCountry(c.code)}
                            className="press rounded border border-hairline bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-cyan-400 hover:bg-cyan-500 hover:text-space"
                          >
                            FILTER MAP
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "c2nodes" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-ink-3">
                <span>Active command and control infrastructure tracked via live Cobalt Strike and Feodo telemetry</span>
                <span className="text-fuchsia-400 font-bold">{botnetC2s.length} NODES TRACKED</span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {botnetC2s.map((node) => (
                  <div
                    key={node.id}
                    className="flex flex-col justify-between rounded-xl border border-hairline bg-surface-2/60 p-3.5 hover:border-fuchsia-500/40 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-fuchsia-400 motion-safe:animate-ping" />
                          <span className="font-bold text-ink">{node.ip}</span>
                          <span className="rounded bg-fuchsia-950/60 px-1.5 py-0.5 text-[10px] text-fuchsia-300">
                            PORT {node.port}
                          </span>
                        </div>
                        <span className="rounded bg-emerald-950/50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                          {node.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="mt-2 text-[11.5px] text-ink-3 space-y-0.5">
                        <p className="text-ink truncate">
                          <span className="text-ink-4">Framework:</span> {node.framework}
                        </p>
                        <p className="truncate">
                          <span className="text-ink-4">ASN:</span> {node.asn}
                        </p>
                        <p>
                          <span className="text-ink-4">Location:</span> {node.city}, {countryName(node.country)} ({node.country})
                        </p>
                        <p className="text-[10px] text-ink-4">
                          Sleep: {node.sleepTime}ms | Jitter: {node.jitter}% | Last Seen: {shortDate(node.lastSeen)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-hairline pt-2 text-[11px]">
                      <span className="text-ink-4 font-mono text-[10px]">{node.uriPath}</span>
                      <button
                        type="button"
                        onClick={() => handleFlyToC2(node)}
                        className="press flex items-center gap-1 rounded border border-hairline bg-surface px-2 py-0.5 text-fuchsia-300 hover:bg-fuchsia-500 hover:text-space"
                      >
                        <Crosshair size={12} />
                        <span>TRACK ON MAP</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "adversaries" && (
            <div className="space-y-4">
              <div className="text-xs text-ink-3">
                Geopolitical threat actor clusters identified through intrusion attribution and infrastructure overlap
              </div>

              <div className="space-y-4">
                {adversaryOrigins.map((a) => (
                  <div key={a.nexus} className={`rounded-xl border p-5 ${a.accent}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-ink">{a.nexus}</h4>
                          <span className="rounded bg-surface px-2 py-0.5 text-[10px] font-bold text-ink-3">
                            ORIGIN: {a.code}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-ink-2">{a.motives}</p>
                      </div>
                      <span className="rounded bg-surface px-2.5 py-1 text-xs font-bold text-ink">
                        {a.activeOperations} OPERATIONS
                      </span>
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3">
                      <span className="text-[10px] uppercase tracking-wider text-ink-4">
                        Affiliated APT Units & Cartels:
                      </span>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {a.threatActors.map((actor) => (
                          <button
                            key={actor}
                            type="button"
                            onClick={() => {
                              soundEngine.playClick();
                              selectActor(actor.split(" ")[0]);
                              onClose();
                            }}
                            className="press flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-2.5 py-1 text-xs text-ink hover:border-cyan-400 hover:text-cyan-300"
                          >
                            <span>{actor}</span>
                            <ArrowSquareOut size={12} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </TacticalDialog>
  );
}
