import { describe, expect, it } from "vitest";

import { buildStix21Bundle } from "../stix";
import type { Incident } from "../types";

const STIX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SAMPLE_INCIDENT: Incident = {
  id: "inc-custom-42",
  title: "Sample Incident",
  victim: "Acme Corp",
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
  summary: "Details",
  actor: "APT99",
  cves: ["CVE-2025-1234"],
  sources: [{ title: "8-K", url: "https://example.test", publisher: "SEC" }],
  origin: "sec",
};

describe("buildStix21Bundle", () => {
  it("produces RFC-4122 valid STIX 2.1 IDs for bundle and every nested object", () => {
    const bundle = buildStix21Bundle(SAMPLE_INCIDENT, "2026-11-11T00:00:00.000Z");
    expect(bundle.id).toMatch(new RegExp(`^bundle--${STIX_UUID.source.slice(1, -1)}$`));
    expect(bundle.objects).toHaveLength(4);

    for (const obj of bundle.objects) {
      const [prefix, uuid] = obj.id.split("--");
      expect(prefix).toBe(obj.type);
      expect(uuid).toMatch(STIX_UUID);
    }
  });

  it("deduplicates duplicate CVEs and ignores whitespace-only domains", () => {
    const bundle = buildStix21Bundle(
      { ...SAMPLE_INCIDENT, domain: "   ", cves: ["cve-2025-1234", "CVE-2025-1234"] },
      "2026-11-11T00:00:00.000Z",
    );
    expect(bundle.objects.filter((o) => o.type === "indicator")).toHaveLength(0);
    expect(bundle.objects.filter((o) => o.type === "vulnerability")).toHaveLength(1);
  });
});
