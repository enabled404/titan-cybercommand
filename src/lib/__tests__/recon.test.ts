import { describe, expect, it } from "vitest";

import {
  correlateReconIntel,
  deriveApexDomain,
  extractDmarcEnforced,
  extractDmarcPresent,
  extractSpfPresent,
  normalizeReconDomain,
  scoreReconPosture,
} from "../recon";
import type { Snapshot } from "../types";

const BASE_SNAPSHOT: Snapshot = {
  generatedAt: "2026-11-11T00:00:00.000Z",
  incidents: [
    {
      id: "inc-1",
      title: "Acme Cloud disclosure",
      victim: "Acme",
      domain: "acme.example",
      type: "cyberattack",
      country: "US",
      lat: 37.7,
      lon: -122.4,
      geoBasis: "hq",
      date: "2026-11-10T00:00:00.000Z",
      updated: "2026-11-10T00:00:00.000Z",
      status: "confirmed",
      severity: 4,
      confidence: 0.95,
      summary: "Confirmed incident",
      cves: ["CVE-2025-0001"],
      sources: [{ title: "8-K", url: "https://example.test", publisher: "SEC" }],
      origin: "sec",
    },
    {
      id: "inc-2",
      title: "Symbolic blank victim",
      victim: "!!!",
      type: "cyberattack",
      country: "DE",
      lat: 52.5,
      lon: 13.4,
      geoBasis: "country",
      date: "2026-11-10T00:00:00.000Z",
      updated: "2026-11-10T00:00:00.000Z",
      status: "reported",
      severity: 2,
      confidence: 0.5,
      summary: "Punctuation only",
      cves: [],
      sources: [{ title: "News", url: "https://example.test" }],
      origin: "news",
    },
  ],
  kev: [
    {
      cve: "CVE-2025-1111",
      vendor: "",
      product: "",
      name: "Empty vendor regression case",
      description: "Test CVE with empty vendor/product",
      published: "2026-11-01",
      kev: true,
      ransomware: false,
      epss: 0.9,
      cvss: 9.8,
      references: [],
    },
    {
      cve: "CVE-2025-2222",
      vendor: "Cloudflare",
      product: "Pingora",
      name: "Cloudflare proxy issue",
      description: "Proxy flaw",
      published: "2026-11-02",
      kev: true,
      ransomware: false,
      epss: 0.5,
      cvss: 7.5,
      references: [],
    },
  ],
  trending: [],
  fresh: [],
  malware: [],
  outages: [],
  stats: {
    incidents24h: 1,
    incidents7d: 2,
    confirmed7d: 1,
    claimed7d: 0,
    countries7d: 2,
    kevAdded30d: 2,
    criticalCves72h: 1,
    malware72h: 0,
    outagesActive: 0,
  },
  feeds: {},
};

describe("normalizeReconDomain", () => {
  it("strips protocol, path, port, and casing", () => {
    expect(normalizeReconDomain("HTTPS://WWW.CloudFlare.COM:443/dns?x=1")).toBe("www.cloudflare.com");
    expect(normalizeReconDomain("openai.com.")).toBe("openai.com");
    expect(normalizeReconDomain("example.xn--p1ai")).toBe("example.xn--p1ai");
  });

  it("rejects empty, malformed, and IP literal inputs", () => {
    expect(normalizeReconDomain("")).toBeNull();
    expect(normalizeReconDomain("http://")).toBeNull();
    expect(normalizeReconDomain("localhost")).toBeNull();
    expect(normalizeReconDomain("not valid domain.com")).toBeNull();
    expect(normalizeReconDomain("192.168.1.1")).toBeNull();
  });
});

describe("correlateReconIntel", () => {
  it("never false-positives on empty vendor/product or stripped-empty victim names", () => {
    const corr = correlateReconIntel("unrelated-brand.com", BASE_SNAPSHOT);
    expect(corr.incidents).toEqual([]);
    expect(corr.cves).toEqual([]);
  });

  it("ignores generic www subdomain prefix when matching", () => {
    const corr = correlateReconIntel("www.cloudflare.com", BASE_SNAPSHOT);
    expect(corr.incidents).toEqual([]);
    expect(corr.cves).toEqual(["CVE-2025-2222"]);
  });

  it("matches exact domain, subdomains, and whole-word victim names", () => {
    const corr = correlateReconIntel("portal.acme.example", BASE_SNAPSHOT);
    expect(corr.incidents.map((i) => i.title)).toEqual(["Acme Cloud disclosure"]);
  });

  it("extracts apex across multi-part SLDs", () => {
    expect(deriveApexDomain("mail.corp.co.uk")).toBe("corp.co.uk");
  });
});

describe("DNS policy helpers & scoring", () => {
  it("detects SPF and DMARC enforcement accurately", () => {
    expect(extractSpfPresent(['"v=spf1 include:_spf.google.com ~all"'])).toBe(true);
    expect(extractSpfPresent(['"not-v=spf10 include:bad"'])).toBe(false);
    expect(extractSpfPresent(['"google-site-verification=abc"'])).toBe(false);

    expect(extractDmarcEnforced(['"v=DMARC1; p=reject; sp=reject"'])).toBe(true);
    expect(extractDmarcEnforced(['"v=DMARC1;p=quarantine;rua=mailto:sec@x.com"'])).toBe(true);
    expect(extractDmarcEnforced(['"v=DMARC1; p=none; sp=reject; rua=mailto:sec@x.com"'])).toBe(false);
    expect(extractDmarcEnforced(['"v=DMARC1; p=none; np=quarantine"'])).toBe(false);
    expect(extractDmarcEnforced(['"v=DMARC1; p=none; rua=mailto:sec@x.com"'])).toBe(false);
    expect(extractDmarcPresent(['"v=DMARC1; p=none;"'])).toBe(true);
    expect(extractDmarcPresent(['"v=DMARC10; p=reject"'])).toBe(false);
  });

  it("scores NXDOMAIN as zero F instead of an optimistic fallback grade", () => {
    expect(
      scoreReconPosture({
        nxdomain: true,
        spfValid: false,
        dmarcEnforced: false,
        dmarcPresent: false,
        incidentCount: 0,
        cveCount: 0,
      }),
    ).toEqual({ score: 0, grade: "F" });
  });
});
