"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle, Copy, MagnifyingGlass, ShieldCheck, ShieldWarning, WarningCircle, X } from "@phosphor-icons/react";
import { toast } from "sonner";

import { useMapInstance } from "@/components/map/map-instance";
import { TacticalDialog } from "@/components/ui/tactical-dialog";
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
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSituation } from "@/stores/situation";

const TARGET_COORDS: Record<string, [number, number]> = {
  "apple.com": [-122.0322, 37.3230],
  "tesla.com": [-97.6171, 30.2223],
  "microsoft.com": [-122.1283, 47.6423],
  "defense.gov": [-77.0563, 38.8719],
  "cloudflare.com": [-122.3986, 37.7887],
  "google.com": [-122.0842, 37.4220],
  "amazon.com": [-122.3321, 47.6062],
  "openai.com": [-122.4148, 37.7615],
};

interface DnsJsonAnswer {
  type: number;
  data: string;
}

interface DnsJsonResponse {
  Status?: number;
  Answer?: DnsJsonAnswer[];
}

interface ReconResult {
  domain: string;
  nxdomain: boolean;
  dnsFailed: boolean;
  ipAddresses: string[];
  mxRecords: string[];
  spfValid: boolean;
  dmarcEnforced: boolean;
  dmarcPresent: boolean;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  incidents: { title: string; status: string; date: string }[];
  cves: string[];
}

async function queryDoH(name: string, type: "A" | "TXT" | "MX", signal: AbortSignal): Promise<DnsJsonResponse | null> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as DnsJsonResponse;
  } catch {
    return null;
  }
}

