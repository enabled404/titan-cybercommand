"use client";

import { useMemo, useState } from "react";
import {
  ArrowSquareOut,
  Broadcast,
  Crosshair,
  FileText,
  Globe,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";

import { useMapInstance } from "@/components/map/map-instance";
import { TacticalDialog } from "@/components/ui/tactical-dialog";
import { OrgLogo } from "@/components/kit/org-logo";
import { Segmented } from "@/components/kit/segmented";
import { soundEngine } from "@/lib/audio/sound-engine";
import { countryName } from "@/lib/countries";
import { relativeTime, shortDate } from "@/lib/format";
import { useNow } from "@/lib/perf/use-now";
import type { Incident, Snapshot } from "@/lib/types";
import { useSituation } from "@/stores/situation";

type ThreatTab = "cartels" | "wire" | "cisa";

interface ThreatRadarModalProps {
  open: boolean;
  onClose: () => void;
  snapshot: Snapshot;
}

export function ThreatRadarModal({ open, onClose, snapshot }: ThreatRadarModalProps) {
  const [tab, setTab] = useState<ThreatTab>("cartels");
  const now = useNow(Date.parse(snapshot.generatedAt));
  const map = useMapInstance((s) => s.map);
  const select = useSituation((s) => s.select);
  const selectCve = useSituation((s) => s.selectCve);

  const darkWebStats = snapshot.darkWebStats;
  const cisaAdvisories = snapshot.cisaAdvisories ?? [];
  const wireBulletins = snapshot.wireBulletins ?? [];

  // Filter extortion claims from incidents
  const cartelClaims = useMemo(() => {
    return snapshot.incidents
      .filter((item) => item.origin === "claims" || item.status === "claimed" || item.type === "ransomware")
      .slice(0, 40);
  }, [snapshot.incidents]);

  const activeCartels = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cartelClaims) {
      if (c.actor) {
        counts.set(c.actor, (counts.get(c.actor) ?? 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      return sorted.slice(0, 10).map(([name, count]) => ({ name, count }));
    }
    return [
      { name: "LockBit", count: 0 },
      { name: "Qilin", count: 0 },
      { name: "Play", count: 0 },
      { name: "Black Basta", count: 0 },
      { name: "Akira", count: 0 },
      { name: "Rhysida", count: 0 },
      { name: "Medusa", count: 0 },
      { name: "BianLian", count: 0 },
    ];
  }, [cartelClaims]);

  const handleFlyToTarget = (incident: Incident) => {
    soundEngine.playClick();
    select(incident.id);
    if (map) {
      map.flyTo({
        center: [incident.lon, incident.lat],
        zoom: 4.8,
        speed: 1.6,
        curve: 1.4,
        essential: true,
      });
    }
    onClose();
  };

  const handleCveClick = (cve: string) => {
    soundEngine.playClick();
    selectCve(cve);
    onClose();
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => toast("Link copied to clipboard"))
      .catch(() => toast.error("Could not access clipboard"));
  };

  const activeTorSites = darkWebStats?.groupsOnline ?? snapshot.stats.activeTorLeakSites ?? 0;
  const claims24h = darkWebStats?.posts24h ?? snapshot.stats.darkWebClaims24h ?? cartelClaims.length;
  const totalCartels = darkWebStats?.groups ?? (activeTorSites > 0 ? activeTorSites : 0);
  const monthlyPosts = darkWebStats?.postsMonth ?? 0;

  return (
    <TacticalDialog open={open} onClose={onClose} labelledBy="threat-radar-title">
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] border border-cyan-500/30 bg-surface/98 font-sans shadow-[0_24px_80px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] bg-surface-2/90 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-cyan-400/60 motion-safe:animate-ping" />
              <span className="size-2 rounded-full bg-cyan-400" />
            </span>
            <Broadcast size={18} className="text-cyan-400" />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="threat-radar-title" className="font-semicondensed text-[16px] font-bold uppercase tracking-wide text-ink">
                  Live Threat Radar & Breach Telemetry
                </h2>
                <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[9.5px] font-bold text-cyan-300">
                  REAL-TIME INTEL
                </span>
              </div>
              <p className="text-[12px] text-ink-3">
                Live dark web cartel extortion claims, official CISA emergency alerts, and breaking breach wires
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <kbd className="hidden rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink-4 sm:inline">
              ESC
            </kbd>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onClose();
              }}
              className="press flex size-7 items-center justify-center rounded-full text-ink-3 hover:bg-white/[0.08] hover:text-ink"
              aria-label="Close Threat Radar"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Global Telemetry Metrics Strip */}
        <div className="grid grid-cols-2 border-b border-white/[0.06] bg-space/60 sm:grid-cols-4">
          <div className="border-r border-white/[0.06] px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">TOR LEAK SITES</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-condensed text-[22px] font-bold text-confirmed tabular">{activeTorSites}</span>
              <span className="text-[11px] font-semibold text-confirmed/80">ONLINE</span>
            </div>
            <span className="block text-[10.5px] text-ink-4">
              {totalCartels > 0 ? `${totalCartels} cartels tracked` : "Tor cartels monitored"}
            </span>
          </div>

          <div className="border-r border-white/[0.06] px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">EXTORTION (24H)</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-condensed text-[22px] font-bold text-reported tabular">{claims24h}</span>
              <span className="text-[11px] font-semibold text-reported/80">VICTIMS</span>
            </div>
            <span className="block text-[10.5px] text-ink-4">
              {monthlyPosts > 0 ? `${monthlyPosts} this month` : "24-hour victim stream"}
            </span>
          </div>

          <div className="border-r border-white/[0.06] px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">BREAKING WIRES</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-condensed text-[22px] font-bold text-cyan-400 tabular">
                {wireBulletins.length}
              </span>
              <span className="text-[11px] font-semibold text-cyan-400/80">DISPATCHES</span>
            </div>
            <span className="block text-[10.5px] text-ink-4">7 primary threat feeds</span>
          </div>

          <div className="px-4 py-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">CISA DIRECTIVES</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-condensed text-[22px] font-bold text-emerald-400 tabular">
                {cisaAdvisories.length}
              </span>
              <span className="text-[11px] font-semibold text-emerald-400/80">ACTIVE</span>
            </div>
            <span className="block text-[10.5px] text-ink-4">CSA alerts and ICS bulletins</span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="shrink-0 border-b border-white/[0.06] bg-surface-2/40 px-5 py-2">
          <Segmented<ThreatTab>
            kind="tab"
            label="Threat Radar Views"
            value={tab}
            onChange={(next) => {
              soundEngine.playClick();
              setTab(next);
            }}
            options={[
              { value: "cartels", label: "Dark Web Extortion Radar", count: cartelClaims.length },
              { value: "wire", label: "Breaking Breach Wire", count: wireBulletins.length },
              { value: "cisa", label: "CISA Emergency Directives", count: cisaAdvisories.length },
            ]}
          />
        </div>

        {/* Scrollable Intelligence Feed */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 scrollbar-thin">
          {/* TAB 1: CARTEL EXTORTION RADAR */}
          {tab === "cartels" && (
            <div className="space-y-3">
              {/* Cartel Ecosystem Card */}
              <div className="rounded-[16px] border border-white/[0.08] bg-white/[0.025] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-4">
                    ACTIVE THREAT CARTELS CURRENTLY HOSTING TOR LEAK SITES
                  </span>
                  <span className="font-mono text-[10.5px] text-cyan-300">
                    {darkWebStats?.marketsOnline ? `${darkWebStats.marketsOnline} ILLICIT MARKETS ACTIVE` : "TOR MARKETS MONITORED"}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {activeCartels.map((group) => (
                    <span
                      key={group.name}
                      className="rounded-full border border-confirmed/30 bg-confirmed/10 px-2.5 py-0.5 font-mono text-[11px] text-red-300"
                    >
                      {group.name}
                      {group.count > 0 ? ` (${group.count})` : ""}
                    </span>
                  ))}
                </div>
              </div>

              {/* Claims Stream */}
              <div className="space-y-2">
                {cartelClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex flex-col justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-surface-2/60 p-3.5 transition-colors hover:border-cyan-500/30 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <OrgLogo name={claim.victim} domain={claim.domain} size={36} className="shrink-0 rounded-[8px]" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semicondensed text-[15px] font-bold text-ink">
                            {claim.victim}
                          </span>
                          {claim.actor && (
                            <span className="rounded bg-confirmed/20 px-2 py-0.5 font-mono text-[10.5px] font-bold text-confirmed">
                              {claim.actor}
                            </span>
                          )}
                          <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink-3">
                            CLAIMED
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-ink-3">
                          {claim.summary.slice(0, 180)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[10.5px] text-ink-4">
                          {claim.country && (
                            <span className="flex items-center gap-1 text-ink-3">
                              <Globe size={12} />
                              {countryName(claim.country)}
                            </span>
                          )}
                          {claim.sector && <span>Sector: {claim.sector}</span>}
                          <span>Reported {relativeTime(claim.date, now)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 sm:flex-col sm:items-end">
                      <button
                        type="button"
                        onClick={() => handleFlyToTarget(claim)}
                        className="press flex h-7 items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/15 px-3 font-mono text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25"
                        title="Fly globe camera to victim coordinates"
                      >
                        <Crosshair size={13} weight="bold" />
                        <span>LOCATE</span>
                      </button>
                      {claim.sources[0]?.url && (
                        <a
                          href={claim.sources[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="press flex h-6 items-center gap-1 px-2 font-mono text-[10.5px] text-ink-4 hover:text-ink"
                          title="Open leak site source disclosure"
                        >
                          <span>Leak Post</span>
                          <ArrowSquareOut size={11} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: BREAKING BREACH WIRE */}
          {tab === "wire" && (
            <div className="space-y-2.5">
              {wireBulletins.length === 0 ? (
                <div className="flex h-40 items-center justify-center font-mono text-[12px] text-ink-4">
                  Synchronizing breaking news wire dispatches...
                </div>
              ) : (
                wireBulletins.map((bulletin) => (
                  <div
                    key={bulletin.id}
                    className="flex flex-col justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-surface-2/60 p-3.5 transition-colors hover:border-cyan-500/30"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-cyan-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                          {bulletin.publisher}
                        </span>
                        <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink-3">
                          {bulletin.type.replace("_", " ")}
                        </span>
                        {bulletin.records && (
                          <span className="rounded bg-confirmed/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-confirmed">
                            {bulletin.records.toLocaleString()} RECORDS
                          </span>
                        )}
                        <span className="font-mono text-[10.5px] text-ink-4">
                          {shortDate(bulletin.date)}
                        </span>
                      </div>

                      <h3 className="mt-1.5 font-semicondensed text-[15px] font-bold leading-snug text-ink">
                        {bulletin.title}
                      </h3>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                        {bulletin.summary}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {bulletin.victim && (
                          <span className="font-mono text-[11px] text-ink-2">
                            Victim: <strong className="text-ink">{bulletin.victim}</strong>
                          </span>
                        )}
                        {bulletin.actor && (
                          <span className="font-mono text-[11px] text-confirmed">
                            Actor: <strong>{bulletin.actor}</strong>
                          </span>
                        )}
                        {bulletin.cves.length > 0 && (
                          <div className="flex items-center gap-1 font-mono text-[10.5px]">
                            {bulletin.cves.slice(0, 3).map((cve) => (
                              <button
                                type="button"
                                key={cve}
                                onClick={() => handleCveClick(cve)}
                                className="rounded bg-white/[0.08] px-1.5 py-0.5 text-cyan-300 hover:bg-white/[0.15]"
                              >
                                {cve}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-white/[0.05] pt-2">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(bulletin.url)}
                        className="press flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] text-ink-3 hover:bg-white/[0.06] hover:text-ink"
                      >
                        <FileText size={12} />
                        <span>Copy Link</span>
                      </button>

                      <a
                        href={bulletin.url}
                        target="_blank"
                        rel="noreferrer"
                        className="press flex h-7 items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-3 font-mono text-[11px] font-semibold text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"
                      >
                        <span>Read Primary Investigation</span>
                        <ArrowSquareOut size={12} />
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CISA EMERGENCY WATCH */}
          {tab === "cisa" && (
            <div className="space-y-2.5">
              {cisaAdvisories.map((advisory) => (
                <div
                  key={advisory.id}
                  className="rounded-[14px] border border-white/[0.06] bg-surface-2/60 p-3.5 transition-colors hover:border-emerald-500/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-300">
                      {advisory.category.toUpperCase()} ADVISORY
                    </span>
                    <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink-4">
                      CISA.GOV
                    </span>
                    <span className="font-mono text-[10.5px] text-ink-4">
                      {shortDate(advisory.published)}
                    </span>
                  </div>

                  <h3 className="mt-1.5 font-semicondensed text-[15px] font-bold leading-snug text-ink">
                    {advisory.title}
                  </h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
                    {advisory.summary}
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {advisory.cves.length > 0 ? (
                        advisory.cves.map((cve) => (
                          <button
                            type="button"
                            key={cve}
                            onClick={() => handleCveClick(cve)}
                            className="press rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:bg-cyan-500/20"
                            title={`Inspect ${cve} dossier`}
                          >
                            {cve}
                          </button>
                        ))
                      ) : (
                        <span className="font-mono text-[10.5px] text-ink-4">Operational Security Guidance</span>
                      )}
                    </div>

                    <a
                      href={advisory.link}
                      target="_blank"
                      rel="noreferrer"
                      className="press flex h-7 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 font-mono text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
                    >
                      <span>CISA Advisory Page</span>
                      <ArrowSquareOut size={12} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TacticalDialog>
  );
}
