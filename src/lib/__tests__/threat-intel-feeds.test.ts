import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

import { getCisaAdvisories, getDarkWebCartelStats, getRansomwareClaims, getWireData } from "@/lib/sources/incidents";
import { resolveUsLocation } from "@/lib/geo";

describe("threat intelligence feeds and live breach trackers", () => {
  it("enriches ransomware leak site claims with country flags, sectors, and US locations", async () => {
    const mockPosts = [
      {
        post_title: "Minkon 🇩🇪",
        discovered: "2026-11-15 10:00:00",
        description: "Industrial Machinery",
        group_name: "bravox",
      },
      {
        post_title: "Starbucks",
        discovered: "2026-11-15 11:00:00",
        description: "coffee retail · United States",
        group_name: "n0n",
      },
      {
        post_title: "Oregon Linen",
        discovered: "2026-11-15 12:00:00",
        description: "Business Services",
        group_name: "qilin",
      },
    ];

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("ransomlook.io/api/recent")) {
        return new Response(JSON.stringify(mockPosts), { status: 200 });
      }
      return originalFetch(url);
    });

    try {
      const claims = await getRansomwareClaims();
      expect(claims).toHaveLength(3);

      // Flag country extraction
      const dePost = claims.find((c) => c.victim.includes("Minkon"));
      expect(dePost).toBeDefined();
      expect(dePost?.country).toBe("DE");
      expect(dePost?.actor).toBe("Bravox");
      expect(dePost?.status).toBe("claimed");

      // Description country and sector extraction
      const sbPost = claims.find((c) => c.victim.includes("Starbucks"));
      expect(sbPost).toBeDefined();
      expect(sbPost?.country).toBe("US");
      expect(sbPost?.sector).toBe("coffee retail");
      expect(sbPost?.actor).toBe("N0n");

      // State matching extraction
      const orPost = claims.find((c) => c.victim.includes("Oregon Linen"));
      expect(orPost).toBeDefined();
      expect(orPost?.country).toBe("US");
      expect(orPost?.usLocation).toBe("OREGON");
      expect(orPost?.sector).toBe("Business Services");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("fetches and normalizes dark web cartel telemetry", async () => {
    const mockStats = {
      groups: 646,
      groups_online: 181,
      posts_total: 37005,
      posts_24h: 18,
      posts_month: 610,
      markets_online: 57,
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("ransomlook.io/api/stats")) {
        return new Response(JSON.stringify(mockStats), { status: 200 });
      }
      return originalFetch(url);
    });

    try {
      const stats = await getDarkWebCartelStats();
      expect(stats).toBeDefined();
      expect(stats?.groups).toBe(646);
      expect(stats?.groupsOnline).toBe(181);
      expect(stats?.posts24h).toBe(18);
      expect(stats?.postsMonth).toBe(610);
      expect(stats?.postsTotal).toBe(37005);
      expect(stats?.marketsOnline).toBe(57);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("extracts structured breach candidates from breaking wire RSS feeds", async () => {
    const sampleRss = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>The Record</title>
    <item>
      <title><![CDATA[City of Osaka warns of data breach impacting 1 million as Japan reels from dozens of cyber incidents]]></title>
      <link>https://therecord.media/city-of-osaka-japan-email-data-breach</link>
      <pubDate>Fri, 13 Nov 2026 19:43:00 GMT</pubDate>
      <description><![CDATA[Osaka warns 1 million residents after email data breach exposes personal information.]]></description>
    </item>
    <item>
      <title><![CDATA[University of Texas at Arlington warns personal information stolen during cyberattack]]></title>
      <link>https://therecord.media/university-of-texas-arlington-warns-data-breach</link>
      <pubDate>Fri, 13 Nov 2026 17:26:00 GMT</pubDate>
      <description><![CDATA[Investigation into the cyberattack confirmed unauthorized access to network files.]]></description>
    </item>
  </channel>
</rss>`;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("therecord.media/feed")) {
        return new Response(sampleRss, { status: 200 });
      }
      return new Response("<rss><channel></channel></rss>", { status: 200 });
    });

    try {
      const wire = await getWireData();
      expect(wire.candidates.length).toBeGreaterThanOrEqual(1);

      const osaka = wire.candidates.find((c) => c.victim === "City of Osaka");
      expect(osaka).toBeDefined();
      expect(osaka?.type).toBe("data_breach");
      expect(osaka?.status).toBe("confirmed");
      expect(osaka?.records).toBe(1000000);
      expect(osaka?.country).toBe("JP");

      const uta = wire.candidates.find((c) => c.victim === "University of Texas at Arlington");
      expect(uta).toBeDefined();
      expect(uta?.type).toBe("data_breach");
      expect(uta?.status).toBe("confirmed");
      expect(uta?.sources[0].publisher).toBe("therecord.media");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("parses official CISA emergency advisories and identifies active exploitation alerts", async () => {
    const sampleCisaXml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>All CISA Advisories</title>
    <item>
      <title>CISA Adds Two Known Exploited Vulnerabilities to Catalog</title>
      <link>https://www.cisa.gov/news-events/alerts/2026/11/13/cisa-adds-two-known-exploited-vulnerabilities-catalog</link>
      <pubDate>Fri, 13 Nov 26 12:00:00 +0000</pubDate>
      <description>&lt;p&gt;Active exploitation evidence for CVE-2026-114713 and CVE-2026-123039.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Siemens Desigo, Gridscale</title>
      <link>https://www.cisa.gov/news-events/ics-advisories/icsa-26-316-02</link>
      <pubDate>Thu, 12 Nov 26 12:00:00 +0000</pubDate>
      <description>&lt;p&gt;Industrial control system advisory for CVE-2026-111497.&lt;/p&gt;</description>
    </item>
  </channel>
</rss>`;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("cisa.gov/cybersecurity-advisories/all.xml")) {
        return new Response(sampleCisaXml, { status: 200 });
      }
      return originalFetch(url);
    });

    try {
      const cisa = await getCisaAdvisories();
      expect(cisa.advisories).toHaveLength(2);

      const alertItem = cisa.advisories.find((a) => a.category === "alert");
      expect(alertItem).toBeDefined();
      expect(alertItem?.cves).toContain("CVE-2026-114713");
      expect(alertItem?.cves).toContain("CVE-2026-123039");

      const icsItem = cisa.advisories.find((a) => a.category === "ics");
      expect(icsItem).toBeDefined();
      expect(icsItem?.cves).toContain("CVE-2026-111497");

      expect(cisa.candidates).toHaveLength(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("filters out security agency alerts and vulnerability warnings from breach candidates", async () => {
    const mixedRss = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>The Hacker News</title>
    <item>
      <title><![CDATA[FBI flash alert says Artex tool automating cyberattacks at machine speed]]></title>
      <link>https://thehackernews.com/2026/11/fbi-flash-alert.html</link>
      <pubDate>Fri, 13 Nov 2026 12:00:00 GMT</pubDate>
      <description><![CDATA[FBI and CISA warn about automated attacks tool.]]></description>
    </item>
    <item>
      <title><![CDATA[Google Cloud Warns Three AMD Turin CPU Flaws Could Leak Data Across Processes in VMs]]></title>
      <link>https://thehackernews.com/2026/11/google-cloud-flaws.html</link>
      <pubDate>Fri, 13 Nov 2026 13:00:00 GMT</pubDate>
      <description><![CDATA[Security researchers discovered three CPU vulnerabilities CVE-2026-9999.]]></description>
    </item>
    <item>
      <title><![CDATA[Cursor Says Stolen Fireworks AI Key Led to Trojanized Claude Code Extension Incident]]></title>
      <link>https://thehackernews.com/2026/11/cursor-breach.html</link>
      <pubDate>Fri, 13 Nov 2026 14:00:00 GMT</pubDate>
      <description><![CDATA[Cursor disclosed unauthorized access using stolen API keys.]]></description>
    </item>
  </channel>
</rss>`;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("feeds.feedburner.com/TheHackersNews")) {
        return new Response(mixedRss, { status: 200 });
      }
      return new Response("<rss><channel></channel></rss>", { status: 200 });
    });

    try {
      const wire = await getWireData();
      const cursor = wire.candidates.find((c) => c.victim === "Cursor");
      expect(cursor).toBeDefined();

      const fbi = wire.candidates.find((c) => c.victim?.toLowerCase().includes("fbi"));
      expect(fbi).toBeUndefined();

      const google = wire.candidates.find((c) => c.victim?.toLowerCase().includes("google"));
      expect(google).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("geocodes US locations by state name, state code, and city-state pairs", () => {
    const oregon = resolveUsLocation("Oregon");
    expect(oregon).toBeDefined();
    expect(oregon?.country).toBe("US");
    expect(oregon?.city).toBe("Portland");

    const texas = resolveUsLocation("TX");
    expect(texas).toBeDefined();
    expect(texas?.country).toBe("US");
    expect(texas?.city).toBe("Houston");

    const austin = resolveUsLocation("Austin, TX");
    expect(austin).toBeDefined();
    expect(austin?.country).toBe("US");
    expect(austin?.city).toBe("Austin");

    const secaucus = resolveUsLocation("Secaucus, NJ");
    expect(secaucus).toBeDefined();
    expect(secaucus?.country).toBe("US");
    expect(secaucus?.city).toBe("Secaucus");
  });
});
