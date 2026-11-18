"use client";

import { useMemo } from "react";
import { ArrowRight, ArrowUpRight, Crosshair, FileCode, FileText, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { TacticalDialog } from "@/components/ui/tactical-dialog";
import { soundEngine } from "@/lib/audio/sound-engine";
import { exportThreatActorMarkdown, exportThreatActorStix21 } from "@/lib/export-intel";
import { getThreatActorProfile } from "@/lib/threat-actors";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSituation } from "@/stores/situation";

export function ThreatActorModal({
  actorName,
  open,
  onClose,
  snapshot,
}: {
  actorName: string | null;
  open: boolean;
  onClose: () => void;
  snapshot?: Snapshot;
}) {
  const selectCve = useSituation((s) => s.selectCve);
  const select = useSituation((s) => s.select);
  const setActorFilter = useSituation((s) => s.setActorFilter);

  const profile = useMemo(() => {
    if (!actorName) return null;
    return getThreatActorProfile(actorName, snapshot);
  }, [actorName, snapshot]);

  if (!open || !actorName || !profile) return null;

  const handleClose = () => {
    soundEngine.playClick();
    onClose();
  };

  const handleSelectCve = (cve: string) => {
    soundEngine.playClick();
    onClose();
    selectCve(cve);
  };

  const handleSelectIncident = (id: string) => {
    soundEngine.playClick();
    onClose();
    select(id);
  };

  return (
    <TacticalDialog
      open={open}
      onClose={handleClose}
      labelledBy="actor-modal-title"
      className="max-w-3xl overflow-hidden rounded-[22px] border border-cyan-500/30 bg-space p-6 text-ink shadow-2xl backdrop-blur-2xl"
    >
      {/* Modal Header */}
      <div className="flex items-start justify-between border-b border-white/10 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-cyan-400">
              THREAT ACTOR DOSSIER // {profile.countryCode}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold",
                profile.threatLevel === "DEFCON 1"
                  ? "bg-red-500/20 text-red-300"
                  : "bg-amber-500/20 text-amber-300",
              )}
            >
              {profile.threatLevel}
            </span>
            <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-ink-3">
              {profile.nexus}
            </span>
          </div>

          <h2 id="actor-modal-title" className="mt-1 font-semicondensed text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {profile.name}
          </h2>

          <p className="mt-0.5 text-xs text-cyan-300/80 font-mono">
            Origin: {profile.origin}
          </p>

          {profile.aliases.length > 0 && (
            <p className="mt-1 text-[11.5px] text-ink-4">
              <span className="font-mono uppercase text-ink-4">Known Aliases:</span> {profile.aliases.join(", ")}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="rounded-full p-1 text-ink-4 hover:bg-white/10 hover:text-ink"
          aria-label="Close dossier"
        >
          <X size={18} />
        </button>
      </div>

      <div className="max-h-[68vh] overflow-y-auto overscroll-contain pr-1 scrollbar-thin mt-4 space-y-5">
        {/* Overview */}
        <div>
          <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-4">
            INTELLIGENCE OVERVIEW
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
            {profile.overview}
          </p>
        </div>

        {/* Targeted Sectors & Countries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/5 bg-surface-2 p-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">TARGETED SECTORS</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {profile.targetSectors.map((s) => (
                <span key={s} className="rounded bg-white/5 px-2 py-0.5 text-[11px] text-ink-3">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-2 p-3">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">TARGET NATIONS</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {profile.targetCountries.map((c) => (
                <span key={c} className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* MITRE ATT&CK Matrix */}
        <div>
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-4">
              MITRE ATT&CK MAPPING ({profile.mitreAttack.length})
            </h3>
            <span className="font-mono text-[10px] text-cyan-400">TACTICS & TECHNIQUES</span>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profile.mitreAttack.map((technique) => (
              <div key={technique.id} className="rounded-xl border border-white/5 bg-surface-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-300">
                    {technique.id}
                  </span>
                  <span className="font-mono text-[10px] uppercase text-ink-4">
                    {technique.tactic}
                  </span>
                </div>
                <p className="mt-1 font-semibold text-xs text-ink">{technique.technique}</p>
                <p className="mt-1 text-[11px] leading-snug text-ink-3">{technique.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Known Exploited CVEs */}
        {profile.knownCves.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-4">
                WEAPONIZED CVES ({profile.knownCves.length})
              </h3>
              <span className="font-mono text-[10px] text-red-400">EXPLOITED IN THE WILD</span>
            </div>

            <div className="mt-2 space-y-2">
              {profile.knownCves.map((cve) => (
                <div
                  key={cve.cve}
                  className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-surface-2 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink">{cve.cve}</span>
                      <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-red-300">
                        CVSS {cve.cvss.toFixed(1)}
                      </span>
                      <span className="text-xs text-ink-3">· {cve.product}</span>
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{cve.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectCve(cve.cve)}
                    className="press shrink-0 flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 font-mono text-[10.5px] text-cyan-300 hover:bg-cyan-500/20"
                  >
                    RUNBOOK <ArrowRight size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Known Campaigns */}
        {profile.knownCampaigns.length > 0 && (
          <div>
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-4">
              HISTORICAL & ACTIVE CAMPAIGNS
            </h3>
            <div className="mt-2 space-y-2">
              {profile.knownCampaigns.map((camp, idx) => (
                <div key={idx} className="rounded-xl border border-white/5 bg-surface-2 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-ink">{camp.title}</span>
                    <span className="font-mono text-[10px] text-cyan-400">{camp.year}</span>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-snug text-ink-3">{camp.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Incidents in Titan Cyber Command Database */}
        {profile.relatedIncidents && profile.relatedIncidents.length > 0 && (
          <div>
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-ink-4">
              VERIFIED VICTIMS IN DATABASE ({profile.relatedIncidents.length})
            </h3>
            <div className="mt-2 divide-y divide-white/5 rounded-xl border border-white/5 bg-surface-2 overflow-hidden">
              {profile.relatedIncidents.slice(0, 8).map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => handleSelectIncident(inc.id)}
                  className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-white/[0.04]"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <span className="font-semibold text-xs text-ink">{inc.victim}</span>
                    <p className="text-[11px] text-ink-4 truncate">{inc.title}</p>
                  </div>
                  <span className="font-mono text-[10px] text-cyan-400 shrink-0">
                    {inc.country} · {inc.date.slice(0, 10)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActorFilter(profile.name);
              soundEngine.playAttackLaunch(0);
              toast.info(`Attack arcs concentrated on ${profile.name}`);
              handleClose();
            }}
            className="press flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 font-mono text-xs font-bold text-space shadow-md hover:bg-cyan-400"
          >
            <Crosshair size={14} weight="bold" />
            <span>HIGHLIGHT ARCS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              exportThreatActorStix21(profile);
            }}
            className="press flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 font-mono text-xs text-ink-3 hover:text-ink"
            title="Export full OASIS STIX 2.1 Threat Actor JSON"
          >
            <FileCode size={14} className="text-emerald-400" />
            <span>STIX 2.1 (.json)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundEngine.playClick();
              exportThreatActorMarkdown(profile);
            }}
            className="press flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 font-mono text-xs text-ink-3 hover:text-ink"
            title="Export formatted Markdown intel dossier"
          >
            <FileText size={14} className="text-cyan-400" />
            <span>Dossier (.md)</span>
          </button>

          <a
            href={`https://www.virustotal.com/gui/search/${encodeURIComponent(profile.name)}`}
            target="_blank"
            rel="noreferrer"
            className="press flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 font-mono text-xs text-ink-3 hover:text-ink transition-colors"
            title="Inspect threat actor malware IOCs and telemetry on VirusTotal"
          >
            <ArrowUpRight size={14} className="text-cyan-400" />
            <span>VirusTotal IOCs</span>
          </a>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="font-mono text-xs text-ink-4 hover:text-ink"
        >
          CLOSE
        </button>
      </div>
    </TacticalDialog>
  );
}
