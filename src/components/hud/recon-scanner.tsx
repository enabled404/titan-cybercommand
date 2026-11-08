"use client";

import { useState } from "react";
import { Check, CheckCircle, Copy, MagnifyingGlass, ShieldCheck, ShieldWarning, WarningCircle, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { soundEngine } from "@/lib/audio/sound-engine";
import { useMapInstance } from "@/components/map/map-instance";
import { useSituation } from "@/stores/situation";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

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

interface ReconResult {
  domain: string;
  ipAddresses: string[];
  mxRecords: string[];
  spfValid: boolean;
  dmarcValid: boolean;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  incidents: { title: string; status: string; date: string }[];
  cves: string[];
}

export function ReconScannerModal({ open, onClose, snapshot }: { open: boolean; onClose: () => void; snapshot: Snapshot }) {
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const map = useMapInstance((s) => s.map);

  const executeScan = async (targetDomain: string) => {
    const cleanDomain = targetDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!cleanDomain || cleanDomain.length < 3) return;

    setLoading(true);
    setError(null);
    setResult(null);
    soundEngine.playClick();

    try {
      // 1. Check Cloudflare DNS-over-HTTPS for A and TXT records (Free, public, CORS enabled)
      const [dnsRes, txtRes, mxRes] = await Promise.allSettled([
        fetch(`https://cloudflare-dns.com/dns-query?name=${cleanDomain}&type=A`, {
          headers: { Accept: "application/dns-json" },
        }).then((r) => r.json()),
        fetch(`https://cloudflare-dns.com/dns-query?name=${cleanDomain}&type=TXT`, {
          headers: { Accept: "application/dns-json" },
        }).then((r) => r.json()),
        fetch(`https://cloudflare-dns.com/dns-query?name=${cleanDomain}&type=MX`, {
          headers: { Accept: "application/dns-json" },
        }).then((r) => r.json()),
      ]);

      const ips: string[] = [];
      if (dnsRes.status === "fulfilled" && dnsRes.value.Answer) {
        for (const ans of dnsRes.value.Answer) {
          if (ans.type === 1) ips.push(ans.data);
        }
      }

      let hasSpf = false;
      let hasDmarc = false;
      if (txtRes.status === "fulfilled" && txtRes.value.Answer) {
        for (const ans of txtRes.value.Answer) {
          const txt = String(ans.data).toLowerCase();
          if (txt.includes("v=spf1")) hasSpf = true;
          if (txt.includes("v=dmarc1")) hasDmarc = true;
        }
      }

      const mxList: string[] = [];
      if (mxRes.status === "fulfilled" && mxRes.value.Answer) {
        for (const ans of mxRes.value.Answer) {
          if (ans.type === 15) mxList.push(ans.data.split(" ").pop() || ans.data);
        }
      }

      // 2. Cross-reference live threat intelligence from the snapshot
      const matchedIncidents = snapshot.incidents
        .filter(
          (inc) =>
            (inc.domain && inc.domain.toLowerCase() === cleanDomain) ||
            cleanDomain.includes(inc.victim.toLowerCase().replace(/[^a-z0-9]/g, "")) ||
            inc.victim.toLowerCase().includes(cleanDomain.split(".")[0]),
        )
        .map((i) => ({ title: i.title, status: i.status, date: i.date }));

      // Find associated CVEs
      const matchedCves: string[] = [];
      const allVulns = [...snapshot.kev, ...snapshot.trending, ...snapshot.fresh];
      for (const v of allVulns) {
        if (cleanDomain.includes(v.vendor.toLowerCase()) || cleanDomain.includes(v.product.toLowerCase())) {
          matchedCves.push(v.cve);
        }
      }

      // 3. Compute Security Posture Score
      let score = 90;
      if (!hasSpf) score -= 15;
      if (!hasDmarc) score -= 20;
      if (matchedIncidents.some((i) => i.status === "confirmed")) score -= 35;
      else if (matchedIncidents.some((i) => i.status === "claimed")) score -= 15;
      if (matchedCves.length > 0) score -= Math.min(30, matchedCves.length * 10);
      score = Math.max(15, Math.min(100, score));

      let grade: "A+" | "A" | "B" | "C" | "D" | "F" = "A";
      if (score >= 95) grade = "A+";
      else if (score >= 85) grade = "A";
      else if (score >= 70) grade = "B";
      else if (score >= 55) grade = "C";
      else if (score >= 40) grade = "D";
      else grade = "F";

      setResult({
        domain: cleanDomain,
        ipAddresses: ips.slice(0, 4),
        mxRecords: mxList.slice(0, 3),
        spfValid: hasSpf,
        dmarcValid: hasDmarc,
        score,
        grade,
        incidents: matchedIncidents,
        cves: Array.from(new Set(matchedCves)).slice(0, 5),
      });

      // Target Coordinate Plotting
      const inc = snapshot.incidents.find(
        (i) => i.domain?.toLowerCase() === cleanDomain || i.victim.toLowerCase().includes(cleanDomain.split(".")[0]),
      );
      const targetCoords: [number, number] | undefined = TARGET_COORDS[cleanDomain] || (inc ? [inc.lon, inc.lat] : undefined);

      if (targetCoords) {
        useSituation.getState().setReconTarget({
          domain: cleanDomain,
          coords: targetCoords,
          score,
          grade,
        });
        if (map) {
          map.flyTo({ center: targetCoords, zoom: 4.8, pitch: 42, duration: 2500, essential: true });
        }
      }
      soundEngine.playRadarPing();
    } catch {
      setError("Unable to complete reconnaissance scan for this domain. Verify connectivity.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDossier = () => {
    if (!result) return;
    soundEngine.playClick();
    const md = [
      `# TITAN CYBER COMMAND: RECON INTEL DOSSIER`,
      `Target: ${result.domain}`,
      `Security Posture Grade: ${result.grade} (${result.score}/100)`,
      `Resolved IP Addresses: ${result.ipAddresses.join(", ") || "Protected by edge proxy"}`,
      `MX Mail Servers: ${result.mxRecords.join(", ") || "None"}`,
      `SPF Record: ${result.spfValid ? "VALID" : "UNENFORCED / MISSING"}`,
      `DMARC Protection: ${result.dmarcValid ? "PROTECTED" : "UNENFORCED"}`,
      result.incidents.length > 0 ? `Associated Threat Claims: ${result.incidents.map((i) => `${i.title} (${i.status})`).join("; ")}` : `Threat Activity: Clean (No active dark-web leak claims)`,
      result.cves.length > 0 ? `Correlated Active CVEs: ${result.cves.join(", ")}` : `Correlated Active CVEs: None detected`,
      `\nGenerated by Titan Cyber Command OSINT Gateway at ${new Date().toISOString()}`,
    ].join("\n");
    void navigator.clipboard.writeText(md);
    setCopied(true);
    toast.success("OSINT intelligence dossier copied to clipboard");
    setTimeout(() => setCopied(false), 2200);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeScan(domainInput);
  };

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundEngine.playClick();
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recon-modal-title"
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl overscroll-contain"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-surface-2 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <MagnifyingGlass size={20} weight="bold" />
            </div>
            <div>
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-cyan-400">PASSIVE OSINT RECONNAISSANCE</span>
              <h2 id="recon-modal-title" className="font-display text-lg font-bold text-ink">Target Recon Scanner</h2>
            </div>
          </div>
          <button
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="rounded-full p-1 text-ink-3 transition-colors hover:bg-white/10 hover:text-ink"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Safe Harbor Notice */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-6 py-2 text-[11px] text-ink-3">
          <span className="rounded bg-cyan-500/20 px-1.5 py-0.2 font-mono text-[9px] font-bold text-cyan-300 uppercase">OSINT Safe Harbor</span>
          <span>Queries are limited to passive public DNS and SPF/DMARC records. No active port scanning or intrusion testing is performed.</span>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleScan} className="border-b border-white/5 bg-white/[0.02] p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="recon-domain-input"
                aria-label="Target domain name"
                type="text"
                autoComplete="domain"
                placeholder="Enter domain (e.g. apple.com, tesla.com, openai.com)..."
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-surface-2 px-4 py-2.5 font-mono text-sm text-ink placeholder:text-ink-4 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !domainInput.trim()}
              className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-space transition-all hover:bg-cyan-400 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="size-3.5 animate-spin rounded-full border-2 border-space border-t-transparent" />
                  SCANNING...
                </>
              ) : (
                "LAUNCH RECON"
              )}
            </button>
          </div>

          {/* Quick Target Presets */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-ink-4">
            <span className="uppercase text-ink-4 mr-1">QUICK TARGETS:</span>
            {["tesla.com", "apple.com", "microsoft.com", "defense.gov", "cloudflare.com"].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setDomainInput(preset);
                  executeScan(preset);
                }}
                disabled={loading}
                className="rounded-md border border-white/[0.08] bg-surface px-2 py-0.5 text-cyan-400 transition-colors hover:border-cyan-500/40 hover:bg-cyan-500/10"
              >
                {preset}
              </button>
            ))}
          </div>
        </form>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-mono text-xs text-red-400">{error}</div>}

          {!result && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-ink-3">
              <ShieldCheck size={48} weight="duotone" className="mb-3 text-ink-4 opacity-50" />
              <p className="font-mono text-xs uppercase tracking-wider">Passive Non-Invasive Intelligence</p>
              <p className="mt-1 max-w-sm text-xs text-ink-4">
                Scan mail security (SPF/DMARC), DNS routing, ransomware leak exposures, and active CVE exploitation.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-6">
              {/* Score & Grade Header */}
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-4">Target Domain</span>
                    <button
                      onClick={handleCopyDossier}
                      className="press flex h-5 items-center gap-1 rounded bg-white/5 px-2 font-mono text-[10px] text-cyan-300 transition-colors hover:bg-white/10"
                      title="Copy formatted OSINT report"
                    >
                      {copied ? <Check size={11} weight="bold" className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copied ? "COPIED" : "COPY DOSSIER"}</span>
                    </button>
                  </div>
                  <div className="font-mono text-lg font-bold text-ink">{result.domain}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-ink-3">
                    <span>IPs: {result.ipAddresses.join(", ") || "Cloudflare / CDN"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase text-ink-4">Threat Posture</div>
                    <div className="font-mono text-xl font-bold text-ink">{result.score} / 100</div>
                  </div>
                  <div
                    className={cn(
                      "flex size-14 items-center justify-center rounded-2xl font-mono text-2xl font-black shadow-lg",
                      result.grade === "A+" || result.grade === "A"
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

              {/* Mail Defense & Cryptographic Integrity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                  {result.spfValid ? (
                    <CheckCircle size={20} weight="fill" className="text-emerald-400" />
                  ) : (
                    <WarningCircle size={20} weight="fill" className="text-red-400" />
                  )}
                  <div>
                    <div className="font-mono text-xs font-bold text-ink">SPF Mail Record</div>
                    <div className="text-[11px] text-ink-4">{result.spfValid ? "Authorized Sender List Active" : "Missing or Misconfigured"}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
                  {result.dmarcValid ? (
                    <CheckCircle size={20} weight="fill" className="text-emerald-400" />
                  ) : (
                    <WarningCircle size={20} weight="fill" className="text-amber-400" />
                  )}
                  <div>
                    <div className="font-mono text-xs font-bold text-ink">DMARC Policy</div>
                    <div className="text-[11px] text-ink-4">{result.dmarcValid ? "Domain Spoof Protection Active" : "No Enforced Policy"}</div>
                  </div>
                </div>
              </div>

              {/* Threat Intelligence Correlations */}
              <div className="space-y-3">
                <div className="font-mono text-[11px] uppercase tracking-wider text-ink-4">Correlated Threat Intel</div>
                {result.incidents.length === 0 && result.cves.length === 0 ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300">
                    No active ransomware leak claims or known critical exploited vulnerabilities currently targeting {result.domain}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {result.incidents.map((inc, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <ShieldWarning size={16} className="text-red-400" />
                          <span className="font-medium text-ink">{inc.title}</span>
                        </div>
                        <span className="rounded bg-red-500/20 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-red-300">
                          {inc.status}
                        </span>
                      </div>
                    ))}
                    {result.cves.length > 0 && (
                      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                        <span className="font-mono text-amber-300">Associated Active CVEs: </span>
                        <span className="font-mono text-ink">{result.cves.join(", ")}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
