import type { Snapshot } from "@/lib/types";

const HOSTNAME_RE = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/;
const GENERIC_LABELS = new Set(["www", "mail", "smtp", "imap", "pop", "app", "api", "cdn", "ns1", "ns2", "blog", "shop", "dev", "staging", "portal", "login", "auth", "com", "org", "net", "edu", "gov", "io", "co", "uk"]);
const SECOND_LEVEL_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.jp", "ne.jp", "co.nz", "com.br", "com.sg"]);

export interface ReconCorrelation {
  incidents: { title: string; status: string; date: string }[];
  cves: string[];
}

export function normalizeReconDomain(input: string): string | null {
  let raw = input.trim().toLowerCase();
  if (!raw) return null;

  raw = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  raw = raw.replace(/[/?#].*$/, "");
  raw = raw.replace(/^[^@]*@/, "");
  raw = raw.replace(/:\d+$/, "");
  raw = raw.replace(/\.+$/, "");

  // Do not match bare IPv4/IPv6 or invalid characters
  if (/^\d+(?:\.\d+){3}$/.test(raw)) return null;
  if (!HOSTNAME_RE.test(raw)) return null;

  return raw;
}

export function deriveApexDomain(domain: string): string {
  const clean = domain.replace(/^www\./, "");
  const parts = clean.split(".");
  if (parts.length <= 2) return clean;
  const lastTwo = parts.slice(-2).join(".");
  if (SECOND_LEVEL_SUFFIXES.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return lastTwo;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractBrandTokens(domain: string): string[] {
  const apex = deriveApexDomain(domain);
  const parts = apex.split(".");
  const primary = parts[0] ?? "";
  const tokens = new Set<string>();
  if (primary.length >= 4 && !GENERIC_LABELS.has(primary)) {
    tokens.add(primary);
  }
  for (const label of domain.split(".")) {
    if (label.length >= 5 && !GENERIC_LABELS.has(label)) {
      tokens.add(label);
    }
  }
  return Array.from(tokens);
}

function containsWholeWord(haystack: string, token: string): boolean {
  if (!haystack || token.length < 4) return false;
  const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(token)}(?:$|[^a-z0-9])`, "i");
  return re.test(haystack);
}

export function correlateReconIntel(domain: string, snapshot: Snapshot): ReconCorrelation {
  const clean = domain.toLowerCase().replace(/^www\./, "");
  const apex = deriveApexDomain(clean);
  const tokens = extractBrandTokens(clean);

  const matchedIncidents: { title: string; status: string; date: string }[] = [];
  for (const inc of snapshot.incidents) {
    const incDomain = inc.domain?.trim().toLowerCase().replace(/^www\./, "") ?? "";
    const domainExact =
      incDomain.length >= 4 &&
      (incDomain === clean ||
        incDomain === apex ||
        clean.endsWith(`.${incDomain}`) ||
        incDomain.endsWith(`.${apex}`));

    const victimLower = inc.victim.trim().toLowerCase();
    const victimCompact = victimLower.replace(/[^a-z0-9]/g, "");
    const victimMatch =
      (victimCompact.length >= 4 && tokens.some((t) => victimCompact === t)) ||
      tokens.some((t) => containsWholeWord(victimLower, t));

    if (domainExact || victimMatch) {
      matchedIncidents.push({ title: inc.title, status: inc.status, date: inc.date });
    }
  }

  const matchedCves = new Set<string>();
  const allVulns = [...snapshot.kev, ...snapshot.trending, ...snapshot.fresh];
  for (const v of allVulns) {
    const vendor = v.vendor.trim().toLowerCase();
    const product = v.product.trim().toLowerCase();
    const vendorMatch = vendor.length >= 4 && tokens.some((t) => containsWholeWord(vendor, t) || vendor.replace(/[^a-z0-9]/g, "") === t);
    const productMatch = product.length >= 4 && tokens.some((t) => containsWholeWord(product, t) || product.replace(/[^a-z0-9]/g, "") === t);
    if (vendorMatch || productMatch) {
      matchedCves.add(v.cve);
    }
  }

  return {
    incidents: matchedIncidents.slice(0, 6),
    cves: Array.from(matchedCves).slice(0, 8),
  };
}

const SPF_RE = /(?:^|[\s"'])v=spf1(?=$|[\s"'])/i;
const DMARC_VERSION_RE = /(?:^|[\s;"'])v=dmarc1(?=$|[\s;"'])/i;
const DMARC_POLICY_RE = /(?:^|[;\s"'])p=(?:reject|quarantine)(?=$|[;\s"'])/i;

export function extractSpfPresent(txtRecords: readonly string[]): boolean {
  return txtRecords.some((txt) => SPF_RE.test(txt));
}

export function extractDmarcEnforced(dmarcTxtRecords: readonly string[]): boolean {
  return dmarcTxtRecords.some((txt) => DMARC_VERSION_RE.test(txt) && DMARC_POLICY_RE.test(txt));
}

export function extractDmarcPresent(dmarcTxtRecords: readonly string[]): boolean {
  return dmarcTxtRecords.some((txt) => DMARC_VERSION_RE.test(txt));
}

export function scoreReconPosture(opts: {
  nxdomain: boolean;
  spfValid: boolean;
  dmarcEnforced: boolean;
  dmarcPresent: boolean;
  incidentCount: number;
  cveCount: number;
}): { score: number; grade: "A+" | "A" | "B" | "C" | "D" | "F" } {
  if (opts.nxdomain) {
    return { score: 0, grade: "F" };
  }
  let score = 40;
  if (opts.spfValid) score += 20;
  if (opts.dmarcEnforced) score += 30;
  else if (opts.dmarcPresent) score += 15;
  score += 10; // Baseline active DNS resolution
  score -= Math.min(45, opts.incidentCount * 25);
  score -= Math.min(25, opts.cveCount * 5);
  score = Math.max(0, Math.min(100, score));

  const grade: "A+" | "A" | "B" | "C" | "D" | "F" =
    score >= 95 ? "A+" : score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  return { score, grade };
}