export function ReconScannerModal({ open, onClose, snapshot }: { open: boolean; onClose: () => void; snapshot: Snapshot }) {
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const map = useMapInstance((s) => s.map);
  const reconTarget = useSituation((s) => s.reconTarget);
  const setReconTarget = useSituation((s) => s.setReconTarget);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleClose = () => {
    abortRef.current?.abort();
    soundEngine.playClick();
    onClose();
  };

  const executeScan = async (targetDomain: string) => {
    const cleanDomain = normalizeReconDomain(targetDomain);
    if (!cleanDomain) {
      setError("Enter a valid public domain name (for example, apple.com or cloudflare.com).");
      setResult(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setResult(null);
    soundEngine.playClick();

    try {
      const apexDomain = deriveApexDomain(cleanDomain);
      const isSubdomain = apexDomain !== cleanDomain;
      const queries: [
        Promise<DnsJsonResponse | null>,
        Promise<DnsJsonResponse | null>,
        Promise<DnsJsonResponse | null>,
        Promise<DnsJsonResponse | null>,
        Promise<DnsJsonResponse | null>,
        Promise<DnsJsonResponse | null>,
      ] = [
        queryDoH(cleanDomain, "A", controller.signal),
        queryDoH(cleanDomain, "TXT", controller.signal),
        queryDoH(`_dmarc.${cleanDomain}`, "TXT", controller.signal),
        queryDoH(cleanDomain, "MX", controller.signal),
        isSubdomain ? queryDoH(apexDomain, "TXT", controller.signal) : Promise.resolve(null),
        isSubdomain ? queryDoH(`_dmarc.${apexDomain}`, "TXT", controller.signal) : Promise.resolve(null),
      ];

      const [dnsRes, txtRes, dmarcRes, mxRes, apexTxtRes, apexDmarcRes] = await Promise.all(queries);
      if (controller.signal.aborted) return;

      const anyDnsSucceeded = Boolean(dnsRes || txtRes || dmarcRes || mxRes || apexTxtRes || apexDmarcRes);
      if (!anyDnsSucceeded) {
        setError("Unable to reach passive DNS-over-HTTPS resolver. Verify network connectivity or try again.");
        return;
      }

      const ips: string[] = [];
      for (const ans of dnsRes?.Answer ?? []) {
        if (ans.type === 1) ips.push(ans.data);
      }

      const subdomainTxt: string[] = [];
      for (const ans of txtRes?.Answer ?? []) {
        if (ans.type === 16) subdomainTxt.push(String(ans.data));
      }

      const subdomainDmarc: string[] = [];
      for (const ans of dmarcRes?.Answer ?? []) {
        if (ans.type === 16) subdomainDmarc.push(String(ans.data));
      }

      const mxList: string[] = [];
      for (const ans of mxRes?.Answer ?? []) {
        if (ans.type === 15) mxList.push(ans.data.split(" ").pop() || ans.data);
      }

      const nxdomain =
        dnsRes?.Status === 3 &&
        ips.length === 0 &&
        subdomainTxt.length === 0 &&
        mxList.length === 0 &&
        subdomainDmarc.length === 0;

      const txtStrings = [...subdomainTxt];
      const dmarcStrings = [...subdomainDmarc];
      if (!nxdomain && isSubdomain) {
        for (const ans of apexTxtRes?.Answer ?? []) {
          if (ans.type === 16) txtStrings.push(String(ans.data));
        }
        for (const ans of apexDmarcRes?.Answer ?? []) {
          if (ans.type === 16) dmarcStrings.push(String(ans.data));
        }
      }

      const hasSpf = extractSpfPresent(txtStrings);
      const hasDmarcEnforced = extractDmarcEnforced(dmarcStrings);
      const hasDmarcPresent = extractDmarcPresent(dmarcStrings);

      const correlated = correlateReconIntel(cleanDomain, snapshot);
      const { score, grade } = scoreReconPosture({
        nxdomain,
        spfValid: hasSpf,
        dmarcEnforced: hasDmarcEnforced,
        dmarcPresent: hasDmarcPresent,
        incidentCount: correlated.incidents.length,
        cveCount: correlated.cves.length,
      });

      setResult({
        domain: cleanDomain,
        nxdomain,
        dnsFailed: !dnsRes || !mxRes || !txtRes || !dmarcRes,
        ipAddresses: ips.slice(0, 4),
        mxRecords: mxList.slice(0, 3),
        spfValid: hasSpf,
        dmarcEnforced: hasDmarcEnforced,
        dmarcPresent: hasDmarcPresent,
        score,
        grade,
        incidents: correlated.incidents,
        cves: correlated.cves,
      });

      const exactInc = snapshot.incidents.find((i) => {
        const d = i.domain?.trim().toLowerCase().replace(/^www\./, "");
        return d === cleanDomain || d === apexDomain;
      });
      const targetCoords: [number, number] | undefined =
        TARGET_COORDS[cleanDomain] || TARGET_COORDS[apexDomain] || (exactInc ? [exactInc.lon, exactInc.lat] : undefined);

      if (targetCoords && !nxdomain) {
        setReconTarget({
          domain: cleanDomain,
          coords: targetCoords,
          score,
          grade,
        });
        if (map) {
          map.flyTo({ center: targetCoords, zoom: 4.8, pitch: 42, duration: 2500, essential: true });
        }
      } else if (nxdomain && reconTarget?.domain === cleanDomain) {
        setReconTarget(null);
      }
      soundEngine.playRadarPing();
    } catch {
      if (!controller.signal.aborted) {
        setError("Unable to complete reconnaissance scan for this domain. Verify connectivity.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  const handleCopyDossier = async () => {
    if (!result) return;
    soundEngine.playClick();
    const dmarcSummary = result.dmarcEnforced
      ? "ENFORCED (reject/quarantine)"
      : result.dmarcPresent
        ? "MONITORING ONLY (p=none)"
        : "UNENFORCED / MISSING";
    const md = [
      `# TITAN CYBER COMMAND: PASSIVE RECON INTEL DOSSIER`,
      `Target: ${result.domain}`,
      result.nxdomain
        ? `DNS Status: NXDOMAIN (Domain did not resolve in public DNS)`
        : `Passive Posture Score: ${result.grade} (${result.score}/100)`,
      `Resolved IP Addresses: ${result.ipAddresses.join(", ") || (result.nxdomain ? "None (NXDOMAIN)" : "No A records returned")}`,
      `MX Mail Servers: ${result.mxRecords.join(", ") || "None"}`,
      `SPF Record: ${result.spfValid ? "PRESENT (v=spf1)" : "MISSING"}`,
      `DMARC Policy (_dmarc): ${dmarcSummary}`,
      result.incidents.length > 0
        ? `Snapshot Incident Matches: ${result.incidents.map((i) => `${i.title} (${i.status})`).join("; ")}`
        : `Snapshot Incident Matches: None matched in current window (absence is not proof of safety)`,
      result.cves.length > 0
        ? `Snapshot Vendor/Product CVE Matches: ${result.cves.join(", ")}`
        : `Snapshot Vendor/Product CVE Matches: None matched in current window`,
      `\nGenerated by Titan Cyber Command Passive OSINT Gateway at ${new Date().toISOString()}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      toast.success("OSINT intelligence dossier copied to clipboard");
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error("Clipboard access denied in this browser context");
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeScan(domainInput);
  };

  return (
    <TacticalDialog open={open} onClose={handleClose} labelledBy="recon-modal-title" className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
            <MagnifyingGlass size={20} weight="bold" />
          </div>
          <div>
            <span className="font-mono text-[10.5px] uppercase tracking-wider text-cyan-400">PASSIVE OSINT RECONNAISSANCE</span>
            <h2 id="recon-modal-title" className="font-display text-lg font-bold text-ink">
              Target Recon Scanner
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="flex min-h-9 min-w-9 items-center justify-center rounded-full p-1 text-ink-3 transition-colors hover:bg-white/10 hover:text-ink"
          aria-label="Close Target Recon Scanner"
        >
          <X size={20} />
        </button>
      </div>

      {/* Safe Harbor Notice */}
      <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-6 py-2 text-[11px] text-ink-3">
        <span className="shrink-0 whitespace-nowrap rounded bg-cyan-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-cyan-300">
          OSINT Safe Harbor
        </span>
        <span>Queries are limited to passive public DNS and SPF/DMARC records. No active port scanning or intrusion testing is performed.</span>
      </div>

      {/* Input Bar */}
      <form onSubmit={handleScan} className="border-b border-white/5 bg-white/[0.02] p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor="recon-domain-input" className="sr-only">
              Target domain name
            </label>
            <input
              id="recon-domain-input"
              data-autofocus
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="Enter domain (e.g. apple.com, tesla.com, cloudflare.com)..."
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 font-mono text-sm text-ink placeholder:text-ink-4 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !domainInput.trim()}
            className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-space transition-all hover:bg-cyan-400 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="size-3.5 rounded-full border-2 border-space border-t-transparent motion-safe:animate-spin" />
                SCANNING...
              </>
            ) : (
              "LAUNCH RECON"
            )}
          </button>
        </div>

        {/* Quick Target Presets */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-4">
          <span className="mr-1 uppercase text-ink-4">QUICK TARGETS:</span>
          {["tesla.com", "apple.com", "microsoft.com", "defense.gov", "cloudflare.com"].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setDomainInput(preset);
                void executeScan(preset);
              }}
              disabled={loading}
              className="min-h-7 rounded-md border border-white/[0.08] bg-surface px-2.5 py-0.5 text-cyan-400 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
            >
              {preset}
            </button>
          ))}
        </div>
      </form>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-6">
        {error && (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-xs text-red-400">
            {error}
          </div>
        )}

        {!result && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-ink-3">
            <ShieldCheck size={48} weight="duotone" className="mb-3 text-ink-4 opacity-50" />
            <p className="font-mono text-xs uppercase tracking-wider">Passive Non-Invasive Intelligence</p>
            <p className="mt-1 max-w-sm text-xs text-ink-4">
              Inspect public DNS A/MX routing, SPF and _dmarc mail posture, and matches against active incident telemetry.
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* Score & Grade Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-4">Target Domain</span>
                  <button
                    type="button"
                    onClick={() => void handleCopyDossier()}
                    className="press flex min-h-6 items-center gap-1 rounded bg-white/5 px-2 font-mono text-[10px] text-cyan-300 transition-colors hover:bg-white/10"
                    title="Copy formatted OSINT report"
                  >
                    {copied ? <Check size={11} weight="bold" className="text-emerald-400" /> : <Copy size={11} />}
                    <span>{copied ? "COPIED" : "COPY DOSSIER"}</span>
                  </button>
                  {reconTarget && (
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setReconTarget(null);
                      }}
                      className="press flex min-h-6 items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 font-mono text-[10px] text-cyan-300 transition-colors hover:bg-cyan-500/20"
                      title="Clear active OSINT reticle from globe"
                    >
                      CLEAR PIN
                    </button>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-lg font-bold text-ink">{result.domain}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
                  <span>
                    {result.nxdomain
                      ? "DNS Status: NXDOMAIN (unregistered or non-resolving host)"
                      : `IPv4: ${result.ipAddresses.join(", ") || "No A record returned"}`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase text-ink-4">Passive Posture</div>
                  <div className="font-mono text-xl font-bold text-ink">{result.nxdomain ? "NXDOMAIN" : `${result.score} / 100`}</div>
                </div>
                <div
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl font-mono text-2xl font-black shadow-lg",
                    result.nxdomain
                      ? "border border-red-500/30 bg-red-500/20 text-red-400"
                      : result.grade === "A+" || result.grade === "A"
                        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : result.grade === "B" || result.grade === "C"
                          ? "border border-amber-500/30 bg-amber-500/20 text-amber-400"
                          : "border border-red-500/30 bg-red-500/20 text-red-400",
                  )}
                >
                  {result.grade}
                </div>
              </div>
            </div>

            {result.dnsFailed && !result.nxdomain && (
              <div role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 font-mono text-[11px] text-amber-300">
                Partial DNS resolver response: one or more upstream DoH queries timed out or failed; treat missing records cautiously.
              </div>
            )}

            {/* Mail Defense & Cryptographic Integrity */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                {result.spfValid ? (
                  <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-400" />
                ) : (
                  <WarningCircle size={20} weight="fill" className="shrink-0 text-red-400" />
                )}
                <div>
                  <div className="font-mono text-xs font-bold text-ink">SPF Mail Record</div>
                  <div className="text-[11px] text-ink-4">
                    {result.spfValid ? "Authorized Sender Policy Present" : "No v=spf1 TXT Record Detected"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                {result.dmarcEnforced ? (
                  <CheckCircle size={20} weight="fill" className="shrink-0 text-emerald-400" />
                ) : (
                  <WarningCircle size={20} weight="fill" className="shrink-0 text-amber-400" />
                )}
                <div>
                  <div className="font-mono text-xs font-bold text-ink">DMARC Policy (_dmarc)</div>
                  <div className="text-[11px] text-ink-4">
                    {result.dmarcEnforced
                      ? "Quarantine/Reject Enforcement Active"
                      : result.dmarcPresent
                        ? "Monitoring Policy Only (p=none)"
                        : "No Enforced _dmarc Record Found"}
                  </div>
                </div>
              </div>
            </div>

            {/* Threat Intelligence Correlations */}
            <div className="space-y-3">
              <div className="font-mono text-[11px] uppercase tracking-wider text-ink-4">Snapshot Intelligence Correlation</div>
              {result.incidents.length === 0 && result.cves.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-ink-3">
                  No matching leak claims or vendor CVEs matched {result.domain} in the active snapshot window. Absence of matches is not proof of safety.
                </div>
              ) : (
                <div className="space-y-2">
                  {result.incidents.map((inc, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <ShieldWarning size={16} className="shrink-0 text-red-400" />
                        <span className="font-medium text-ink">{inc.title}</span>
                      </div>
                      <span className="shrink-0 rounded bg-red-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-300">
                        {inc.status}
                      </span>
                    </div>
                  ))}
                  {result.cves.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                      <span className="font-mono text-amber-300">Snapshot Vendor/Product CVEs: </span>
                      <span className="font-mono text-ink">{result.cves.join(", ")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </TacticalDialog>
  );
}
