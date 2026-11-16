"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle, Copy, ShieldCheck, ShieldWarning, Sparkle, WarningCircle, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { soundEngine } from "@/lib/audio/sound-engine";
import {
  correlateReconIntel,
  deriveApexDomain,
  extractDmarcEnforced,
  extractDmarcPresent,
  extractSpfPresent,
  normalizeReconDomain,
  scoreReconPosture,
} from "@/lib/recon";
import type { Snapshot, Vuln } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSituation } from "@/stores/situation";
import { useStack } from "@/stores/stack";
import { tidyVendor } from "@/lib/vendors";

interface ExposureReport {
  domain: string;
  apexDomain: string;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  spfValid: boolean;
  dmarcEnforced: boolean;
  dmarcPresent: boolean;
  nxdomain: boolean;
  ipAddresses: string[];
  mxRecords: string[];
  matchedIncidents: { title: string; status: string; date: string }[];
  matchedCves: { cve: string; vuln?: Vuln }[];
  patchPriorities: { priority: "P1 CRITICAL" | "P2 HIGH" | "P3 MEDIUM"; title: string; action: string; cve?: string }[];
}

const SAMPLE_DOMAINS = ["apple.com", "cloudflare.com", "microsoft.com", "defense.gov", "tesla.com"];

interface DnsAnswer {
  type: number;
  data: string;
}

interface DnsResponse {
  Status?: number;
  Answer?: DnsAnswer[];
}

async function queryDoH(name: string, type: "A" | "TXT" | "MX", signal: AbortSignal): Promise<DnsResponse | null> {
  const enc = encodeURIComponent(name);
  const urls = [
    `https://dns.google/resolve?name=${enc}&type=${type}`,
    `https://cloudflare-dns.com/dns-query?name=${enc}&type=${type}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/dns-json" },
        signal,
      });
      if (res.ok) return (await res.json()) as DnsResponse;
    } catch {
      // Try next resolver
    }
  }
  return null;
}

export function AmIAffectedHero({
  snapshot,
  isModal = false,
  onClose,
}: {
  snapshot: Snapshot;
  isModal?: boolean;
  onClose?: () => void;
}) {
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ExposureReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const selectCve = useSituation((s) => s.selectCve);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const runScan = async (targetDomain: string) => {
    const clean = normalizeReconDomain(targetDomain);
    if (!clean) {
      setError("Please enter a valid public domain (e.g. apple.com or cloudflare.com)");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    soundEngine.playClick();

    try {
      const apex = deriveApexDomain(clean);
      let ips: string[] = [];
      let mxList: string[] = [];
      let txtStrings: string[] = [];
      let dmarcStrings: string[] = [];
      let nxdomain = false;

      const res = await fetch(`/api/recon?domain=${encodeURIComponent(clean)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        ips = data.ips ?? [];
        mxList = data.mx ?? [];
        txtStrings = data.txt ?? [];
        dmarcStrings = data.dmarc ?? [];
        nxdomain = Boolean(data.nxdomain);
      } else {
        // Authentic client-side DoH resolution fallback directly to Google & Cloudflare
        const [aRes, txtRes, dmarcRes, mxRes] = await Promise.all([
          queryDoH(clean, "A", controller.signal),
          queryDoH(clean, "TXT", controller.signal),
          queryDoH(`_dmarc.${clean}`, "TXT", controller.signal),
          queryDoH(clean, "MX", controller.signal),
        ]);
        const anyAnswer = Boolean(aRes || txtRes || dmarcRes || mxRes);
        if (!anyAnswer) {
          throw new Error("Unable to resolve DNS records for this domain. Please verify target domain.");
        }
        for (const ans of aRes?.Answer ?? []) {
          if (ans.type === 1 || ans.type === 28) ips.push(ans.data);
        }
        for (const ans of txtRes?.Answer ?? []) {
          if (ans.type === 16) txtStrings.push(String(ans.data).replace(/^"|"$/g, "").replace(/\\"/g, '"'));
        }
        for (const ans of dmarcRes?.Answer ?? []) {
          if (ans.type === 16) dmarcStrings.push(String(ans.data).replace(/^"|"$/g, "").replace(/\\"/g, '"'));
        }
        for (const ans of mxRes?.Answer ?? []) {
          if (ans.type === 15) {
            const parts = ans.data.split(" ");
            const host = (parts[parts.length - 1] || ans.data).replace(/\.$/, "");
            mxList.push(host);
          }
        }
        nxdomain = Boolean(aRes?.Status === 3 && ips.length === 0 && txtStrings.length === 0 && mxList.length === 0);
      }

      const spfValid = extractSpfPresent(txtStrings);
      const dmarcEnforced = extractDmarcEnforced(dmarcStrings);
      const dmarcPresent = extractDmarcPresent(dmarcStrings);

      // Correlate with authentic threat intel
      const intel = correlateReconIntel(clean, snapshot);

      const vulnMap = new Map<string, Vuln>();
      for (const v of [...snapshot.kev, ...snapshot.trending, ...snapshot.fresh]) {
        vulnMap.set(v.cve, v);
      }

      const matchedCveObjects = intel.cves.map((cve) => ({
        cve,
        vuln: vulnMap.get(cve),
      }));

      const posture = scoreReconPosture({
        nxdomain,
        spfValid,
        dmarcEnforced,
        dmarcPresent,
        incidentCount: intel.incidents.length,
        cveCount: intel.cves.length,
      });

      // Compute actionable "What to patch first" guidance
      const priorities: ExposureReport["patchPriorities"] = [];

      // 0. NXDOMAIN Priority
      if (nxdomain) {
        priorities.push({
          priority: "P1 CRITICAL",
          title: "Non-Existent Public Domain (NXDOMAIN)",
          action: "Domain has no active public DNS records. Check spelling or secure ownership to block phishing impersonation.",
        });
      }

      // 1. Critical CVE priorities
      for (const item of matchedCveObjects) {
        if (item.vuln?.kev) {
          priorities.push({
            priority: "P1 CRITICAL",
            title: `Actively Exploited Flaw: ${item.cve}`,
            action: `CISA Known Exploited Vulnerability in ${item.vuln.product}. Apply vendor patch immediately to prevent remote takeover.`,
            cve: item.cve,
          });
        } else if (item.vuln && typeof item.vuln.cvss === "number" && item.vuln.cvss >= 9.0) {
          priorities.push({
            priority: "P1 CRITICAL",
            title: `Critical Severity Flaw: ${item.cve} (CVSS ${item.vuln.cvss.toFixed(1)})`,
            action: `High-severity vulnerability in ${item.vuln.product}. Upgrade perimeter firmware or isolate network interface.`,
            cve: item.cve,
          });
        }
      }

      // 2. Email Perimeter Security Priorities
      if (!dmarcEnforced) {
        if (!dmarcPresent) {
          priorities.push({
            priority: "P2 HIGH",
            title: "Missing DMARC Protection Record",
            action: "Publish a _dmarc DNS TXT record with p=quarantine or p=reject to block spoofed spearphishing emails.",
          });
        } else {
          priorities.push({
            priority: "P2 HIGH",
            title: "DMARC Policy Not Enforced (p=none)",
            action: "Upgrade DMARC policy from monitoring mode (p=none) to strict enforcement (p=reject) to stop phishing.",
          });
        }
      }

      if (!spfValid) {
        priorities.push({
          priority: "P3 MEDIUM",
          title: "Authoritative SPF Record Absent",
          action: "Deploy SPF txt record (v=spf1) designating approved corporate outbound email relays.",
        });
      }

      if (priorities.length === 0) {
        priorities.push({
          priority: "P3 MEDIUM",
          title: "Maintain Routine Security Hygiene",
          action: "Domain demonstrates enforced DMARC and valid SPF. Continue monitoring perimeter ports and vendor advisory feeds.",
        });
      }

      setReport({
        domain: clean,
        apexDomain: apex,
        score: posture.score,
        grade: posture.grade,
        spfValid,
        dmarcEnforced,
        dmarcPresent,
        nxdomain,
        ipAddresses: ips,
        mxRecords: mxList,
        matchedIncidents: intel.incidents,
        matchedCves: matchedCveObjects,
        patchPriorities: priorities.slice(0, 4),
      });

      soundEngine.playEmpDischarge();
    } catch {
      setError("Unable to resolve domain reconnaissance. Verify connection and domain name.");
    } finally {
      setLoading(false);
    }
  };

  const copyExecutiveSummary = () => {
    if (!report) return;
    const lines = [
      `TITAN CYBER COMMAND - EXPOSURE REPORT: ${report.domain.toUpperCase()}`,
      `Security Posture Score: ${report.score}/100 (Grade ${report.grade})`,
      `DMARC Enforced: ${report.dmarcEnforced ? "YES (Protected)" : "NO (At Risk)"}`,
      `SPF Valid: ${report.spfValid ? "YES" : "NO"}`,
      `Active CVE Matches: ${report.matchedCves.length}`,
      `Historical Incident Matches: ${report.matchedIncidents.length}`,
      "",
      "WHAT TO PATCH FIRST:",
      ...report.patchPriorities.map((p, i) => `${i + 1}. [${p.priority}] ${p.title} - ${p.action}`),
      "",
      "Generated via Titan Cyber Command (https://titan-cybercommand.vercel.app)",
    ];
    void navigator.clipboard.writeText(lines.join("\n"));
    toast("Exposure report copied to clipboard");
  };

  const handleAddToStack = () => {
    if (!report) return;
    const vendor = tidyVendor(report.domain.split(".")[0]);
    if (vendor) {
      useStack.getState().add(vendor);
      toast(`Added ${vendor} to your tracked stack`);
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden transition-all",
        isModal
          ? "border-0 bg-transparent p-1 shadow-none"
          : "mb-3 rounded-[20px] border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 via-surface-2 to-surface p-3.5 shadow-xl",
      )}
    >
      {/* Top Banner Header */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5 items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-cyan-400/50 motion-safe:animate-ping" />
            <span className="size-1.5 rounded-full bg-cyan-400" />
          </span>
          <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.1em] text-cyan-400">
            AM I AFFECTED? // EXPOSURE ENGINE
          </span>
        </div>
        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 font-mono text-[9.5px] font-semibold text-cyan-300">
          100% REAL INTEL
        </span>
      </div>

      <p className="text-[12.5px] leading-snug text-ink-2">
        Paste any company domain for instant DNS posture analysis, correlated CVE exposure, and priority patch actions.
      </p>

      {/* Domain Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void runScan(domainInput);
        }}
        className="mt-2.5 flex items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="Paste domain (e.g. apple.com, cloudflare.com)..."
            className="w-full rounded-xl border border-white/10 bg-space/90 px-3 py-2 font-mono text-[12.5px] text-ink placeholder:text-ink-4 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          {domainInput ? (
            <button
              type="button"
              onClick={() => setDomainInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 hover:text-ink"
              aria-label="Clear domain"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={loading || !domainInput.trim()}
          className="press flex shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500 px-3.5 py-2 font-mono text-[12px] font-bold text-space shadow-md hover:bg-cyan-400 disabled:opacity-50"
        >
          {loading ? (
            <span className="size-3.5 animate-spin rounded-full border-2 border-space border-t-transparent" />
          ) : (
            <ShieldCheck size={14} weight="bold" />
          )}
          <span>{loading ? "SCANNING..." : "SCAN"}</span>
        </button>
      </form>

      {/* Quick Test Sample Chips */}
      {!report && !loading && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="font-mono text-[10px] uppercase text-ink-4">Quick tests:</span>
          {SAMPLE_DOMAINS.map((domain) => (
            <button
              key={domain}
              type="button"
              onClick={() => {
                setDomainInput(domain);
                void runScan(domain);
              }}
              className="rounded-md border border-white/5 bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-ink-3 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300"
            >
              {domain}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 px-3 py-2 text-[12px] text-red-300">
          <WarningCircle size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Generated Exposure Report */}
      {report && (
        <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
          {/* Posture Score Row */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-space/80 p-3">
            <div className="min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-4">POSTURE GRADE</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "font-mono text-[26px] font-extrabold leading-none",
                    report.grade.startsWith("A")
                      ? "text-emerald-400"
                      : report.grade === "B"
                        ? "text-cyan-400"
                        : report.grade === "C"
                          ? "text-amber-400"
                          : "text-red-400",
                  )}
                >
                  {report.grade}
                </span>
                <span className="font-mono text-[13px] text-ink-3">
                  Score: <strong className="text-ink">{report.score}</strong>/100
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 text-right">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold",
                  report.dmarcEnforced ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300",
                )}
              >
                {report.dmarcEnforced ? <CheckCircle size={11} weight="fill" /> : <ShieldWarning size={11} weight="fill" />}
                DMARC {report.dmarcEnforced ? "ENFORCED" : "AT RISK"}
              </span>
              <span className="font-mono text-[10px] text-ink-4">
                SPF: {report.spfValid ? "VALID" : "UNSET"} · IPS: {report.ipAddresses.length}
              </span>
            </div>
          </div>

          {/* Priority Action Checklist: What to patch first */}
          <div className="rounded-xl border border-white/5 bg-space/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-wider text-ink-3">
                WHAT TO PATCH FIRST
              </span>
              <span className="font-mono text-[10px] text-cyan-400">
                {report.patchPriorities.length} ACTION ITEMS
              </span>
            </div>

            <div className="space-y-2">
              {report.patchPriorities.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-white/[0.04] bg-surface-2 p-2.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[9px] font-bold",
                        item.priority.includes("P1")
                          ? "bg-red-500/20 text-red-300"
                          : item.priority.includes("P2")
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-cyan-500/20 text-cyan-300",
                      )}
                    >
                      {item.priority}
                    </span>
                    {item.cve && (
                      <button
                        type="button"
                        onClick={() => selectCve(item.cve!)}
                        className="press flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300 underline"
                      >
                        VIEW DOSSIER <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 font-semibold text-ink">{item.title}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-ink-3">{item.action}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Correlated CVE Exposure */}
          {report.matchedCves.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-space/60 p-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-3">
                CORRELATED EXPLOITED CVES ({report.matchedCves.length})
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {report.matchedCves.map((item) => (
                  <button
                    key={item.cve}
                    type="button"
                    onClick={() => selectCve(item.cve)}
                    className="press rounded-md border border-white/10 bg-surface-2 px-2 py-1 font-mono text-[11px] text-ink hover:border-cyan-400 hover:text-cyan-300"
                  >
                    {item.cve}
                    {item.vuln?.kev ? " · KEV" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={copyExecutiveSummary}
                className="press flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-ink-3 hover:text-ink"
              >
                <Copy size={12} />
                <span>COPY BRIEF</span>
              </button>
              <button
                type="button"
                onClick={handleAddToStack}
                className="press flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[11px] text-ink-3 hover:text-ink"
              >
                <Sparkle size={12} />
                <span>TRACK IN STACK</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setReport(null);
                setDomainInput("");
                if (onClose) onClose();
              }}
              className="font-mono text-[11px] text-ink-4 hover:text-ink"
            >
              CLOSE REPORT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
